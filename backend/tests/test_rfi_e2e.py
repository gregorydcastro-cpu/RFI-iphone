"""Both-actor E2E: Field/Grokbot HTTP + PE/design helpers. No Mac simulator."""

from __future__ import annotations

from sqlalchemy import select, text

from app import db as dbmod
from app.ids import (
    DEMO_PROJECT_NAME,
    ILSB_RFI_ID,
    PROJECT_ID,
    REV_S301_C_ID,
    REV_S302_A_ID,
    SAMPLE_OVERDUE_ID,
)
from app.models import RFIEvent
from app.pe import (
    ANSWER_DISCLAIMER,
    approve_internal_review,
    close_rfi,
    draft_change_order,
    draft_material_order,
    record_official_response,
    request_clarification,
    start_impact_review,
    submit_for_design,
)


def _session():
    return dbmod.SessionLocal()


def _search_then_draft(client, *, note: str, rev_id, sheet: str, revision: str, discipline: str):
    search = client.get(
        "/search_rfis",
        params={
            "project_id": str(PROJECT_ID),
            "sheet_number": sheet,
            "query": note[:80],
        },
    )
    assert search.status_code == 200
    assert search.json()["ok"] is True
    assert search.json()["count"] == 0

    created = client.post(
        "/create_rfi_draft",
        json={
            "task": "preflight_rfi",
            "project": {"id": str(PROJECT_ID), "name": DEMO_PROJECT_NAME},
            "sheet_revision": {
                "id": str(rev_id),
                "sheet_number": sheet,
                "revision": revision,
                "discipline": discipline,
            },
            "pin": {"x_norm": 0.33, "y_norm": 0.44, "label": "E2E"},
            "photos": [],
            "open_rfis_same_sheet": [],
            "user_note": note,
        },
    )
    assert created.status_code == 200
    body = created.json()
    assert body["ok"] is True
    assert body["status"] == "draft"
    assert body["rfi_display"] is None
    return body["rfi_id"]


def _events(rfi_id: str) -> list[RFIEvent]:
    db = _session()
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


def test_e2e_both_actors_happy_path_closes(client):
    rfi_id = _search_then_draft(
        client,
        note="Confirm the beam seat elevation at the dock on S301 Rev C.",
        rev_id=REV_S301_C_ID,
        sheet="S301",
        revision="C",
        discipline="Structural",
    )
    draft = client.get(f"/rfis/{rfi_id}").json()
    assert draft["status"] == "draft"
    assert draft["rfi_display"] is None
    assert draft["priority"] != "work_stopped"

    db = _session()
    try:
        review = approve_internal_review(db, rfi_id)
        assert review.status == "internal_review"
        submitted = submit_for_design(db, rfi_id, assignee="Sample AE")
        assert submitted.first_submit is True
        assert submitted.status == "ball_in_court"
        assert submitted.rfi_display and submitted.rfi_display.startswith("RFI-")
        answered = record_official_response(
            db,
            rfi_id,
            "Revise the beam seat to match the marked condition on S301 Rev C. "
            "Hold work until a change order is issued.",
        )
        assert answered.status == "answered"
        impact = start_impact_review(db, rfi_id)
        assert impact.status == "impact_review"
        co = draft_change_order(db, rfi_id, "SAMPLE draft CO for beam-seat revision. Not approved.")
        mo = draft_material_order(db, rfi_id, "SAMPLE draft material order. Not approved.")
        assert co.status == "draft"
        assert mo.status == "draft"
        closed = close_rfi(
            db,
            rfi_id,
            official_response="Closed after GC impact review. "
            + ANSWER_DISCLAIMER,
        )
        assert closed.status == "closed"
    finally:
        db.close()

    detail = client.get(f"/rfis/{rfi_id}").json()
    assert detail["status"] == "closed"
    assert detail["rfi_display"].startswith("RFI-")
    assert detail["due_at"]
    assert detail["responded_at"]
    assert detail["assigned"]
    assert ANSWER_DISCLAIMER.lower() in detail["official_response"].lower()
    assert "not a change order" in detail["official_response"].lower()
    assert "does not authorize work" in detail["official_response"].lower()
    assert detail["priority"] != "work_stopped"
    assert detail["draft_change_orders"]
    assert all(row["status"] == "draft" for row in detail["draft_change_orders"])
    assert detail["draft_material_orders"]
    assert all(row["status"] == "draft" for row in detail["draft_material_orders"])

    statuses = [event.to_status for event in _events(rfi_id) if event.event_type == "status_change"]
    assert statuses[0] == "draft"
    assert statuses[-1] == "closed"
    assert set(statuses) >= {
        "draft",
        "internal_review",
        "submitted",
        "ball_in_court",
        "answered",
        "impact_review",
        "closed",
    }
    assert statuses.index("submitted") < statuses.index("ball_in_court")

    graph = client.get("/rfi_graph").json()
    open_ids = {row["id"] for row in graph["open"]}
    draft_ids = {row["id"] for row in graph["drafts"]}
    assert rfi_id not in open_ids
    assert rfi_id not in draft_ids
    assert str(SAMPLE_OVERDUE_ID) in open_ids
    e803 = next(row for row in graph["drafts"] if row["id"] == str(ILSB_RFI_ID))
    assert e803["rfi_display"] is None
    assert e803["status"] == "draft"


def test_e2e_gc_holding_then_complete(client):
    rfi_id = _search_then_draft(
        client,
        note="Confirm curb flashing at the roof opening on S302 Rev A.",
        rev_id=REV_S302_A_ID,
        sheet="S302",
        revision="A",
        discipline="Structural",
    )

    db = _session()
    try:
        approve_internal_review(db, rfi_id)
        submit_for_design(db, rfi_id, assignee="Sample PE reviewer")
        record_official_response(
            db,
            rfi_id,
            "Curb as drawn on S302 Rev A. Provide a field photo of the opening.",
        )
        request_clarification(db, rfi_id, "GC needs the field photo before close.")
        holding = client.get(f"/rfis/{rfi_id}").json()
        assert holding["status"] == "needs_clarification"
        graph = client.get("/rfi_graph").json()
        held = next(row for row in graph["open"] if row["id"] == rfi_id)
        assert held["work_stopped"] is False
        assert held["age_bucket"] == "gc_holding"

        start_impact_review(db, rfi_id)
        close_rfi(db, rfi_id, official_response="No work change. Closed.")
    finally:
        db.close()

    done = client.get(f"/rfis/{rfi_id}").json()
    assert done["status"] == "closed"
    assert done["rfi_display"]
    graph = client.get("/rfi_graph").json()
    ids = {row["id"] for row in graph["open"] + graph["drafts"]}
    assert rfi_id not in ids
    assert any(row["id"] == str(ILSB_RFI_ID) for row in graph["drafts"])
