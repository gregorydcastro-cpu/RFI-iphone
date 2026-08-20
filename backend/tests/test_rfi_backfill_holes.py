"""rfis hole backfill. Copy missing clocks. Never +N. Not coverage walks."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import inspect, text

from app import db as dbmod
from app.coverage_schema import CURRENT_SCHEMA
from app.db import apply_rfis_hole_backfill
from app.ids import PROJECT_ID
from app.models import RFI


def test_current_schema_stays_2() -> None:
    assert CURRENT_SCHEMA == 2


def test_rfis_has_hole_clock_columns(client) -> None:
    columns = {col["name"] for col in inspect(dbmod.engine).get_columns("rfis")}
    assert "first_submitted_at" in columns
    assert "cycle_due_at" in columns
    assert "work_stopped" in columns


def test_sql_backfill_is_fill_holes_not_a_transform() -> None:
    sql = (dbmod.ROOT / "app" / "sql" / "rfis_backfill_holes.sql").read_text()
    assert "first_submitted_at = submitted_at" in sql
    assert "first_submitted_at IS NULL" in sql
    assert "submitted_at IS NOT NULL" in sql
    assert "cycle_due_at = due_at" in sql
    assert "cycle_due_at IS NULL" in sql
    assert "due_at IS NOT NULL" in sql
    assert "LIMIT 1000" in sql
    assert dbmod.BACKFILL_CYCLE_DUE_BATCH == 1000
    assert "rfi_number +" not in sql
    assert "rfi_number =" not in sql
    assert "first_submitted_at = now()" not in sql.lower()
    assert "interval" not in sql.lower()
    assert "SET cycle_due_at = due_at\nWHERE id IN" in sql


def test_first_submitted_at_copies_once_and_stays_sticky(client) -> None:
    first = datetime(2026, 1, 2, 15, 0, 0)
    later = first + timedelta(days=3)
    db = dbmod.SessionLocal()
    try:
        hole = RFI(
            project_id=str(PROJECT_ID),
            status="ball_in_court",
            subject="Hole first clock",
            question="Fill first_submitted_at from submitted_at only.",
            priority="standard",
            work_stopped=False,
            cost_impact="unknown",
            schedule_impact="unknown",
            submitted_at=first,
            first_submitted_at=None,
        )
        kept = RFI(
            project_id=str(PROJECT_ID),
            status="ball_in_court",
            subject="Live first clock",
            question="Do not overwrite a real first_submitted_at.",
            priority="standard",
            work_stopped=False,
            cost_impact="unknown",
            schedule_impact="unknown",
            submitted_at=later,
            first_submitted_at=first,
        )
        db.add_all([hole, kept])
        db.commit()
        hole_id, kept_id = hole.id, kept.id
    finally:
        db.close()

    apply_rfis_hole_backfill(dbmod.engine)
    apply_rfis_hole_backfill(dbmod.engine)

    db = dbmod.SessionLocal()
    try:
        filled = db.get(RFI, hole_id)
        sticky = db.get(RFI, kept_id)
        assert filled.first_submitted_at == first
        assert filled.submitted_at == first
        assert sticky.first_submitted_at == first
        assert sticky.submitted_at == later
    finally:
        db.close()


def test_cycle_due_at_copies_nulls_only_in_batches(client) -> None:
    due = datetime(2026, 2, 1, 17, 0, 0)
    other = due + timedelta(days=1)
    db = dbmod.SessionLocal()
    try:
        hole = RFI(
            project_id=str(PROJECT_ID),
            status="ball_in_court",
            subject="Hole cycle clock",
            question="Fill cycle_due_at from due_at only.",
            priority="standard",
            work_stopped=False,
            cost_impact="unknown",
            schedule_impact="unknown",
            due_at=due,
            cycle_due_at=None,
        )
        kept = RFI(
            project_id=str(PROJECT_ID),
            status="ball_in_court",
            subject="Live cycle clock",
            question="Do not overwrite a real cycle_due_at.",
            priority="standard",
            work_stopped=False,
            cost_impact="unknown",
            schedule_impact="unknown",
            due_at=other,
            cycle_due_at=due,
        )
        db.add_all([hole, kept])
        db.commit()
        hole_id, kept_id = hole.id, kept.id
    finally:
        db.close()

    apply_rfis_hole_backfill(dbmod.engine)
    apply_rfis_hole_backfill(dbmod.engine)

    db = dbmod.SessionLocal()
    try:
        filled = db.get(RFI, hole_id)
        sticky = db.get(RFI, kept_id)
        assert filled.cycle_due_at == due
        assert filled.due_at == due
        assert sticky.cycle_due_at == due
        assert sticky.due_at == other
    finally:
        db.close()


def test_backfill_does_not_renumber(client) -> None:
    db = dbmod.SessionLocal()
    try:
        row = RFI(
            project_id=str(PROJECT_ID),
            status="draft",
            subject="Do not invent a number",
            question="rfi_number stays null until PE submit.",
            priority="standard",
            work_stopped=False,
            cost_impact="unknown",
            schedule_impact="unknown",
            rfi_number=None,
        )
        db.add(row)
        db.commit()
        rfi_id = row.id
    finally:
        db.close()

    apply_rfis_hole_backfill(dbmod.engine)
    db = dbmod.SessionLocal()
    try:
        loaded = db.get(RFI, rfi_id)
        assert loaded.rfi_number is None
        plus = db.execute(text("SELECT rfi_number + 1000 FROM rfis WHERE id = :id"), {"id": rfi_id})
        assert plus.scalar() is None
    finally:
        db.close()


def test_cycle_due_without_source_stays_null(client) -> None:
    db = dbmod.SessionLocal()
    try:
        row = RFI(
            project_id=str(PROJECT_ID),
            status="draft",
            subject="No due_at source",
            question="Do not invent cycle_due_at when due_at is null.",
            priority="standard",
            work_stopped=False,
            cost_impact="unknown",
            schedule_impact="unknown",
            due_at=None,
            cycle_due_at=None,
        )
        db.add(row)
        db.commit()
        rfi_id = row.id
    finally:
        db.close()

    apply_rfis_hole_backfill(dbmod.engine)
    db = dbmod.SessionLocal()
    try:
        loaded = db.get(RFI, rfi_id)
        assert loaded.due_at is None
        assert loaded.cycle_due_at is None
    finally:
        db.close()
