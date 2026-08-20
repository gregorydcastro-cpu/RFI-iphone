"""Alembic pre-migrate hook. Runs before any revision applies.

Not coverage JSON. Not a request-path walker. Not VALIDATE. Not backfill.
The version table still prevents applying 002 twice. This lock is for
concurrent runners.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

from sqlalchemy import inspect, text

log = logging.getLogger("alembic.pre_migrate")

# Session-level advisory lock. Not the alembic_version "apply once" lock.
LOCK_KEY = 842150449

# Schema objects each stamped revision must already have / must not have.
# 003 and 004 are data-only; they share 002's expand shape.
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
class MigrateCtx:
    connection: object
    target_rev: str | None
    direction: str


def acquire_lock(connection) -> None:
    """DB lock on this connection. Two migrators cannot run."""
    dialect = connection.dialect.name
    if dialect == "postgresql":
        connection.execute(text("SELECT pg_advisory_lock(:k)"), {"k": LOCK_KEY})
        return
    connection.execute(text("PRAGMA locking_mode=EXCLUSIVE"))
    connection.execute(text("SELECT 1"))


def current_revision(connection) -> str | None:
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
    """If the version table and the schema disagree, stop.

    Do not rebuild history. Do not IF NOT EXISTS a lost version row.
    """
    live = current_revision(connection)
    if live not in _MUST_NOT_HAVE and live not in _MUST_HAVE:
        raise HookError(f"alembic_version {live!r} is not a known revision")
    columns, indexes = _object_names(connection)
    for name in _MUST_HAVE.get(live, ()):
        if name not in columns:
            raise HookError(
                f"version table is {live}; schema is missing {name}"
            )
    for name in _MUST_INDEX.get(live, ()):
        if name not in indexes:
            raise HookError(
                f"version table is {live}; schema is missing {name}"
            )
    for name in _MUST_NOT_HAVE.get(live, ()):
        if name in columns or name in indexes:
            raise HookError(
                f"version table is {live}; schema already has {name}"
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
        raise HookError("work_stopped ⇔ priority = work_stopped does not hold")


def pre_migrate(ctx: MigrateCtx) -> None:
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
    _assert_alembic_version_sane(ctx.connection)
    _assert_priority_invariant(ctx.connection)
