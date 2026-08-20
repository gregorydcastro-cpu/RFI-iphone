"""Expand rfis life clocks. ADD COLUMN only.

Revision ID: 002
Revises: 001
One job: expand first_submitted_at and cycle_due_at. Backfill is 003/004.
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import inspect, text

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {col["name"] for col in inspect(bind).get_columns("rfis")}
    for name in ("first_submitted_at", "cycle_due_at"):
        if name in columns:
            continue
        if bind.dialect.name == "postgresql":
            op.execute(text(f"ALTER TABLE rfis ADD COLUMN IF NOT EXISTS {name} timestamp"))
        else:
            op.execute(text(f"ALTER TABLE rfis ADD COLUMN {name} TIMESTAMP"))


def downgrade() -> None:
    raise RuntimeError("contract is a later revision; do not DROP from expand")
