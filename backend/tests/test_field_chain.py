"""Field chain is law. HTTP 403s, not UI hints."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app import db as dbmod
from sqlalchemy.exc import IntegrityError

from app.field_chain import FieldError, assign_person
from app.ids import (
    HARBOR_AREA_ROOF_ID,
    HARBOR_AREA_YARD_ID,
    HARBOR_TICKET_ID,
    PROJECT_ID,
    REV_S301_C_ID,
    USER_GREG_PE_ID,
    USER_HARBOR_AP_ID,
    USER_HARBOR_FM_ID,
    USER_HARBOR_JM_ID,
)
from app.models import ProjectAssignment, User
from tests.actors import actor_payload, field_headers
from tests.test_pe_submit import PE_HEADERS, _submit_body


def _db():
    return dbmod.SessionLocal()


def _envelope(note: str, role: str = "journeyman", **extra):
    payload = {
        "task": "preflight_rfi",
        "project": {"id": str(PROJECT_ID), "name": "Harbor Yard Warehouse"},
        "sheet_revision": {
            "id": str(REV_S301_C_ID),
            "sheet_number": "S301",
            "revision": "C",
            "discipline": "Structural",
        },
        "pin": {"x_norm": 0.33, "y_norm": 0.44, "label": "CHAIN"},
        "photos": [],
        "open_rfis_same_sheet": [],
        "user_note": note,
        "actor": actor_payload(role),
    }
    payload.update(extra)
    return payload


def _draft(client, note: str, role: str = "journeyman") -> str:
    created = client.post("/create_rfi_draft", json=_envelope(note, role))
    assert created.status_code == 200, created.text
    assert created.json()["ok"] is True
    assert created.json()["status"] == "draft"
    assert created.json()["rfi_display"] is None
    return created.json()["rfi_id"]


def test_unique_active_assignment_per_project_user(client):
    db = _db()
    try:
        with pytest.raises(IntegrityError):
            row = ProjectAssignment(
                project_id=str(PROJECT_ID),
                user_id=str(USER_HARBOR_JM_ID),
                role="journeyman",
                reports_to_user_id=str(USER_HARBOR_FM_ID),
                area_id=str(HARBOR_AREA_YARD_ID),
                active=True,
            )
            db.add(row)
            db.commit()
    finally:
        db.rollback()
        db.close()


def test_invalid_boss_skip_rank_wrong_area_inactive(client):
    db = _db()
    try:
        extra = User(name="Skip Rank", role="journeyman")
        db.add(extra)
        db.flush()
        with pytest.raises(FieldError, match="one step up"):
            assign_person(
                db,
                project_id=str(PROJECT_ID),
                user_id=extra.id,
                role="journeyman",
                reports_to_user_id=str(USER_GREG_PE_ID),
                area_id=str(HARBOR_AREA_YARD_ID),
            )
        with pytest.raises(FieldError, match="Area must match"):
            assign_person(
                db,
                project_id=str(PROJECT_ID),
                user_id=extra.id,
                role="journeyman",
                reports_to_user_id=str(USER_HARBOR_FM_ID),
                area_id=str(HARBOR_AREA_ROOF_ID),
            )
        fm = db.scalar(
            select(ProjectAssignment).where(
                ProjectAssignment.user_id == str(USER_HARBOR_FM_ID),
                ProjectAssignment.project_id == str(PROJECT_ID),
            )
        )
        fm.active = False
        db.commit()
        with pytest.raises(FieldError, match="active"):
            assign_person(
                db,
                project_id=str(PROJECT_ID),
                user_id=extra.id,
                role="journeyman",
                reports_to_user_id=str(USER_HARBOR_FM_ID),
                area_id=str(HARBOR_AREA_YARD_ID),
            )
        fm.active = True
        db.commit()
    finally:
        db.close()


def test_apprentice_403_on_draft_submit_work_stop(client):
    drafted = client.post(
        "/create_rfi_draft",
        json=_envelope("Hopper note about a missing embed plate.", "apprentice"),
    )
    assert drafted.status_code == 403
    detail = drafted.json()["detail"]
    if isinstance(detail, dict):
        assert detail == {"denied": True, "policy": "role_allows"}
        assert "reason" not in detail
        assert "steps" not in detail
        assert "trace" not in detail
    else:
        assert "Apprentice" in detail

    rfi_id = _draft(client, "Journeyman draft for apprentice 403 checks.")
    headers = {**PE_HEADERS, **field_headers("apprentice")}
    submit = client.post(
        f"/pe/rfis/{rfi_id}/submit", json=_submit_body(), headers=headers
    )
    assert submit.status_code == 403
    detail = submit.json()["detail"]
    assert detail["policy"] == "role_allows"
    assert "steps" not in detail
    assert "trace" not in detail
    stopped = client.post(
        f"/pe/rfis/{rfi_id}/set_priority",
        json={"priority": "work_stopped", "work_stopped": True},
        headers=headers,
    )
    assert stopped.status_code == 403


def test_journeyman_drafts_unnumbered_and_403_on_submit_work_stop(client):
    rfi_id = _draft(client, "Confirm beam seat at the dock for journeyman lane.")
    detail = client.get(f"/rfis/{rfi_id}").json()
    assert detail["status"] == "draft"
    assert detail["rfi_display"] is None

    headers = {**PE_HEADERS, **field_headers("journeyman")}
    submit = client.post(
        f"/pe/rfis/{rfi_id}/submit", json=_submit_body(), headers=headers
    )
    assert submit.status_code == 403
    detail = submit.json()["detail"]
    assert detail["policy"] == "role_allows"
    assert "steps" not in detail
    assert "trace" not in detail
    stopped = client.post(
        f"/pe/rfis/{rfi_id}/set_priority",
        json={"priority": "work_stopped", "work_stopped": True},
        headers=headers,
    )
    assert stopped.status_code == 403


def test_foreman_403_on_void_and_ungranted_work_stop(client):
    rfi_id = _draft(client, "Foreman lane void and ungranted work-stop.")
    headers = {**PE_HEADERS, **field_headers("foreman")}
    approve = client.post(
        f"/pe/rfis/{rfi_id}/approve_internal_review", json={}, headers=headers
    )
    assert approve.status_code == 200
    stopped = client.post(
        f"/pe/rfis/{rfi_id}/submit",
        json=_submit_body(priority="work_stopped", work_stopped=True),
        headers=headers,
    )
    assert stopped.status_code == 403
    voided = client.post(f"/pe/rfis/{rfi_id}/void", headers=headers)
    assert voided.status_code == 403


def test_area_cannot_work_stop_another_area_gf_can(client):
    rfi_id = _draft(client, "Area-scoped work-stop on a Yard draft.")
    roof = {**PE_HEADERS, **field_headers("roof_area_foreman")}
    denied = client.post(
        f"/pe/rfis/{rfi_id}/set_priority",
        json={"priority": "work_stopped", "work_stopped": True},
        headers=roof,
    )
    assert denied.status_code == 403
    gf = {**PE_HEADERS, **field_headers("general_foreman")}
    allowed = client.post(
        f"/pe/rfis/{rfi_id}/set_priority",
        json={"priority": "work_stopped", "work_stopped": True},
        headers=gf,
    )
    assert allowed.status_code == 200
    assert allowed.json()["priority"] == "work_stopped"


def test_grok_out_of_lane_submit_assign_work_stop(client):
    for extra in (
        {"actor": {**actor_payload("journeyman"), "action": "submit"}},
        {"actor": {**actor_payload("foreman"), "action": "assign_hopper"}},
        {"actor": {**actor_payload("area_foreman"), "action": "work_stop"}},
    ):
        response = client.post(
            "/create_rfi_draft",
            json=_envelope("Please submit this and stop work.", **extra),
        )
        assert response.status_code == 403
        assert "out of lane" in response.json()["detail"]


def test_grok_create_as_journeyman_stays_draft(client):
    rfi_id = _draft(client, "Grokbot draft from a journeyman stays unnumbered.")
    body = client.get(f"/rfis/{rfi_id}").json()
    assert body["status"] == "draft"
    assert body["rfi_number"] is None
    assert body["rfi_display"] is None


def test_apprentice_can_handle_assigned_ticket_not_draft_order(client):
    listed = client.get(
        "/field/tickets",
        params={"project_id": str(PROJECT_ID), "user_id": str(USER_HARBOR_AP_ID)},
    )
    assert listed.status_code == 200
    ids = {row["id"] for row in listed.json()["tickets"]}
    assert str(HARBOR_TICKET_ID) in ids

    denied = client.post(
        "/create_rfi_draft",
        json=_envelope("Apprentice trying to draft an order as an RFI.", "apprentice"),
    )
    assert denied.status_code == 403

    handled = client.post(
        f"/field/material_orders/{HARBOR_TICKET_ID}/handle",
        headers=field_headers("apprentice"),
    )
    assert handled.status_code == 200
    assert handled.json()["status"] == "handled"


def test_foreman_may_submit_after_human_click(client):
    rfi_id = _draft(client, "Foreman human submit after Grok draft.")
    headers = {**PE_HEADERS, **field_headers("foreman")}
    client.post(f"/pe/rfis/{rfi_id}/approve_internal_review", json={}, headers=headers)
    submitted = client.post(
        f"/pe/rfis/{rfi_id}/submit",
        json=_submit_body(),
        headers=headers,
    )
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "ball_in_court"
    assert submitted.json()["rfi_display"]
