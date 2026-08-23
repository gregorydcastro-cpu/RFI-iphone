"""Two named invariants. Not coverage-schema. Not Grafana."""

from __future__ import annotations

import inspect

from sqlalchemy.exc import IntegrityError

import pytest

from abac import AccessDenied, Action, HUNG_WRITES, Role, require_access
from app import db as dbmod
from app.coverage_schema import CURRENT_SCHEMA
from app.ids import COMPANY_SAMPLE_AE_ID, PROJECT_ID, REV_E101_A_ID, USER_SAMPLE_AE_ID
from app.models import RFI
from app.pe import PEError, request_clarification, set_priority
from app.rfi import WORK_STOPPED_PRIORITY, is_first_submit, pair_holds
from tests.actors import actor_payload, clear_seeded_shop_draft
from tests.conftest import resource, subject

evaluate = None

PE_HEADERS = {"X-Field-Actor": "pe", "X-PE-Token": "pe-demo"}


def _envelope(note: str) -> dict:
    return {
        "task": "preflight_rfi",
        "project": {"id": str(PROJECT_ID), "name": "G-Line Shop Test"},
        "sheet_revision": {
            "id": str(REV_E101_A_ID),
            "sheet_number": "E-101",
            "revision": "A",
            "discipline": "E",
        },
        "pin": {"x_norm": 0.22, "y_norm": 0.33, "label": "INV"},
        "photos": [],
        "open_rfis_same_sheet": [],
        "user_note": note,
        "actor": actor_payload("journeyman"),
    }


def test_current_schema_stays_2() -> None:
    assert CURRENT_SCHEMA == 2


def test_three_writes_still_hang_require_access() -> None:
    from app import main

    assert HUNG_WRITES == frozenset(
        {"create_rfi_draft", "submit_rfi", "set_priority"}
    )
    for src in (
        inspect.getsource(main.create_rfi_draft),
        inspect.getsource(main.submit_rfi),
        inspect.getsource(main.pe_set_priority),
    ):
        assert "require_access(" in src
        assert src.index("require_access(") < src.index("except AccessDenied")


def test_invariant_1_pair_holds_on_create_edit_and_db(client) -> None:
    assert pair_holds("work_stopped", True)
    assert pair_holds("standard", False)
    assert pair_holds("urgent", False)
    assert not pair_holds("standard", True)
    assert not pair_holds("urgent", True)
    assert not pair_holds("work_stopped", False)

    clear_seeded_shop_draft()
    created = client.post(
        "/create_rfi_draft",
        json=_envelope("Confirm curb height at the dock for invariant 1."),
    )
    assert created.status_code == 200
    rfi_id = created.json()["rfi_id"]
    draft = client.get(f"/rfis/{rfi_id}").json()
    assert pair_holds(draft["priority"], draft["work_stopped"])
    assert draft["priority"] != WORK_STOPPED_PRIORITY
    assert draft["work_stopped"] is False

    db = dbmod.SessionLocal()
    try:
        set_priority(db, rfi_id, "work_stopped", True)
        loaded = db.get(RFI, rfi_id)
        assert pair_holds(loaded.priority, loaded.work_stopped)
        assert loaded.priority == WORK_STOPPED_PRIORITY
        assert loaded.work_stopped is True
        with pytest.raises(PEError, match="allow_demote"):
            set_priority(db, rfi_id, "standard", False, allow_demote=False)
        set_priority(db, rfi_id, "urgent", False, allow_demote=True)
        loaded = db.get(RFI, rfi_id)
        assert pair_holds(loaded.priority, loaded.work_stopped)
        assert loaded.priority == "urgent"
        assert loaded.work_stopped is False
    finally:
        db.close()

    db = dbmod.SessionLocal()
    try:
        db.add(
            RFI(
                project_id=str(PROJECT_ID),
                status="draft",
                subject="Split pair",
                question="DB CHECK rejects work_stopped without the priority.",
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


def test_invariant_1_grokbot_cannot_set_work_stopped(client) -> None:
    payload = _envelope("Work is stopped until the beam seat is confirmed.")
    payload["work_stopped"] = True
    denied = client.post("/create_rfi_draft", json=payload)
    assert denied.status_code == 422

    clear_seeded_shop_draft()
    ok = client.post(
        "/create_rfi_draft",
        json=_envelope("Work is stopped until the beam seat is confirmed on E-101."),
    )
    assert ok.status_code == 200
    rfi = client.get(f"/rfis/{ok.json()['rfi_id']}").json()
    assert rfi["priority"] != WORK_STOPPED_PRIORITY
    assert rfi["work_stopped"] is False
    assert pair_holds(rfi["priority"], rfi["work_stopped"])


def test_invariant_2_number_only_on_first_submit_and_stays(client) -> None:
    clear_seeded_shop_draft()
    created = client.post(
        "/create_rfi_draft",
        json=_envelope("Confirm stair landing thickness on E-101 Rev A for numbering."),
    )
    assert created.status_code == 200
    rfi_id = created.json()["rfi_id"]
    draft = client.get(f"/rfis/{rfi_id}").json()
    assert draft["status"] == "draft"
    assert draft["rfi_number"] is None
    assert draft["rfi_display"] is None

    db = dbmod.SessionLocal()
    try:
        row = db.get(RFI, rfi_id)
        assert is_first_submit(row)
        assert row.first_submitted_at is None
    finally:
        db.close()

    client.post(f"/pe/rfis/{rfi_id}/approve_internal_review", json={}, headers=PE_HEADERS)
    first = client.post(
        f"/pe/rfis/{rfi_id}/submit",
        json={
            "priority": "standard",
            "work_stopped": False,
            "require_internal_review": True,
            "assigned_to_user_id": str(USER_SAMPLE_AE_ID),
            "assigned_to_company_id": str(COMPANY_SAMPLE_AE_ID),
        },
        headers=PE_HEADERS,
    )
    assert first.status_code == 200
    numbered = first.json()
    assert numbered["first_submit"] is True
    assert numbered["rfi_number"] is not None
    assert numbered["rfi_display"].startswith("RFI-")
    kept_number = numbered["rfi_number"]
    kept_display = numbered["rfi_display"]

    db = dbmod.SessionLocal()
    try:
        row = db.get(RFI, rfi_id)
        assert not is_first_submit(row)
        assert row.rfi_number == kept_number
        first_clock = row.first_submitted_at
        assert first_clock is not None
        request_clarification(db, rfi_id, "Need a field photo before close.")
    finally:
        db.close()

    holding = client.get(f"/rfis/{rfi_id}").json()
    assert holding["status"] == "needs_clarification"
    assert holding["rfi_number"] == kept_number
    assert holding["rfi_display"] == kept_display

    second = client.post(
        f"/pe/rfis/{rfi_id}/submit",
        json={
            "priority": "standard",
            "work_stopped": False,
            "require_internal_review": True,
            "assigned_to_user_id": str(USER_SAMPLE_AE_ID),
            "assigned_to_company_id": str(COMPANY_SAMPLE_AE_ID),
            "comment": "Resubmit after photo.",
        },
        headers=PE_HEADERS,
    )
    assert second.status_code == 200
    again = second.json()
    assert again["first_submit"] is False
    assert again["rfi_number"] == kept_number
    assert again["rfi_display"] == kept_display

    db = dbmod.SessionLocal()
    try:
        row = db.get(RFI, rfi_id)
        assert row.rfi_number == kept_number
        assert row.first_submitted_at == first_clock
    finally:
        db.close()

    sql = (dbmod.ROOT / "app" / "sql" / "rfis_backfill_holes.sql").read_text()
    assert "rfi_number" not in sql
    assert "first_submitted_at = submitted_at" in sql
    assert "first_submitted_at IS NULL" in sql


def test_apprentice_still_stops_at_role_allows() -> None:
    with pytest.raises(AccessDenied) as raised:
        require_access(subject(role=Role.APPRENTICE), Action.SUBMIT_RFI, resource())
    assert raised.value.decision.policy == "role_allows"
