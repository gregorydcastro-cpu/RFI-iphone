"""Hole-fill first_submitted_at from submitted_at.

Revision ID: 003
Revises: 002
One job: data movement. Twice updates zero rows. Never now(). Never +N.
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        text(
            """
            UPDATE rfis
            SET first_submitted_at = submitted_at
            WHERE first_submitted_at IS NULL
              AND submitted_at IS NOT NULL
            """
        )
    )


def downgrade() -> None:
    raise RuntimeError("hole-fill is not reversed; do not null a live clock")
