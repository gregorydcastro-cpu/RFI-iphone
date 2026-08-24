"""rfis work_stopped ↔ priority CHECK. Not Grafana. Not coverage walks."""

from __future__ import annotations

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from app import db as dbmod
from app.coverage_schema import CURRENT_SCHEMA
from app.ids import PROJECT_ID
from app.models import RFI
from app.pe import PEError, set_priority, write_priority_pair


def test_current_schema_stays_2() -> None:
    assert CURRENT_SCHEMA == 2


def test_rfis_has_work_stopped_column_and_project_status_index(client) -> None:
    insp = inspect(dbmod.engine)
    columns = {col["name"] for col in insp.get_columns("rfis")}
    indexes = {idx["name"] for idx in insp.get_indexes("rfis")}
    assert "work_stopped" in columns
    assert "rfis_project_status_idx" in indexes


def test_mismatched_work_stopped_pair_is_rejected(client) -> None:
    db = dbmod.SessionLocal()
    try:
        db.add(
            RFI(
                project_id=str(PROJECT_ID),
                status="draft",
                subject="Illegal pair",
                question="Must not persist a split work_stopped/priority pair.",
                priority="standard",
                work_stopped=True,
                cost_impact="unknown",
                schedule_impact="unknown",
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
    finally:
        db.rollback()
        db.close()


def test_set_priority_writes_the_pair(client) -> None:
    db = dbmod.SessionLocal()
    try:
        row = RFI(
            project_id=str(PROJECT_ID),
            status="draft",
            subject="Pair writer",
            question="Only set_priority writes work_stopped with priority.",
            priority="standard",
            work_stopped=False,
            cost_impact="unknown",
            schedule_impact="unknown",
        )
        db.add(row)
        db.commit()
        rfi_id = row.id
    finally:
        db.close()

    db = dbmod.SessionLocal()
    try:
        set_priority(db, rfi_id, "work_stopped", True)
        loaded = db.get(RFI, rfi_id)
        assert loaded.priority == "work_stopped"
        assert loaded.work_stopped
    finally:
        db.close()

    db = dbmod.SessionLocal()
    try:
        with pytest.raises(PEError, match="allow_demote"):
            set_priority(db, rfi_id, "standard", False, allow_demote=False)
    finally:
        db.close()

    db = dbmod.SessionLocal()
    try:
        set_priority(db, rfi_id, "standard", False, allow_demote=True)
        loaded = db.get(RFI, rfi_id)
        assert loaded.priority == "standard"
        assert not loaded.work_stopped
    finally:
        db.close()


def test_write_priority_pair_is_the_biconditional() -> None:
    row = RFI(
        project_id=str(PROJECT_ID),
        status="draft",
        subject="In memory",
        question="Pair helper stays a biconditional.",
        priority="urgent",
        work_stopped=False,
        cost_impact="unknown",
        schedule_impact="unknown",
    )
    write_priority_pair(row, "work_stopped")
    assert row.priority == "work_stopped"
    assert row.work_stopped is True
    write_priority_pair(row, "urgent")
    assert row.priority == "urgent"
    assert row.work_stopped is False
