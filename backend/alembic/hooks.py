"""Alembic migrate hooks. One path. Not coverage JSON. Not request-path.

pre_migrate runs before any revision. post_migrate runs after commit.
_on_version_apply is log-only in env.py.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

from sqlalchemy import inspect, text

log = logging.getLogger("alembic.hooks")

LOCK_KEY = 842150449

_MUST_HAVE = {
    "001": ("work_stopped",),
    "002": ("work_stopped", "first_submitted_at", "cycle_due_at"),
    "003": ("work_stopped", "first_submitted_at", "cycle_due_at"),
    "004": ("work_stopped", "first_submitted_at", "cycle_due_at"),
    "005": ("work_stopped", "first_submitted_at", "cycle_due_at"),
}
_MUST_NOT_HAVE = {
    None: (
        "work_stopped",
        "first_submitted_at",
        "cycle_due_at",
        "uq_rfis_project_rfi_number",
    ),
    "001": (
        "first_submitted_at",
        "cycle_due_at",
        "uq_rfis_project_rfi_number",
    ),
    "002": ("uq_rfis_project_rfi_number",),
    "003": ("uq_rfis_project_rfi_number",),
    "004": ("uq_rfis_project_rfi_number",),
    "005": (),
}
_MUST_INDEX = {
    "001": ("rfis_project_status_idx",),
    "002": ("rfis_project_status_idx",),
    "003": ("rfis_project_status_idx",),
    "004": ("rfis_project_status_idx",),
    "005": ("rfis_project_status_idx", "uq_rfis_project_rfi_number"),
}


class HookError(RuntimeError):
    """Fail closed. Never a silent skip."""


@dataclass
class MigrateContext:
    connection: object | None
    is_offline: bool
    direction: str
    starting_rev: str | None
    target_rev: object


def acquire_lock(connection) -> None:
    """DB lock on this connection. Two migrators cannot run."""
    if connection is None:
        return
    dialect = connection.dialect.name
    if dialect == "postgresql":
        connection.execute(text("SELECT pg_advisory_lock(:k)"), {"k": LOCK_KEY})
        return
    connection.execute(text("PRAGMA locking_mode=EXCLUSIVE"))
    connection.execute(text("SELECT 1"))


def release_lock(connection) -> None:
    if connection is None:
        return
    dialect = getattr(getattr(connection, "dialect", None), "name", None)
    if dialect == "postgresql":
        connection.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": LOCK_KEY})
        return
    if dialect == "sqlite":
        connection.execute(text("PRAGMA locking_mode=NORMAL"))
        connection.execute(text("SELECT 1"))


def current_revision(connection) -> str | None:
    if connection is None:
        return None
    insp = inspect(connection)
    if "alembic_version" not in set(insp.get_table_names()):
        return None
    rows = list(connection.execute(text("SELECT version_num FROM alembic_version")))
    if not rows:
        return None
    if len(rows) > 1:
        raise HookError("alembic_version has more than one row")
    return rows[0][0]


def _object_names(connection) -> tuple[set[str], set[str]]:
    insp = inspect(connection)
    tables = set(insp.get_table_names())
    if "rfis" not in tables:
        return set(), set()
    columns = {col["name"] for col in insp.get_columns("rfis")}
    indexes = {idx["name"] for idx in insp.get_indexes("rfis")}
    return columns, indexes


def _assert_alembic_version_sane(connection) -> None:
    """If the version table and the schema disagree, stop."""
    live = current_revision(connection)
    if live not in _MUST_NOT_HAVE and live not in _MUST_HAVE:
        raise HookError(f"alembic_version {live!r} is not a known revision")
    columns, indexes = _object_names(connection)
    for name in _MUST_HAVE.get(live, ()):
        if name not in columns:
            raise HookError(
                f"version table and schema disagree: version={live} missing {name}"
            )
    for name in _MUST_INDEX.get(live, ()):
        if name not in indexes:
            raise HookError(
                f"version table and schema disagree: version={live} missing {name}"
            )
    for name in _MUST_NOT_HAVE.get(live, ()):
        if name in columns or name in indexes:
            raise HookError(
                f"version table and schema disagree: version={live} already has {name}"
            )


def _assert_priority_invariant(connection) -> None:
    """work_stopped ⇔ priority = work_stopped. Fail closed. No VALIDATE."""
    columns, _ = _object_names(connection)
    if "work_stopped" not in columns:
        return
    drifted = connection.execute(
        text(
            """
            SELECT COUNT(*) FROM rfis
            WHERE NOT (
              (work_stopped AND priority = 'work_stopped')
              OR (NOT work_stopped AND priority IS DISTINCT FROM 'work_stopped')
            )
            """
        )
    ).scalar()
    if drifted:
        raise HookError("priority invariant drifted")


def pre_migrate(ctx: MigrateContext) -> None:
    if ctx.connection is not None:
        acquire_lock(ctx.connection)
    live = current_revision(ctx.connection)
    log.info(
        "pre_migrate start=%s target=%s direction=%s",
        live,
        ctx.target_rev,
        ctx.direction,
    )
    env = os.environ.get("APP_ENV", "dev")
    if ctx.direction == "down" and env == "prod":
        raise HookError("refuse downgrade in prod")
    if ctx.connection is None:
        return
    _assert_alembic_version_sane(ctx.connection)
    _assert_priority_invariant(ctx.connection)


def post_migrate(ctx: MigrateContext) -> None:
    """After the transaction commits. Do not mutate RFI rows."""
    log.info(
        "post_migrate start=%s target=%s direction=%s",
        current_revision(ctx.connection) if ctx.connection is not None else None,
        ctx.target_rev,
        ctx.direction,
    )
    release_lock(ctx.connection)
