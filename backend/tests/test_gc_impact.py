"""GC impact-review HTTP: draft CO/PO and close. Not Grok tools."""

from __future__ import annotations

from app.ids import (
    COMPANY_SAMPLE_AE_ID,
    ILSB_RFI_ID,
    PROJECT_ID,
    REV_S301_C_ID,
    SAMPLE_VOID_ID,
    USER_SAMPLE_AE_ID,
)
from app.pe import ANSWER_DISCLAIMER

PE_HEADERS = {"X-Field-Actor": "pe", "X-PE-Token": "pe-demo"}
DESIGN_HEADERS = {"X-Field-Actor": "design", "X-Design-Token": "design-demo"}
GC_HEADERS = {"X-Field-Actor": "gc", "X-GC-Token": "gc-demo"}


def _answered(client) -> str:
    note = "Confirm dock embed plate after design answer for GC impact close."
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
            "pin": {"x_norm": 0.29, "y_norm": 0.41, "label": "GC-HTTP"},
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
    client.post(f"/pe/rfis/{rfi_id}/approve_internal_review", json={}, headers=PE_HEADERS)
    submitted = client.post(
        f"/pe/rfis/{rfi_id}/submit",
        json={
            "priority": "work_stopped",
            "work_stopped": True,
            "assigned_to_user_id": str(USER_SAMPLE_AE_ID),
            "assigned_to_company_id": str(COMPANY_SAMPLE_AE_ID),
        },
        headers=PE_HEADERS,
    )
    assert submitted.json()["status"] == "ball_in_court"
    answered = client.post(
        f"/design/rfis/{rfi_id}/official_response",
        json={"official_response": "Use the embed as marked on S301 Rev C."},
        headers=DESIGN_HEADERS,
    )
    assert answered.status_code == 200
    assert answered.json()["status"] == "answered"
    return rfi_id


def test_gc_routes_require_token(client):
    rfi_id = _answered(client)
    assert client.post(f"/gc/rfis/{rfi_id}/start_impact_review").status_code == 403
    assert client.post(
        f"/gc/rfis/{rfi_id}/draft_change_order",
        json={"title": "Draft CO"},
    ).status_code == 403
    assert client.post(
        f"/gc/rfis/{rfi_id}/draft_material_order",
        json={"lines": [{"description": "Plate", "qty": 1, "uom": "EA"}]},
    ).status_code == 403
    assert client.post(f"/gc/rfis/{rfi_id}/close", json={}).status_code == 403
    grok = client.post("/submit_rfi", json={"rfi_id": rfi_id})
    assert grok.status_code == 403
    assert grok.json()["detail"]["policy"] == "grokbot_lane"
    e803 = client.get(f"/rfis/{ILSB_RFI_ID}").json()
    assert e803["status"] == "draft"
    assert e803["rfi_display"] is None


def test_cannot_close_draft_or_void_or_co_before_answer(client):
    draft = client.post(
        f"/gc/rfis/{ILSB_RFI_ID}/close", json={}, headers=GC_HEADERS
    )
    assert draft.status_code == 422
    assert "draft" in draft.json()["detail"]
    still = client.get(f"/rfis/{ILSB_RFI_ID}").json()
    assert still["status"] == "draft"
    assert still["rfi_display"] is None
    assert still["closed_at"] is None

    voided = client.post(
        f"/gc/rfis/{SAMPLE_VOID_ID}/close", json={}, headers=GC_HEADERS
    )
    assert voided.status_code == 422
    assert "void" in voided.json()["detail"]

    co = client.post(
        f"/gc/rfis/{ILSB_RFI_ID}/draft_change_order",
        json={"title": "Should not exist"},
        headers=GC_HEADERS,
    )
    assert co.status_code == 422
    assert "official response" in co.json()["detail"].lower() or "draft" in co.json()["detail"]
    po = client.post(
        f"/gc/rfis/{ILSB_RFI_ID}/draft_material_order",
        json={"lines": [{"description": "No", "qty": 1, "uom": "EA"}]},
        headers=GC_HEADERS,
    )
    assert po.status_code == 422


def test_gc_impact_drafts_then_close_leaves_graph(client):
    rfi_id = _answered(client)
    start = client.post(f"/gc/rfis/{rfi_id}/start_impact_review", headers=GC_HEADERS)
    assert start.status_code == 200
    assert start.json()["status"] == "impact_review"

    co = client.post(
        f"/gc/rfis/{rfi_id}/draft_change_order",
        json={
            "title": "Beam-seat revision at dock",
            "cost_amount": 12500.0,
            "schedule_days": 4,
            "notes": "Draft only. Not approved.",
        },
        headers=GC_HEADERS,
    )
    assert co.status_code == 200
    assert co.json()["draft_status"] == "draft"
    assert co.json()["kind"] == "change_order"
    assert co.json()["title"] == "Beam-seat revision at dock"
    assert "not approved" in co.json()["message"].lower()

    po = client.post(
        f"/gc/rfis/{rfi_id}/draft_material_order",
        json={
            "lines": [
                {"description": "Embed plate", "qty": 2, "uom": "EA"},
                {"description": "Grout", "qty": 1.5, "uom": "BOX"},
            ]
        },
        headers=GC_HEADERS,
    )
    assert po.status_code == 200
    assert po.json()["draft_status"] == "draft"
    assert po.json()["line_count"] == 2

    detail = client.get(f"/rfis/{rfi_id}").json()
    assert detail["status"] == "impact_review"
    assert detail["priority"] == "work_stopped"
    assert all(row["status"] == "draft" for row in detail["draft_change_orders"])
    assert detail["draft_change_orders"][0]["title"] == "Beam-seat revision at dock"
    assert detail["draft_material_orders"][0]["line_count"] == 2
    assert all(row["status"] == "draft" for row in detail["draft_material_orders"])

    closed = client.post(f"/gc/rfis/{rfi_id}/close", json={}, headers=GC_HEADERS)
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"
    assert closed.json()["work_stopped"] is False
    assert ANSWER_DISCLAIMER.lower() in (closed.json()["official_response"] or "").lower()

    after = client.get(f"/rfis/{rfi_id}").json()
    assert after["status"] == "closed"
    assert after["closed_at"]
    assert after["priority"] != "work_stopped"
    assert after["work_stopped"] is False
    assert all(row["status"] == "draft" for row in after["draft_change_orders"])
    assert all(row["status"] == "draft" for row in after["draft_material_orders"])

    graph = client.get("/rfi_graph").json()
    open_ids = {row["id"] for row in graph["open"]}
    draft_ids = {row["id"] for row in graph["drafts"]}
    assert rfi_id not in open_ids
    assert rfi_id not in draft_ids
    e803 = next(row for row in graph["drafts"] if row["id"] == str(ILSB_RFI_ID))
    assert e803["status"] == "draft"
    assert e803["rfi_display"] is None


def test_material_lines_require_qty_and_uom(client):
    rfi_id = _answered(client)
    client.post(f"/gc/rfis/{rfi_id}/start_impact_review", headers=GC_HEADERS)
    bad_qty = client.post(
        f"/gc/rfis/{rfi_id}/draft_material_order",
        json={"lines": [{"description": "Plate", "qty": 0, "uom": "EA"}]},
        headers=GC_HEADERS,
    )
    assert bad_qty.status_code == 422
    bad_uom = client.post(
        f"/gc/rfis/{rfi_id}/draft_material_order",
        json={"lines": [{"description": "Plate", "qty": 1, "uom": "TON"}]},
        headers=GC_HEADERS,
    )
    assert bad_uom.status_code == 422
