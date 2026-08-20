from sqlalchemy import select

from app import db as dbmod
from app.ids import PROJECT_ID, REV_S301_C_ID
from app.models import RFIEvent
from tests.actors import actor_payload


def _envelope(**overrides):
    payload = {
        "task": "preflight_rfi",
        "project": {"id": str(PROJECT_ID), "name": "Harbor Yard Warehouse"},
        "sheet_revision": {
            "id": str(REV_S301_C_ID),
            "sheet_number": "S301",
            "revision": "C",
            "discipline": "Structural",
        },
        "pin": {"x_norm": 0.41, "y_norm": 0.70, "label": "B-4"},
        "photos": [],
        "open_rfis_same_sheet": [],
        "user_note": "Beam at grid B-4 appears to conflict with the duct. Please confirm clearance.",
        "actor": actor_payload("journeyman"),
    }
    payload.update(overrides)
    return payload


def test_create_draft_success_has_no_human_number(client):
    response = client.post("/create_rfi_draft", json=_envelope())
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["status"] == "draft"
    assert body["rfi_display"] is None
    assert "internal_review" in body["missing_for_submit"]
    assert body["rfi_id"]

    detail = client.get(f"/rfis/{body['rfi_id']}")
    assert detail.status_code == 200
    rfi = detail.json()
    assert rfi["status"] == "draft"
    assert rfi["rfi_number"] is None
    assert rfi["rfi_display"] is None
    assert rfi["priority"] in ("standard", "urgent")
    assert rfi["priority"] != "work_stopped"
    assert rfi["cost_impact"]
    assert rfi["schedule_impact"]
    assert rfi["proposed_solution"]
    assert "S301" in rfi["question"]
    assert "Rev C" in rfi["question"]
    assert "B-4" in rfi["question"]
    assert "not a change order" in rfi["question"].lower()
    assert rfi["grok_preflight"]["envelope"]["task"] == "preflight_rfi"
    assert rfi["pins"][0]["sheet_revision_id"] == str(REV_S301_C_ID)
    assert 0 <= rfi["pins"][0]["x_norm"] <= 1

    db = dbmod.SessionLocal()
    try:
        events = list(
            db.scalars(select(RFIEvent).where(RFIEvent.rfi_id == body["rfi_id"]))
        )
        assert len(events) == 1
        assert events[0].event_type == "status_change"
        assert events[0].from_status is None
        assert events[0].to_status == "draft"
    finally:
        db.close()


def test_create_draft_rejects_forbidden_and_extra_keys(client):
    for key, value in {
        "status": "submitted",
        "rfi_number": 47,
        "rfi_display": "RFI-0047",
        "due_at": "2026-08-21T00:00:00Z",
        "official_response": "Proceed",
        "submitted_at": "2026-08-20T00:00:00Z",
        "closed_at": "2026-08-20T00:00:00Z",
        "work_stopped": True,
        "first_submitted_at": "2026-08-20T00:00:00Z",
    }.items():
        payload = _envelope()
        payload[key] = value
        response = client.post("/create_rfi_draft", json=payload)
        assert response.status_code == 422, key

    extra = _envelope()
    extra["spec_section"] = "03 30 00"
    response = client.post("/create_rfi_draft", json=extra)
    assert response.status_code == 422


def test_create_draft_rejects_status_on_pin(client):
    payload = _envelope()
    payload["pin"]["status"] = "submitted"
    response = client.post("/create_rfi_draft", json=payload)
    assert response.status_code == 422


def test_create_draft_honors_open_rfis_from_search(client):
    first = client.post("/create_rfi_draft", json=_envelope())
    assert first.status_code == 200
    payload = _envelope(user_note="Different wording on the same clash.")
    payload["open_rfis_same_sheet"] = [
        {
            "id": first.json()["rfi_id"],
            "status": "draft",
            "subject": "existing",
            "sheet_number": "S301",
            "grid": "B-4",
        }
    ]
    second = client.post("/create_rfi_draft", json=payload)
    assert second.status_code == 200
    assert second.json()["duplicate"] is True
    assert second.json()["rfi_id"] == first.json()["rfi_id"]


def test_create_draft_requires_note_and_anchor(client):
    no_note = _envelope(user_note="")
    assert client.post("/create_rfi_draft", json=no_note).status_code == 422

    no_anchor = _envelope()
    no_anchor.pop("sheet_revision")
    no_anchor.pop("pin")
    assert client.post("/create_rfi_draft", json=no_anchor).status_code == 422


def test_create_draft_rejects_multiple_questions(client):
    payload = _envelope(
        user_note="Is the beam correct? Also, where does the duct go?"
    )
    response = client.post("/create_rfi_draft", json=payload)
    assert response.status_code == 422
    assert "One question" in response.json()["detail"]


def test_create_draft_never_sets_work_stopped(client):
    payload = _envelope(
        user_note="Work stop at grid B-4 until the beam and duct clearance is confirmed."
    )
    response = client.post("/create_rfi_draft", json=payload)
    assert response.status_code == 200
    rfi = client.get(f"/rfis/{response.json()['rfi_id']}").json()
    assert rfi["priority"] == "urgent"
    assert rfi["priority"] != "work_stopped"


def test_create_draft_stops_on_open_duplicate(client):
    first = client.post("/create_rfi_draft", json=_envelope())
    assert first.status_code == 200
    first_id = first.json()["rfi_id"]

    second = client.post(
        "/create_rfi_draft",
        json=_envelope(user_note="Please confirm the beam and duct at this location."),
    )
    assert second.status_code == 200
    body = second.json()
    assert body["ok"] is False
    assert body["duplicate"] is True
    assert body["rfi_id"] == first_id
    assert body["status"] == "draft"
    assert body["rfi_display"] is None
