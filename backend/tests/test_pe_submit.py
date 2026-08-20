"""PE HTTP submit. Not a Grok tool. Fresh DB per test via conftest."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select, text

from app import db as dbmod
from app.ids import (
    COMPANY_SAMPLE_AE_ID,
    ILSB_PROJECT_ID,
    ILSB_REV_27_ID,
    ILSB_RFI_ID,
    PROJECT_ID,
    REV_S301_C_ID,
    REV_S302_A_ID,
    SAMPLE_OVERDUE_ID,
    USER_SAMPLE_AE_ID,
)
from app.models import RFI, RFIEvent, RFIPin, RFIRef
from app.pe import DUE_AT_RULE, PRIORITY_CONFIRM_COMMENT, request_clarification

PE_HEADERS = {"X-Field-Actor": "pe", "X-PE-Token": "pe-demo"}


def _envelope(note: str, **overrides):
    payload = {
        "task": "preflight_rfi",
        "project": {"id": str(PROJECT_ID), "name": "Harbor Yard Warehouse"},
        "sheet_revision": {
            "id": str(REV_S301_C_ID),
            "sheet_number": "S301",
            "revision": "C",
            "discipline": "Structural",
        },
        "pin": {"x_norm": 0.33, "y_norm": 0.44, "label": "PE-HTTP"},
        "photos": [],
        "open_rfis_same_sheet": [],
        "user_note": note,
    }
    payload.update(overrides)
    return payload


def _new_draft(client, note: str, *, sheet: str = "S301") -> str:
    revision = {
        "S301": {
            "id": str(REV_S301_C_ID),
            "sheet_number": "S301",
            "revision": "C",
            "discipline": "Structural",
        },
        "S302": {
            "id": str(REV_S302_A_ID),
            "sheet_number": "S302",
            "revision": "A",
            "discipline": "Structural",
        },
    }[sheet]
    search = client.get(
        "/search_rfis",
        params={"project_id": str(PROJECT_ID), "sheet_number": sheet, "query": note[:80]},
    )
    assert search.status_code == 200
    assert search.json()["count"] == 0
    created = client.post(
        "/create_rfi_draft",
        json=_envelope(note, sheet_revision=revision, pin={"x_norm": 0.33, "y_norm": 0.44, "label": "PE-HTTP"}),
    )
    assert created.status_code == 200
    body = created.json()
    assert body["ok"] is True
    assert body["status"] == "draft"
    assert body["rfi_display"] is None
    return body["rfi_id"]


def _submit_body(**overrides):
    body = {
        "priority": "standard",
        "work_stopped": False,
        "require_internal_review": True,
        "assigned_to_user_id": str(USER_SAMPLE_AE_ID),
        "assigned_to_company_id": str(COMPANY_SAMPLE_AE_ID),
        "comment": "PE submit from HTTP test.",
    }
    body.update(overrides)
    return body


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


def test_pe_http_approve_then_submit_new_draft(client):
    rfi_id = _new_draft(client, "Confirm embed plate thickness at the dock on S301 Rev C.")
    draft = client.get(f"/rfis/{rfi_id}").json()
    assert draft["status"] == "draft"
    assert draft["rfi_display"] is None
    assert draft["priority"] != "work_stopped"
    assert "internal_review" in draft["missing_for_submit"]

    denied = client.post(f"/pe/rfis/{rfi_id}/approve_internal_review", json={})
    assert denied.status_code == 403

    approve = client.post(
        f"/pe/rfis/{rfi_id}/approve_internal_review", json={}, headers=PE_HEADERS
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "internal_review"
    assert approve.json()["rfi_display"] is None

    graph_mid = client.get("/rfi_graph").json()
    draft_ids = {row["id"] for row in graph_mid["drafts"]}
    open_ids = {row["id"] for row in graph_mid["open"]}
    assert rfi_id in draft_ids
    assert rfi_id not in open_ids

    submitted = client.post(
        f"/pe/rfis/{rfi_id}/submit", json=_submit_body(), headers=PE_HEADERS
    )
    assert submitted.status_code == 200
    body = submitted.json()
    assert body["ok"] is True
    assert body["first_submit"] is True
    assert body["status"] == "ball_in_court"
    assert body["rfi_display"] and body["rfi_display"].startswith("RFI-")
    assert body["due_at"]
    assert body["submitted_at"]
    assert body["assigned"]
    assert body["assigned_to_user_id"] == str(USER_SAMPLE_AE_ID)
    assert body["work_stopped"] is False
    assert "America/New_York" in body["due_at_rule"]
    assert DUE_AT_RULE.split(";")[0] in body["due_at_rule"]

    detail = client.get(f"/rfis/{rfi_id}").json()
    assert detail["status"] == "ball_in_court"
    assert detail["rfi_display"] == body["rfi_display"]
    assert detail["priority"] == "standard"
    assert detail["work_stopped"] is False

    statuses = [event.to_status for event in _events(rfi_id) if event.event_type == "status_change"]
    assert statuses[0] == "draft"
    assert statuses[-1] == "ball_in_court"
    assert statuses.index("submitted") < statuses.index("ball_in_court")
    submit_event = next(
        event
        for event in _events(rfi_id)
        if event.event_type == "status_change" and event.to_status == "submitted"
    )
    assert submit_event.payload["source"] == "pe_http"
    assert submit_event.payload["priority_comment"] == PRIORITY_CONFIRM_COMMENT

    graph = client.get("/rfi_graph").json()
    open_ids = {row["id"] for row in graph["open"]}
    draft_ids = {row["id"] for row in graph["drafts"]}
    assert rfi_id in open_ids
    assert rfi_id not in draft_ids
    numbered = next(row for row in graph["open"] if row["id"] == rfi_id)
    assert numbered["rfi_display"].startswith("RFI-")
    e803 = next(row for row in graph["drafts"] if row["id"] == str(ILSB_RFI_ID))
    assert e803["rfi_display"] is None
    assert e803["status"] == "draft"


def test_cannot_submit_without_pe_credentials_or_grok_tool(client):
    rfi_id = _new_draft(client, "Confirm stair landing thickness on S301 Rev C for PE auth.")
    client.post(f"/pe/rfis/{rfi_id}/approve_internal_review", json={}, headers=PE_HEADERS)
    missing = client.post(f"/pe/rfis/{rfi_id}/submit", json=_submit_body())
    assert missing.status_code == 403
    wrong = client.post(
        f"/pe/rfis/{rfi_id}/submit",
        json=_submit_body(),
        headers={"X-Field-Actor": "pe", "X-PE-Token": "nope"},
    )
    assert wrong.status_code == 403
    grok = client.post("/submit_rfi", json={"rfi_id": rfi_id})
    assert grok.status_code == 404
    still = client.get(f"/rfis/{rfi_id}").json()
    assert still["status"] == "internal_review"
    assert still["rfi_display"] is None


def test_cannot_submit_empty_question_or_without_pin_or_ref(client):
    db = dbmod.SessionLocal()
    try:
        empty = RFI(
            project_id=str(PROJECT_ID),
            status="internal_review",
            subject="Empty question",
            question="   ",
            priority="standard",
            cost_impact="unknown",
            schedule_impact="unknown",
        )
        db.add(empty)
        db.flush()
        db.add(
            RFIPin(
                rfi_id=empty.id,
                sheet_revision_id=str(REV_S301_C_ID),
                x_norm=0.2,
                y_norm=0.3,
            )
        )
        bare = RFI(
            project_id=str(PROJECT_ID),
            status="internal_review",
            subject="No pin or ref",
            question="What is the intended curb height?",
            priority="standard",
            cost_impact="unknown",
            schedule_impact="unknown",
        )
        db.add(bare)
        db.commit()
        empty_id, bare_id = empty.id, bare.id
    finally:
        db.close()

    empty_res = client.post(
        f"/pe/rfis/{empty_id}/submit", json=_submit_body(), headers=PE_HEADERS
    )
    assert empty_res.status_code == 422
    assert "Question" in empty_res.json()["detail"]

    bare_res = client.post(
        f"/pe/rfis/{bare_id}/submit", json=_submit_body(), headers=PE_HEADERS
    )
    assert bare_res.status_code == 422
    assert "pin" in bare_res.json()["detail"].lower() or "ref" in bare_res.json()["detail"].lower()


def test_cannot_submit_from_ball_in_court(client):
    blocked = client.post(
        f"/pe/rfis/{SAMPLE_OVERDUE_ID}/submit",
        json=_submit_body(),
        headers=PE_HEADERS,
    )
    assert blocked.status_code == 422
    assert "ball_in_court" in blocked.json()["detail"]
    still = client.get(f"/rfis/{SAMPLE_OVERDUE_ID}").json()
    assert still["status"] == "ball_in_court"
    assert still["rfi_display"] == "RFI-0001"


def test_cannot_submit_draft_without_internal_review(client):
    rfi_id = _new_draft(client, "Confirm hoist opening header on S301 Rev C before review.")
    skipped = client.post(
        f"/pe/rfis/{rfi_id}/submit", json=_submit_body(), headers=PE_HEADERS
    )
    assert skipped.status_code == 422
    assert "Internal review" in skipped.json()["detail"]
    still = client.get(f"/rfis/{rfi_id}").json()
    assert still["status"] == "draft"
    assert still["rfi_display"] is None


def test_first_submit_mints_second_from_needs_clarification_does_not(client):
    rfi_id = _new_draft(client, "Confirm roof opening curb on S301 Rev C for remint check.")
    client.post(f"/pe/rfis/{rfi_id}/approve_internal_review", json={}, headers=PE_HEADERS)
    first = client.post(
        f"/pe/rfis/{rfi_id}/submit", json=_submit_body(), headers=PE_HEADERS
    ).json()
    assert first["first_submit"] is True
    number = first["rfi_display"]
    due = first["due_at"]

    db = dbmod.SessionLocal()
    try:
        request_clarification(db, rfi_id, "Need a field photo before close.")
    finally:
        db.close()
    holding = client.get(f"/rfis/{rfi_id}").json()
    assert holding["status"] == "needs_clarification"
    assert holding["rfi_display"] == number

    second = client.post(
        f"/pe/rfis/{rfi_id}/submit",
        json=_submit_body(comment="Resubmit after photo."),
        headers=PE_HEADERS,
    )
    assert second.status_code == 200
    body = second.json()
    assert body["first_submit"] is False
    assert body["rfi_display"] == number
    assert body["status"] == "ball_in_court"
    assert body["due_at"] == due


def test_pe_may_set_work_stopped_and_due_at_uses_hours_or_1700(client):
    rfi_id = _new_draft(client, "Work is blocked at the dock until the beam seat is confirmed.")
    client.post(f"/pe/rfis/{rfi_id}/approve_internal_review", json={}, headers=PE_HEADERS)
    stopped = client.post(
        f"/pe/rfis/{rfi_id}/submit",
        json=_submit_body(priority="standard", work_stopped=True),
        headers=PE_HEADERS,
    ).json()
    assert stopped["priority"] == "work_stopped"
    assert stopped["work_stopped"] is True
    due = datetime.fromisoformat(stopped["due_at"].replace("Z", ""))
    submitted = datetime.fromisoformat(stopped["submitted_at"].replace("Z", ""))
    hours = (due - submitted).total_seconds() / 3600
    assert 23.5 <= hours <= 24.5

    other = _new_draft(
        client,
        "Confirm lintel bearing at the hoist opening on S302 Rev A.",
        sheet="S302",
    )
    client.post(f"/pe/rfis/{other}/approve_internal_review", json={}, headers=PE_HEADERS)
    standard = client.post(
        f"/pe/rfis/{other}/submit", json=_submit_body(), headers=PE_HEADERS
    ).json()
    due_std = datetime.fromisoformat(standard["due_at"].replace("Z", "")).replace(
        tzinfo=ZoneInfo("UTC")
    )
    local = due_std.astimezone(ZoneInfo("America/New_York"))
    assert local.hour == 17
    assert local.minute == 0


def test_ilsb_like_new_draft_submit_leaves_e803_unnumbered(client):
    db = dbmod.SessionLocal()
    try:
        copy = RFI(
            project_id=str(ILSB_PROJECT_ID),
            status="draft",
            subject="ILSB-like fixture type on EL107_N north corridor",
            question="Which fixture type is intended on EL107_N at the north corridor?",
            priority="standard",
            cost_impact="unknown",
            schedule_impact="unknown",
        )
        db.add(copy)
        db.flush()
        db.add(
            RFIEvent(
                rfi_id=copy.id,
                event_type="status_change",
                from_status=None,
                to_status="draft",
                payload={"source": "test_copy"},
            )
        )
        db.add(
            RFIRef(
                rfi_id=copy.id,
                sheet_revision_id=str(ILSB_REV_27_ID),
                sheet_number="EL107_N",
                revision="27",
                discipline="E",
            )
        )
        db.add(
            RFIPin(
                rfi_id=copy.id,
                sheet_revision_id=str(ILSB_REV_27_ID),
                x_norm=0.61,
                y_norm=0.27,
                label="north corridor",
            )
        )
        db.commit()
        copy_id = copy.id
    finally:
        db.close()

    approve = client.post(
        f"/pe/rfis/{copy_id}/approve_internal_review", json={}, headers=PE_HEADERS
    )
    assert approve.status_code == 200
    submitted = client.post(
        f"/pe/rfis/{copy_id}/submit", json=_submit_body(), headers=PE_HEADERS
    )
    assert submitted.status_code == 200
    assert submitted.json()["first_submit"] is True
    assert submitted.json()["rfi_display"].startswith("RFI-")

    seeded = client.get(f"/rfis/{ILSB_RFI_ID}").json()
    assert seeded["status"] == "draft"
    assert seeded["rfi_display"] is None
    graph = client.get("/rfi_graph", params={"project_id": str(ILSB_PROJECT_ID)}).json()
    assert any(row["id"] == str(ILSB_RFI_ID) and row["rfi_display"] is None for row in graph["drafts"])
    assert any(row["id"] == copy_id and row["rfi_display"] for row in graph["open"])


def test_pe_assignees_are_seeded_ids(client):
    denied = client.get("/pe/assignees")
    assert denied.status_code == 403
    roster = client.get("/pe/assignees", headers=PE_HEADERS).json()
    assert roster["ok"] is True
    user_ids = {row["id"] for row in roster["users"]}
    company_ids = {row["id"] for row in roster["companies"]}
    assert str(USER_SAMPLE_AE_ID) in user_ids
    assert str(COMPANY_SAMPLE_AE_ID) in company_ids
