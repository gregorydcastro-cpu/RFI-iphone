from sqlalchemy import delete, select

from app import db as dbmod
from app.ids import (
    DEMO_PROJECT_NAME,
    DEMO_REVISION,
    DEMO_SHEET_NUMBER,
    PROJECT_ID,
    REV_E101_A_ID,
    SHOP_DRAFT_PROPOSED,
    SHOP_DRAFT_QUESTION,
    SHOP_DRAFT_RFI_ID,
    SHOP_DRAFT_SUBJECT,
    SHOP_PIN_LABEL,
    SHOP_PIN_X,
    SHOP_PIN_Y,
    USER_HARBOR_JM_ID,
)
from app.models import RFI, RFIAttachment, RFIEvent, RFIPin, RFIRef


def _wipe_shop_rfis():
    db = dbmod.SessionLocal()
    try:
        ids = list(
            db.scalars(select(RFI.id).where(RFI.project_id == str(PROJECT_ID)))
        )
        if ids:
            for model in (RFIPin, RFIRef, RFIEvent, RFIAttachment):
                db.execute(delete(model).where(model.rfi_id.in_(ids)))
            db.execute(delete(RFI).where(RFI.id.in_(ids)))
            db.commit()
    finally:
        db.close()


def test_shop_e101_rev_a_is_a_sheet_revision(client):
    projects = client.get("/projects").json()
    shop = next(row for row in projects if row["id"] == str(PROJECT_ID))
    assert shop["name"] == DEMO_PROJECT_NAME
    assert shop["architect"] is None
    assert shop["project_number"] is None

    revisions = client.get(f"/projects/{PROJECT_ID}/sheet-revisions").json()
    e101 = next(
        row
        for row in revisions
        if row["sheet_number"] == DEMO_SHEET_NUMBER and row["revision"] == DEMO_REVISION
    )
    assert e101["id"] == str(REV_E101_A_ID)
    assert e101["discipline"] == "E"
    assert e101["title"] == "Sample lighting plan"
    assert e101["is_current"] is True
    assert e101["file_url"] == f"/sheet-revisions/{REV_E101_A_ID}/drawing"
    assert e101["page_width"] == 1800
    assert e101["page_height"] == 1200

    drawing = client.get(e101["file_url"])
    assert drawing.status_code == 200
    assert drawing.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_search_shop_e101_finds_seeded_draft(client):
    by_sheet = client.get(
        "/search_rfis",
        params={"project_id": str(PROJECT_ID), "sheet_number": DEMO_SHEET_NUMBER},
    )
    assert by_sheet.json()["count"] >= 1
    hit = next(row for row in by_sheet.json()["rfis"] if row["id"] == str(SHOP_DRAFT_RFI_ID))
    assert hit["status"] == "draft"
    assert hit["rfi_display"] is None

    other_sheet = client.get(
        "/search_rfis",
        params={"project_id": str(PROJECT_ID), "sheet_number": "E-000"},
    )
    assert other_sheet.json()["count"] == 0

    by_query = client.get(
        "/search_rfis",
        params={
            "project_id": str(PROJECT_ID),
            "query": "shop lighting",
        },
    )
    assert by_query.json()["count"] >= 1
    assert "E-101" in by_query.json()["rfis"][0]["question"]


def test_seeded_shop_draft_is_pinned_to_revision(client):
    detail = client.get(f"/rfis/{SHOP_DRAFT_RFI_ID}")
    assert detail.status_code == 200
    rfi = detail.json()
    assert rfi["status"] == "draft"
    assert rfi["rfi_display"] is None
    assert rfi["rfi_number"] is None
    assert rfi["subject"] == SHOP_DRAFT_SUBJECT
    assert rfi["question"] == SHOP_DRAFT_QUESTION
    assert rfi["proposed_solution"] == SHOP_DRAFT_PROPOSED
    assert rfi["priority"] == "standard"
    assert rfi["cost_impact"] == "possible"
    assert rfi["schedule_impact"] == "possible"
    assert rfi["grok_preflight"]["is_duplicate"] is False
    assert rfi["grok_preflight"]["question_count"] == 1
    assert rfi["grok_preflight"]["rewrite_applied"] is True
    assert rfi["grok_preflight"]["missing_fields"] == []
    assert "Sample draft" in rfi["grok_preflight"]["notes"]

    pins = rfi["pins"]
    assert len(pins) == 1
    assert pins[0]["sheet_revision_id"] == str(REV_E101_A_ID)
    assert pins[0]["x_norm"] == SHOP_PIN_X
    assert pins[0]["y_norm"] == SHOP_PIN_Y
    assert pins[0]["label"] == SHOP_PIN_LABEL

    refs = {ref["sheet_number"]: ref for ref in rfi["refs"]}
    assert refs["E-101"]["sheet_revision_id"] == str(REV_E101_A_ID)
    assert refs["E-101"]["revision"] == DEMO_REVISION
    assert refs["E-101"]["detail"] is None

    db = dbmod.SessionLocal()
    try:
        events = list(db.scalars(select(RFIEvent).where(RFIEvent.rfi_id == str(SHOP_DRAFT_RFI_ID))))
        assert events
        assert events[0].to_status == "draft"
    finally:
        db.close()


def test_create_on_e101_stops_when_open_draft_exists(client):
    search = client.get(
        "/search_rfis",
        params={
            "project_id": str(PROJECT_ID),
            "sheet_number": DEMO_SHEET_NUMBER,
            "query": "shop lighting",
        },
    )
    assert search.json()["count"] >= 1
    payload = {
        "task": "preflight_rfi",
        "project": {"id": str(PROJECT_ID), "name": DEMO_PROJECT_NAME},
        "sheet_revision": {
            "id": str(REV_E101_A_ID),
            "sheet_number": DEMO_SHEET_NUMBER,
            "revision": DEMO_REVISION,
            "discipline": "E",
        },
        "pin": {
            "x_norm": SHOP_PIN_X,
            "y_norm": SHOP_PIN_Y,
            "label": SHOP_PIN_LABEL,
        },
        "photos": [],
        "open_rfis_same_sheet": [],
        "user_note": SHOP_DRAFT_QUESTION,
        "actor": {
            "user_id": str(USER_HARBOR_JM_ID),
            "role": "journeyman",
        },
    }
    created = client.post("/create_rfi_draft", json=payload)
    assert created.status_code == 200
    body = created.json()
    assert body["ok"] is False
    assert body["duplicate"] is True
    assert body["rfi_id"] == str(SHOP_DRAFT_RFI_ID)
    assert body["status"] == "draft"
    assert body["rfi_display"] is None


def test_create_e101_draft_when_search_is_empty(client):
    _wipe_shop_rfis()
    search = client.get(
        "/search_rfis",
        params={
            "project_id": str(PROJECT_ID),
            "sheet_number": DEMO_SHEET_NUMBER,
            "query": "shop lighting E-101",
        },
    )
    assert search.json()["count"] == 0

    payload = {
        "task": "preflight_rfi",
        "project": {"id": str(PROJECT_ID), "name": DEMO_PROJECT_NAME},
        "sheet_revision": {
            "id": str(REV_E101_A_ID),
            "sheet_number": DEMO_SHEET_NUMBER,
            "revision": DEMO_REVISION,
            "discipline": "E",
        },
        "pin": {
            "x_norm": SHOP_PIN_X,
            "y_norm": SHOP_PIN_Y,
            "label": SHOP_PIN_LABEL,
        },
        "photos": [],
        "open_rfis_same_sheet": [],
        "user_note": SHOP_DRAFT_QUESTION,
        "actor": {
            "user_id": str(USER_HARBOR_JM_ID),
            "role": "journeyman",
        },
    }
    created = client.post("/create_rfi_draft", json=payload)
    assert created.status_code == 200
    body = created.json()
    assert body["ok"] is True
    assert body["status"] == "draft"
    assert body["rfi_display"] is None
    assert "internal_review" in body["missing_for_submit"]

    rfi = client.get(f"/rfis/{body['rfi_id']}").json()
    assert "E-101" in rfi["subject"]
    assert "fixture type" in rfi["question"].lower()
    assert rfi["priority"] == "standard"
    assert rfi["priority"] != "work_stopped"
    assert rfi["pins"][0]["sheet_revision_id"] == str(REV_E101_A_ID)
    assert rfi["grok_preflight"]["is_duplicate"] is False
    assert rfi["grok_preflight"]["rewrite_applied"] is True
    refs = {ref["sheet_number"]: ref for ref in rfi["refs"]}
    assert refs["E-101"]["sheet_revision_id"] == str(REV_E101_A_ID)
    assert refs["E-101"]["revision"] == DEMO_REVISION
