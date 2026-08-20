"""Unique (project_id, rfi_number) where rfi_number is present.

Revision ID: 005
Revises: 004
One job: enforce first-submit numbering. Drafts stay NULL. Do not mint.
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_rfis_project_rfi_number
              ON rfis (project_id, rfi_number)
              WHERE rfi_number IS NOT NULL
            """
        )
    )


def downgrade() -> None:
    raise RuntimeError("contract is a later revision; do not DROP from expand")
