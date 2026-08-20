"""Alembic pre-migrate hook law. Not coverage JSON. Not Grafana."""

from __future__ import annotations

import inspect
import logging

import pytest
from sqlalchemy import create_engine, text

from app.coverage_schema import CURRENT_SCHEMA
from app.pre_migrate import HookError, MigrateCtx, current_revision, pre_migrate

evaluate = None


def _engine(tmp_path):
    return create_engine(f"sqlite:///{tmp_path}/hook.db", future=True)


def _ctx(conn, target="005", direction="up") -> MigrateCtx:
    return MigrateCtx(connection=conn, target_rev=target, direction=direction)


def test_current_schema_stays_2() -> None:
    assert CURRENT_SCHEMA == 2


def test_hook_is_not_coverage_or_backfill() -> None:
    from app import pre_migrate as hook

    src = inspect.getsource(hook.pre_migrate)
    assert "migrate_v1_to_v2" not in src
    assert "VALIDATE CONSTRAINT" not in src
    assert "UPDATE rfis" not in src
    assert "rfi_number +" not in src
    assert "grafana" not in src.lower()


def test_refuse_downgrade_in_prod(tmp_path, monkeypatch, caplog) -> None:
    engine = _engine(tmp_path)
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE rfis (id TEXT PRIMARY KEY, priority TEXT)"))
    monkeypatch.setenv("APP_ENV", "prod")
    with engine.connect() as conn:
        with caplog.at_level(logging.INFO, logger="alembic.pre_migrate"):
            with pytest.raises(HookError, match="refuse downgrade in prod"):
                pre_migrate(_ctx(conn, target="001", direction="down"))
        assert "pre_migrate start=" in caplog.text
        assert "direction=down" in caplog.text
        assert "token" not in caplog.text.lower()
        assert "question" not in caplog.text.lower()


def test_local_down_is_not_silently_skipped(tmp_path, monkeypatch) -> None:
    engine = _engine(tmp_path)
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE rfis (id TEXT PRIMARY KEY, priority TEXT)"))
    monkeypatch.setenv("APP_ENV", "dev")
    with engine.connect() as conn:
        pre_migrate(_ctx(conn, target=None, direction="down"))
        assert current_revision(conn) is None


def test_lost_version_row_stops(tmp_path) -> None:
    engine = _engine(tmp_path)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE rfis (
                  id TEXT PRIMARY KEY,
                  priority TEXT,
                  work_stopped BOOLEAN NOT NULL DEFAULT 0
                )
                """
            )
        )
    with engine.connect() as conn:
        with pytest.raises(HookError, match="already has work_stopped"):
            pre_migrate(_ctx(conn, direction="up"))


def test_drifted_priority_pair_fails_closed(tmp_path) -> None:
    engine = _engine(tmp_path)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE rfis (
                  id TEXT PRIMARY KEY,
                  project_id TEXT,
                  status TEXT,
                  priority TEXT,
                  work_stopped BOOLEAN NOT NULL DEFAULT 0
                )
                """
            )
        )
        conn.execute(
            text("CREATE INDEX rfis_project_status_idx ON rfis (project_id, status)")
        )
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('001')"))
        conn.execute(
            text(
                "INSERT INTO rfis (id, project_id, priority, work_stopped) "
                "VALUES ('bad', 'p', 'standard', 1)"
            )
        )
    with engine.connect() as conn:
        with pytest.raises(HookError, match="work_stopped"):
            pre_migrate(_ctx(conn, target="002", direction="up"))


def test_three_writes_still_hang_require_access() -> None:
    from app import main
    from abac import HUNG_WRITES

    assert HUNG_WRITES == frozenset(
        {"create_rfi_draft", "submit_rfi", "set_priority"}
    )
    for src in (
        inspect.getsource(main.create_rfi_draft),
        inspect.getsource(main.submit_rfi),
        inspect.getsource(main.pe_set_priority),
    ):
        assert src.index("require_access(") < src.index("except AccessDenied")
