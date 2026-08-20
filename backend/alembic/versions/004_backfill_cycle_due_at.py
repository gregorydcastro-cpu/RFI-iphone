"""Batched hole-fill cycle_due_at from due_at.

Revision ID: 004
Revises: 003
One job: leftover NULLs only. Crash + rerun continues. Never + interval.
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None

BATCH = 1000


def upgrade() -> None:
    while True:
        result = op.get_bind().execute(
            text(
                """
                UPDATE rfis
                SET cycle_due_at = due_at
                WHERE id IN (
                  SELECT id FROM rfis
                  WHERE cycle_due_at IS NULL
                    AND due_at IS NOT NULL
                  LIMIT 1000
                )
                """
            )
        )
        if result.rowcount == 0:
            break


def downgrade() -> None:
    raise RuntimeError("hole-fill is not reversed; do not null a live clock")
