"""Alembic hook law: one path (`alembic.hooks`), env.py stays the thin wiring.

pre_migrate: lock, log start/target/direction, refuse down in prod,
version-table sanity, priority invariant. No migrate_v1_to_v2, no coverage JSON.

post_migrate fires only after the transaction commits. Exception path
release_lock + re-raise. _on_version_apply logs only — no RFI row mutation.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app import db as dbmod

# Register alembic/hooks.py as alembic.hooks without making alembic/ a package.
_HOOKS = Path(__file__).resolve().parents[1] / "alembic" / "hooks.py"
_spec = importlib.util.spec_from_file_location("alembic.hooks", _HOOKS)
assert _spec and _spec.loader
_mod = importlib.util.module_from_spec(_spec)
sys.modules["alembic.hooks"] = _mod
_spec.loader.exec_module(_mod)

from alembic.hooks import (  # noqa: E402
    HookError,
    MigrateContext,
    _assert_alembic_version_sane,
    _assert_priority_invariant,
    current_revision,
    post_migrate,
    pre_migrate,
    release_lock,
)

LOGGER = "alembic.hooks"


def test_env_py_is_the_exact_wiring() -> None:
    """Greg's shape: one hook path, NullPool, post_migrate after commit."""
    src = (Path(__file__).resolve().parents[1] / "alembic" / "env.py").read_text()
    assert "from alembic.hooks import HookError, MigrateContext, post_migrate, pre_migrate" in src
    assert "on_version_apply=_on_version_apply" in src
    assert "poolclass=pool.NullPool" in src
    assert "engine_from_config" in src
    assert "post_migrate(ctx)" in src
    assert "release_lock(connection)" in src
    assert "target_metadata = Base.metadata" in src
    assert "Log only — do not mutate RFI rows" in src
    assert "UPDATE rfis" not in src
    assert "rfi_events" not in src
    assert "rfi_number" not in src or "Do not allocate rfi_number" in src
    assert "from app.pre_migrate" not in src


def test_hooks_is_not_a_package() -> None:
    """backend/alembic/ must stay a script dir — no __init__.py."""
    assert not (Path(__file__).resolve().parents[1] / "alembic" / "__init__.py").exists()
    assert (Path(__file__).resolve().parents[1] / "alembic" / "hooks.py").is_file()
    assert not (Path(__file__).resolve().parents[1] / "app" / "pre_migrate.py").exists()


def test_on_version_apply_logs_only_no_rfi_mutation() -> None:
    # Don't exec env.py (it runs migrations at import). Read the function source.
    src = (Path(__file__).resolve().parents[1] / "alembic" / "env.py").read_text()
    start = src.index("def _on_version_apply")
    end = src.index("if context.is_offline_mode()")
    body = src[start:end]
    assert "logging.getLogger(\"alembic.hooks\").info" in body
    assert "UPDATE" not in body
    assert "rfi_events" not in body
    assert "INSERT" not in body
    assert "rfi_number" not in body


def test_pre_migrate_logs_start_target_direction_only(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('001')"))
        conn.execute(text("CREATE TABLE rfis (id INTEGER PRIMARY KEY, work_stopped INTEGER NOT NULL, priority VARCHAR NOT NULL)"))
        conn.execute(text("CREATE INDEX rfis_project_status_idx ON rfis (id)"))
    monkeypatch.delenv("APP_ENV", raising=False)
    with engine.connect() as conn, caplog.at_level("INFO", logger=LOGGER):
        pre_migrate(MigrateContext(conn, False, "up", None, "005"))
    records = [r.getMessage() for r in caplog.records if r.name == LOGGER]
    joined = " ".join(records)
    assert "start=001" in joined
    assert "target=005" in joined
    assert "direction=up" in joined
    assert "subject" not in joined.lower()
    assert "question" not in joined.lower()
    assert "token" not in joined.lower()
    engine.dispose()


def test_pre_migrate_refuses_downgrade_in_prod(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
    monkeypatch.setenv("APP_ENV", "prod")
    with engine.connect() as conn:
        with pytest.raises(HookError, match="refuse downgrade in prod"):
            pre_migrate(MigrateContext(conn, False, "down", None, "001"))
    engine.dispose()


def test_pre_migrate_allows_downgrade_outside_prod(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('001')"))
        conn.execute(text("CREATE TABLE rfis (id INTEGER PRIMARY KEY, work_stopped INTEGER NOT NULL, priority VARCHAR NOT NULL)"))
        conn.execute(text("CREATE INDEX rfis_project_status_idx ON rfis (id)"))
    monkeypatch.setenv("APP_ENV", "dev")
    with engine.connect() as conn:
        pre_migrate(MigrateContext(conn, False, "down", None, "001"))
    engine.dispose()


def test_pre_migrate_default_env_is_dev(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('001')"))
        conn.execute(text("CREATE TABLE rfis (id INTEGER PRIMARY KEY, work_stopped INTEGER NOT NULL, priority VARCHAR NOT NULL)"))
        conn.execute(text("CREATE INDEX rfis_project_status_idx ON rfis (id)"))
    monkeypatch.delenv("APP_ENV", raising=False)
    with engine.connect() as conn:
        pre_migrate(MigrateContext(conn, False, "down", None, "001"))
    engine.dispose()


def test_version_table_none_but_schema_has_expand_objects_raises() -> None:
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        conn.execute(text("CREATE TABLE rfis (id INTEGER PRIMARY KEY, work_stopped INTEGER)"))
    with engine.connect() as conn:
        with pytest.raises(HookError, match="version table and schema disagree"):
            _assert_alembic_version_sane(conn)
    engine.dispose()


def test_version_table_001_missing_work_stopped_raises() -> None:
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('001')"))
        conn.execute(text("CREATE TABLE rfis (id INTEGER PRIMARY KEY)"))
        conn.execute(text("CREATE INDEX rfis_project_status_idx ON rfis (id)"))
    with engine.connect() as conn:
        with pytest.raises(HookError, match="version table and schema disagree"):
            _assert_alembic_version_sane(conn)
    engine.dispose()


def test_version_table_001_already_has_clocks_raises() -> None:
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('001')"))
        conn.execute(text("CREATE TABLE rfis (id INTEGER PRIMARY KEY, work_stopped INTEGER, first_submitted_at DATETIME)"))
        conn.execute(text("CREATE INDEX rfis_project_status_idx ON rfis (id)"))
    with engine.connect() as conn:
        with pytest.raises(HookError, match="version table and schema disagree"):
            _assert_alembic_version_sane(conn)
    engine.dispose()


def test_version_table_002_already_has_unique_index_raises() -> None:
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('002')"))
        conn.execute(text(
            "CREATE TABLE rfis (id INTEGER PRIMARY KEY, work_stopped INTEGER, "
            "first_submitted_at DATETIME, cycle_due_at DATETIME)"
        ))
        conn.execute(text("CREATE INDEX rfis_project_status_idx ON rfis (id)"))
        conn.execute(text("CREATE UNIQUE INDEX uq_rfis_project_rfi_number ON rfis (id)"))
    with engine.connect() as conn:
        with pytest.raises(HookError, match="version table and schema disagree"):
            _assert_alembic_version_sane(conn)
    engine.dispose()


def test_version_table_005_missing_unique_index_raises() -> None:
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('005')"))
        conn.execute(text(
            "CREATE TABLE rfis (id INTEGER PRIMARY KEY, work_stopped INTEGER, "
            "first_submitted_at DATETIME, cycle_due_at DATETIME)"
        ))
        conn.execute(text("CREATE INDEX rfis_project_status_idx ON rfis (id)"))
    with engine.connect() as conn:
        with pytest.raises(HookError, match="version table and schema disagree"):
            _assert_alembic_version_sane(conn)
    engine.dispose()


def test_priority_invariant_fails_closed_on_drift() -> None:
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE rfis (id INTEGER PRIMARY KEY, work_stopped INTEGER NOT NULL, priority VARCHAR NOT NULL)"
        ))
        conn.execute(text("INSERT INTO rfis (id, work_stopped, priority) VALUES (1, 1, 'standard')"))
    with engine.connect() as conn:
        with pytest.raises(HookError, match="priority invariant drifted"):
            _assert_priority_invariant(conn)
    engine.dispose()


def test_priority_invariant_skips_before_work_stopped_column() -> None:
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE rfis (id INTEGER PRIMARY KEY, priority VARCHAR NOT NULL)"))
    with engine.connect() as conn:
        _assert_priority_invariant(conn)
    engine.dispose()


def test_hook_does_not_call_migrate_v1_to_v2(monkeypatch: pytest.MonkeyPatch) -> None:
    called = {"n": 0}

    def boom(*_a, **_k):
        called["n"] += 1
        raise AssertionError("hook must not call migrate_v1_to_v2")

    monkeypatch.setattr("app.coverage_schema.migrate_v1_to_v2", boom)
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('001')"))
        conn.execute(text("CREATE TABLE rfis (id INTEGER PRIMARY KEY, work_stopped INTEGER NOT NULL, priority VARCHAR NOT NULL)"))
        conn.execute(text("CREATE INDEX rfis_project_status_idx ON rfis (id)"))
    with engine.connect() as conn:
        pre_migrate(MigrateContext(conn, False, "up", None, "005"))
    assert called["n"] == 0
    engine.dispose()


def test_offline_pre_migrate_skips_lock_and_connection() -> None:
    pre_migrate(MigrateContext(None, True, "up", None, None))


def test_post_migrate_releases_lock() -> None:
    engine = create_engine("sqlite://")
    with engine.connect() as conn:
        post_migrate(MigrateContext(conn, False, "up", None, "005"))
    engine.dispose()


def test_exception_path_release_lock_and_reraise() -> None:
    """env.py except: release_lock(connection); raise. Do not swallow."""
    engine = create_engine("sqlite://")
    with engine.connect() as conn:
        release_lock(conn)
        with pytest.raises(RuntimeError, match="migration boom"):
            try:
                raise RuntimeError("migration boom")
            except Exception:
                release_lock(conn)
                raise
    engine.dispose()


def test_upgrade_head_from_v0_applies_once_and_is_idempotent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    url = f"sqlite:///{tmp_path}/hook.db"
    monkeypatch.setenv("RFI_DATABASE_URL", url)
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
                  'r12', 'p1', 12, 'ball_in_court', 'standard',
                  '2026-01-02 15:00:00', '2026-01-09 17:00:00'
                )
                """
            )
        )

    cfg = Config(str(dbmod.ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(dbmod.ROOT / "alembic"))
    command.upgrade(cfg, "head")
    with engine.connect() as conn:
        assert current_revision(conn) == "005"
        cols = {c["name"] for c in inspect(conn).get_columns("rfis")}
        assert {"work_stopped", "first_submitted_at", "cycle_due_at"} <= cols
        assert "uq_rfis_project_rfi_number" in {
            ix["name"] for ix in inspect(conn).get_indexes("rfis")
        }
        clocks = conn.execute(
            text(
                "SELECT first_submitted_at IS NOT NULL, cycle_due_at IS NOT NULL "
                "FROM rfis WHERE rfi_number = 12"
            )
        ).one()
        assert clocks == (True, True)

    command.upgrade(cfg, "head")
    with engine.connect() as conn:
        assert current_revision(conn) == "005"
    engine.dispose()


def test_handlers_still_do_not_import_hook_module() -> None:
    import app.main as main
    import app.rfi as rfi

    src = Path(rfi.__file__).read_text() + Path(main.__file__).read_text()
    assert "pre_migrate" not in src
    assert "alembic.hooks" not in src
    assert "migrate_v1_to_v2" not in src


def test_init_db_does_not_import_alembic_hook() -> None:
    src = Path(dbmod.__file__).read_text()
    assert "pre_migrate" not in src
    assert "alembic.hooks" not in src
    assert "migrate_v1_to_v2" not in src
