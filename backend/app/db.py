from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from app.models import Base

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("RFI_DATA_DIR", ROOT / "data"))
ASSETS_DIR = ROOT / "assets"
ATTACHMENTS_DIR = DATA_DIR / "attachments"

DEFAULT_SQLITE = DATA_DIR / "rfi.db"


def database_url() -> str:
    return os.environ.get("RFI_DATABASE_URL", f"sqlite:///{DEFAULT_SQLITE}")


def make_engine(url: str | None = None):
    url = url or database_url()
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args, future=True)


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def configure(url: str) -> None:
    """Point the process at a different database (used by tests)."""
    global engine, SessionLocal
    engine = make_engine(url)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def apply_rfis_work_stopped_law(bind=None) -> None:
    """Expand work_stopped + indexes. CHECK is NOT VALID — do not VALIDATE here."""
    bind = bind or engine
    insp = inspect(bind)
    if "rfis" not in insp.get_table_names():
        return
    columns = {col["name"] for col in insp.get_columns("rfis")}
    indexes = {idx["name"] for idx in insp.get_indexes("rfis")}
    with bind.begin() as conn:
        if "work_stopped" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE rfis ADD COLUMN work_stopped "
                    "BOOLEAN NOT NULL DEFAULT false"
                )
            )
        if "rfis_project_status_idx" not in indexes:
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS rfis_project_status_idx "
                    "ON rfis (project_id, status)"
                )
            )
        if "uq_rfis_project_rfi_number" not in indexes:
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_rfis_project_rfi_number "
                    "ON rfis (project_id, rfi_number) "
                    "WHERE rfi_number IS NOT NULL"
                )
            )
        if bind.dialect.name == "postgresql":
            already = conn.execute(
                text(
                    "SELECT 1 FROM pg_constraint "
                    "WHERE conname = 'rfis_work_stopped_priority_chk'"
                )
            ).scalar()
            if not already:
                conn.execute(
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


BACKFILL_CYCLE_DUE_BATCH = 1000


def apply_rfis_hole_backfill(bind=None) -> None:
    """Copy into missing clocks. Never overwrite. Never +N on rfi_number."""
    bind = bind or engine
    insp = inspect(bind)
    if "rfis" not in insp.get_table_names():
        return
    columns = {col["name"] for col in insp.get_columns("rfis")}
    with bind.begin() as conn:
        if "first_submitted_at" not in columns:
            conn.execute(text("ALTER TABLE rfis ADD COLUMN first_submitted_at timestamp"))
        if "cycle_due_at" not in columns:
            conn.execute(text("ALTER TABLE rfis ADD COLUMN cycle_due_at timestamp"))
        conn.execute(
            text(
                """
                UPDATE rfis
                SET first_submitted_at = submitted_at
                WHERE first_submitted_at IS NULL
                  AND submitted_at IS NOT NULL
                """
            )
        )
        while True:
            result = conn.execute(
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


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    apply_rfis_work_stopped_law(engine)
    apply_rfis_hole_backfill(engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
