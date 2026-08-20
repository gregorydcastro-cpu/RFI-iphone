"""DB migration law. Opposite of coverage JSON. Not Grafana."""

from __future__ import annotations

import ast
import inspect
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect as sa_inspect, text
from sqlalchemy.exc import IntegrityError

from alembic import command
from alembic.config import Config

from app import db as dbmod
from app.coverage_schema import CURRENT_SCHEMA
from app.ids import PROJECT_ID
from app.models import RFI

evaluate = None

VERSIONS = dbmod.ROOT / "alembic" / "versions"
REVISIONS = (
    ("001_expand_rfis_work_stopped.py", "001", None),
    ("002_expand_rfis_life_clocks.py", "002", "001"),
    ("003_backfill_first_submitted_at.py", "003", "002"),
    ("004_backfill_cycle_due_at.py", "004", "003"),
    ("005_unique_project_rfi_number.py", "005", "004"),
)


def _revision_source(name: str) -> str:
    return (VERSIONS / name).read_text()


def test_current_schema_stays_2() -> None:
    assert CURRENT_SCHEMA == 2


def test_revisions_are_one_job_one_parent() -> None:
    parents = []
    for filename, rev, parent in REVISIONS:
        tree = ast.parse(_revision_source(filename))
        assigned = {
            node.targets[0].id: node.value
            for node in tree.body
            if isinstance(node, ast.Assign)
            and len(node.targets) == 1
            and isinstance(node.targets[0], ast.Name)
        }
        assert ast.literal_eval(assigned["revision"]) == rev
        assert ast.literal_eval(assigned["down_revision"]) == parent
        parents.append(parent)
        src = _revision_source(filename)
        assert "VALIDATE CONSTRAINT" not in src
        assert "DROP COLUMN" not in src
        assert "DROP TABLE" not in src
        assert "rfi_number +" not in src
        assert "migrate_v1_to_v2" not in src
    assert parents.count(None) == 1


def test_expand_sql_is_retry_safe_not_a_paste_all_day_contract() -> None:
    expand = (dbmod.ROOT / "app" / "sql" / "rfis_work_stopped_priority.sql").read_text()
    assert "ADD COLUMN IF NOT EXISTS work_stopped" in expand
    assert "CREATE INDEX IF NOT EXISTS rfis_project_status_idx" in expand
    assert "NOT VALID" in expand
    body = "\n".join(
        line for line in expand.splitlines() if not line.lstrip().startswith("--")
    )
    assert "VALIDATE CONSTRAINT" not in body
    assert "DROP " not in body
    clocks = (dbmod.ROOT / "app" / "sql" / "rfis_expand_life_clocks.sql").read_text()
    assert "ADD COLUMN IF NOT EXISTS first_submitted_at" in clocks
    assert "ADD COLUMN IF NOT EXISTS cycle_due_at" in clocks
    assert "UPDATE" not in clocks
    unique = (dbmod.ROOT / "app" / "sql" / "rfis_unique_project_rfi_number.sql").read_text()
    assert "CREATE UNIQUE INDEX IF NOT EXISTS uq_rfis_project_rfi_number" in unique
    assert "WHERE rfi_number IS NOT NULL" in unique
    assert "rfi_number +" not in unique


def test_handlers_use_current_schema_only() -> None:
    from app import main, rfi, pre_migrate

    assert "migrate_v1_to_v2" not in inspect.getsource(main)
    assert "migrate_v1_to_v2" not in inspect.getsource(rfi)
    assert "migrate_v1_to_v2" not in inspect.getsource(pre_migrate.pre_migrate)
    assert "require_access(" in inspect.getsource(main.create_rfi_draft)
    assert "require_access(" in inspect.getsource(main.submit_rfi)
    assert "require_access(" in inspect.getsource(main.pe_set_priority)


def test_alembic_upgrade_twice_noops_via_version_table(tmp_path, monkeypatch) -> None:
    url = f"sqlite:///{tmp_path}/mig.db"
    engine = create_engine(url, future=True)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE rfis (
                  id TEXT PRIMARY KEY,
                  project_id TEXT NOT NULL,
                  rfi_number INTEGER,
                  status TEXT,
                  priority TEXT,
                  submitted_at TIMESTAMP,
                  due_at TIMESTAMP
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO rfis (
                  id, project_id, rfi_number, status, priority, submitted_at, due_at
                ) VALUES (
                  'r1', 'p1', NULL, 'draft', 'standard',
                  '2026-01-02 15:00:00', '2026-01-09 17:00:00'
                )
                """
            )
        )
    monkeypatch.setenv("RFI_DATABASE_URL", url)
    cfg = Config(str(dbmod.ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(dbmod.ROOT / "alembic"))
    command.upgrade(cfg, "head")
    command.upgrade(cfg, "head")
    insp = sa_inspect(engine)
    columns = {col["name"] for col in insp.get_columns("rfis")}
    indexes = {idx["name"] for idx in insp.get_indexes("rfis")}
    assert "work_stopped" in columns
    assert "first_submitted_at" in columns
    assert "cycle_due_at" in columns
    assert "rfis_project_status_idx" in indexes
    assert "uq_rfis_project_rfi_number" in indexes
    with engine.connect() as conn:
        row = conn.execute(text("SELECT first_submitted_at, cycle_due_at, work_stopped FROM rfis WHERE id = 'r1'")).one()
        assert str(row.first_submitted_at).startswith("2026-01-02")
        assert str(row.cycle_due_at).startswith("2026-01-09")
        stamped = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    assert stamped == "005"


def test_hole_fill_revision_sql_updates_zero_on_retry(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path}/holes.db", future=True)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE rfis (
                  id TEXT PRIMARY KEY,
                  submitted_at TIMESTAMP,
                  first_submitted_at TIMESTAMP,
                  due_at TIMESTAMP,
                  cycle_due_at TIMESTAMP
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO rfis VALUES
                  ('a', '2026-01-01 12:00:00', NULL, '2026-01-08 17:00:00', NULL),
                  ('b', '2026-01-02 12:00:00', '2026-01-02 08:00:00', '2026-01-09 17:00:00', '2026-01-03 17:00:00')
                """
            )
        )
        first_sql = (dbmod.ROOT / "app" / "sql" / "rfis_backfill_first_submitted_at.sql").read_text()
        cycle_sql = (dbmod.ROOT / "app" / "sql" / "rfis_backfill_cycle_due_at.sql").read_text()
        assert conn.execute(text(first_sql)).rowcount == 1
        assert conn.execute(text(first_sql)).rowcount == 0
        assert conn.execute(text(cycle_sql)).rowcount == 1
        assert conn.execute(text(cycle_sql)).rowcount == 0
        kept = conn.execute(
            text("SELECT first_submitted_at, cycle_due_at FROM rfis WHERE id = 'b'")
        ).one()
        assert str(kept.first_submitted_at).startswith("2026-01-02 08:00:00")
        assert str(kept.cycle_due_at).startswith("2026-01-03 17:00:00")


def test_project_rfi_number_unique_allows_null_drafts(client) -> None:
    indexes = {idx["name"] for idx in sa_inspect(dbmod.engine).get_indexes("rfis")}
    assert "uq_rfis_project_rfi_number" in indexes
    db = dbmod.SessionLocal()
    try:
        db.add_all(
            [
                RFI(
                    project_id=str(PROJECT_ID),
                    status="draft",
                    subject="Draft A",
                    question="Null numbers may coexist.",
                    priority="standard",
                    work_stopped=False,
                    cost_impact="unknown",
                    schedule_impact="unknown",
                    rfi_number=None,
                ),
                RFI(
                    project_id=str(PROJECT_ID),
                    status="draft",
                    subject="Draft B",
                    question="Still null until first submit.",
                    priority="standard",
                    work_stopped=False,
                    cost_impact="unknown",
                    schedule_impact="unknown",
                    rfi_number=None,
                ),
            ]
        )
        db.commit()
        db.add(
            RFI(
                project_id=str(PROJECT_ID),
                status="ball_in_court",
                subject="Numbered",
                question="First submit minted 7.",
                priority="standard",
                work_stopped=False,
                cost_impact="unknown",
                schedule_impact="unknown",
                rfi_number=88007,
                rfi_display="RFI-88007",
            )
        )
        db.commit()
        db.add(
            RFI(
                project_id=str(PROJECT_ID),
                status="ball_in_court",
                subject="Dup",
                question="Same project cannot reuse 88007.",
                priority="standard",
                work_stopped=False,
                cost_impact="unknown",
                schedule_impact="unknown",
                rfi_number=88007,
                rfi_display="RFI-88007-b",
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
    finally:
        db.rollback()
        db.close()
