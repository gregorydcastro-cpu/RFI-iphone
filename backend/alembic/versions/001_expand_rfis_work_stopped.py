"""Expand rfis: work_stopped, project_status index, NOT VALID pair CHECK.

Revision ID: 001
Revises:
One job: schema expand. Do not VALIDATE. Do not DROP. Do not backfill.
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import inspect, text

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {col["name"] for col in inspect(bind).get_columns("rfis")}
    if "work_stopped" not in columns:
        if bind.dialect.name == "postgresql":
            op.execute(
                text(
                    "ALTER TABLE rfis "
                    "ADD COLUMN IF NOT EXISTS work_stopped "
                    "boolean NOT NULL DEFAULT false"
                )
            )
        else:
            op.execute(
                text(
                    "ALTER TABLE rfis ADD COLUMN work_stopped "
                    "BOOLEAN NOT NULL DEFAULT 0"
                )
            )
    op.execute(
        text(
            "CREATE INDEX IF NOT EXISTS rfis_project_status_idx "
            "ON rfis (project_id, status)"
        )
    )
    if bind.dialect.name != "postgresql":
        return
    already = bind.execute(
        text(
            "SELECT 1 FROM pg_constraint "
            "WHERE conname = 'rfis_work_stopped_priority_chk'"
        )
    ).scalar()
    if already:
        return
    op.execute(
        text(
            """
            ALTER TABLE rfis
              ADD CONSTRAINT rfis_work_stopped_priority_chk
              CHECK (
                (work_stopped AND priority = 'work_stopped')
                OR (NOT work_stopped AND priority IS DISTINCT FROM 'work_stopped')
              ) NOT VALID
            """
        )
    )


def downgrade() -> None:
    raise RuntimeError("contract is a later revision; do not DROP from expand")
