"""Design official-response HTTP. Not a Grok tool. Fresh DB per test."""

from __future__ import annotations

from sqlalchemy import select, text

from app import db as dbmod
from app.ids import (
    COMPANY_SAMPLE_AE_ID,
    ILSB_RFI_ID,
    PROJECT_ID,
    REV_S301_C_ID,
    SAMPLE_ON_CYCLE_ID,
    SAMPLE_WORK_STOPPED_ID,
    USER_SAMPLE_AE_ID,
)
from app.models import RFIEvent
from app.pe import ANSWER_DISCLAIMER

PE_HEADERS = {"X-Field-Actor": "pe", "X-PE-Token": "pe-demo"}
DESIGN_HEADERS = {"X-Field-Actor": "design", "X-Design-Token": "design-demo"}
GC_HEADERS = {"X-Field-Actor": "gc", "X-GC-Token": "gc-demo"}


def _new_bic(client) -> str:
    note = "Confirm embed plate thickness at the dock on S301 Rev C for design answer."
    search = client.get(
        "/search_rfis",
        params={"project_id": str(PROJECT_ID), "sheet_number": "S301", "query": note[:80]},
    )
    assert search.json()["count"] == 0
    created = client.post(
        "/create_rfi_draft",
        json={
            "task": "preflight_rfi",
            "project": {"id": str(PROJECT_ID), "name": "Harbor Yard Warehouse"},
            "sheet_revision": {
                "id": str(REV_S301_C_ID),
                "sheet_number": "S301",
                "revision": "C",
                "discipline": "Structural",
            },
            "pin": {"x_norm": 0.31, "y_norm": 0.42, "label": "DESIGN-HTTP"},
            "photos": [],
            "open_rfis_same_sheet": [],
            "user_note": note,
            "actor": {
                "user_id": "aaaaaaaa-0000-4000-8000-000000000323",
                "role": "journeyman",
            },
        },
    )
    assert created.json()["ok"] is True
    rfi_id = created.json()["rfi_id"]
    assert created.json()["rfi_display"] is None
    approve = client.post(
        f"/pe/rfis/{rfi_id}/approve_internal_review", json={}, headers=PE_HEADERS
    )
    assert approve.status_code == 200
    submitted = client.post(
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
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "ball_in_court"
    return rfi_id


def _events(rfi_id: str) -> list[RFIEvent]:
    db = dbmod.SessionLocal()
    try:
        return list(
            db.scalars(
                select(RFIEvent)
                .where(RFIEvent.rfi_id == rfi_id)
                .order_by(RFIEvent.created_at, text("rowid"))
            )
        )
    finally:
        db.close()


def test_design_and_gc_routes_require_tokens(client):
    rfi_id = str(SAMPLE_ON_CYCLE_ID)
    assert client.post(
        f"/design/rfis/{rfi_id}/official_response",
        json={"official_response": "Use the curb as drawn."},
    ).status_code == 403
    assert client.post(
        f"/design/rfis/{rfi_id}/official_response",
        json={"official_response": "Use the curb as drawn."},
        headers={"X-Field-Actor": "design", "X-Design-Token": "nope"},
    ).status_code == 403
    assert client.post(
        f"/design/rfis/{rfi_id}/official_response",
        json={"official_response": "Use the curb as drawn."},
        headers=PE_HEADERS,
    ).status_code == 403
    assert client.post(
        f"/gc/rfis/{rfi_id}/start_impact_review", headers=DESIGN_HEADERS
    ).status_code == 403
    assert client.post("/submit_rfi", json={"rfi_id": rfi_id}).status_code == 404
    still = client.get(f"/rfis/{rfi_id}").json()
    assert still["status"] == "ball_in_court"
    e803 = client.get(f"/rfis/{ILSB_RFI_ID}").json()
    assert e803["status"] == "draft"
    assert e803["rfi_display"] is None


def test_design_answer_then_gc_impact_review(client):
    rfi_id = _new_bic(client)
    answered = client.post(
        f"/design/rfis/{rfi_id}/official_response",
        json={"official_response": "Revise the embed to match S301 Rev C. Hold extra work."},
        headers=DESIGN_HEADERS,
    )
    assert answered.status_code == 200
    body = answered.json()
    assert body["ok"] is True
    assert body["status"] == "answered"
    assert body["responded_at"]
    assert ANSWER_DISCLAIMER.lower() in body["official_response"].lower()
    assert body["disclaimer"] == ANSWER_DISCLAIMER
    assert body["work_stopped"] is False
    assert body["priority"] == "standard"

    detail = client.get(f"/rfis/{rfi_id}").json()
    assert detail["status"] == "answered"
    assert detail["responded_at"]
    assert "not a change order" in detail["official_response"].lower()
    assert "does not authorize work" in detail["official_response"].lower()

    statuses = [event.to_status for event in _events(rfi_id) if event.event_type == "status_change"]
    assert "answered" in statuses
    answer_event = next(
        event
        for event in _events(rfi_id)
        if event.event_type == "status_change" and event.to_status == "answered"
    )
    assert answer_event.payload["actor"] == "design"
    assert answer_event.payload["source"] == "design_http"

    graph = client.get("/rfi_graph").json()
    row = next(item for item in graph["open"] if item["id"] == rfi_id)
    assert row["status"] == "answered"
    assert row["age_bucket"] == "gc_holding"

    impact = client.post(f"/gc/rfis/{rfi_id}/start_impact_review", headers=GC_HEADERS)
    assert impact.status_code == 200
    assert impact.json()["status"] == "impact_review"
    assert impact.json()["assigned"] == "Castro GC"
    after = client.get(f"/rfis/{rfi_id}").json()
    assert after["status"] == "impact_review"
    assert after["priority"] == "standard"
    assert after["official_response"]
    e803 = next(
        item for item in client.get("/rfi_graph").json()["drafts"] if item["id"] == str(ILSB_RFI_ID)
    )
    assert e803["rfi_display"] is None
    assert e803["status"] == "draft"


def test_design_clarification_sets_gc_holding(client):
    rfi_id = str(SAMPLE_ON_CYCLE_ID)
    clarify = client.post(
        f"/design/rfis/{rfi_id}/request_clarification",
        json={"note": "Need a field photo of the curb before we can answer."},
        headers=DESIGN_HEADERS,
    )
    assert clarify.status_code == 200
    assert clarify.json()["status"] == "needs_clarification"
    detail = client.get(f"/rfis/{rfi_id}").json()
    assert detail["status"] == "needs_clarification"
    assert detail["priority"] == "standard"
    graph = client.get("/rfi_graph").json()
    held = next(row for row in graph["open"] if row["id"] == rfi_id)
    assert held["age_bucket"] == "gc_holding"
    assert held["work_stopped"] is False
    event = next(
        row
        for row in _events(rfi_id)
        if row.event_type == "status_change" and row.to_status == "needs_clarification"
    )
    assert event.payload["actor"] == "design"
    assert event.payload["source"] == "design_http"


def test_cannot_answer_a_draft(client):
    blocked = client.post(
        f"/design/rfis/{ILSB_RFI_ID}/official_response",
        json={"official_response": "Use E-803 Rev 27."},
        headers=DESIGN_HEADERS,
    )
    assert blocked.status_code == 422
    assert "draft" in blocked.json()["detail"]
    still = client.get(f"/rfis/{ILSB_RFI_ID}").json()
    assert still["status"] == "draft"
    assert still["rfi_display"] is None
    assert still["official_response"] is None


def test_empty_answer_rejected_and_disclaimer_persisted(client):
    rfi_id = str(SAMPLE_ON_CYCLE_ID)
    empty = client.post(
        f"/design/rfis/{rfi_id}/official_response",
        json={"official_response": "   "},
        headers=DESIGN_HEADERS,
    )
    assert empty.status_code == 422
    answered = client.post(
        f"/design/rfis/{rfi_id}/official_response",
        json={"official_response": "Curb height as drawn on S302 Rev A."},
        headers=DESIGN_HEADERS,
    )
    assert answered.status_code == 200
    text = answered.json()["official_response"].lower()
    assert ANSWER_DISCLAIMER.lower() in text
    assert "not a change order" in text
    assert "does not authorize work" in text


def test_design_does_not_set_work_stopped(client):
    rfi_id = str(SAMPLE_WORK_STOPPED_ID)
    rejected = client.post(
        f"/design/rfis/{rfi_id}/official_response",
        json={"official_response": "Hold.", "work_stopped": True, "priority": "work_stopped"},
        headers=DESIGN_HEADERS,
    )
    assert rejected.status_code == 422
    before = client.get(f"/rfis/{rfi_id}").json()
    assert before["priority"] == "work_stopped"
    answered = client.post(
        f"/design/rfis/{rfi_id}/official_response",
        json={"official_response": "Hold the column line C embed. Use the grade beam as drawn."},
        headers=DESIGN_HEADERS,
    )
    assert answered.status_code == 200
    assert answered.json()["priority"] == "work_stopped"
    assert answered.json()["work_stopped"] is True
    after = client.get(f"/rfis/{rfi_id}").json()
    assert after["priority"] == "work_stopped"
    assert after["work_stopped"] is True
