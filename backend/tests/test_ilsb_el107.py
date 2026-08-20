from sqlalchemy import delete, select

from app import db as dbmod
from app.ids import (
    ILSB_PIN_LABEL,
    ILSB_PIN_X,
    ILSB_PIN_Y,
    ILSB_PROJECT_ID,
    ILSB_PROJECT_NAME,
    ILSB_PROPOSED,
    ILSB_QUESTION,
    ILSB_REV_27_ID,
    ILSB_RFI_ID,
    ILSB_SHEET_NUMBER,
    ILSB_SUBJECT,
)
from app.models import RFI, RFIAttachment, RFIEvent, RFIPin, RFIRef


def _wipe_ilsb_rfis():
    db = dbmod.SessionLocal()
    try:
        ids = list(
            db.scalars(select(RFI.id).where(RFI.project_id == str(ILSB_PROJECT_ID)))
        )
        if ids:
            for model in (RFIPin, RFIRef, RFIEvent, RFIAttachment):
                db.execute(delete(model).where(model.rfi_id.in_(ids)))
            db.execute(delete(RFI).where(RFI.id.in_(ids)))
            db.commit()
    finally:
        db.close()


def test_ilsb_el107_rev27_is_a_sheet_revision(client):
    projects = client.get("/projects").json()
    ils = next(row for row in projects if row["id"] == str(ILSB_PROJECT_ID))
    assert ils["name"] == ILSB_PROJECT_NAME
    assert ils["architect"] == "TenBerke"
    assert ils["project_number"] == "4224"

    revisions = client.get(f"/projects/{ILSB_PROJECT_ID}/sheet-revisions").json()
    el107 = next(
        row
        for row in revisions
        if row["sheet_number"] == "EL107_N" and row["revision"] == "27"
    )
    assert el107["id"] == str(ILSB_REV_27_ID)
    assert el107["discipline"] == "E"
    assert el107["title"] == "Electrical Lighting Plan — Level 07 North"
    assert el107["is_current"] is True
    assert el107["file_url"] == f"/sheet-revisions/{ILSB_REV_27_ID}/drawing"
    assert el107["page_width"] == 3600
    assert el107["page_height"] == 2400
    assert el107["sheet_number"] != "E-803"

    drawing = client.get(el107["file_url"])
    assert drawing.status_code == 200
    assert drawing.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_search_ilsb_el107_e803_vivarium_finds_seeded_draft(client):
    by_sheet = client.get(
        "/search_rfis",
        params={"project_id": str(ILSB_PROJECT_ID), "sheet_number": "EL107_N"},
    )
    assert by_sheet.json()["count"] >= 1
    hit = by_sheet.json()["rfis"][0]
    assert hit["id"] == str(ILSB_RFI_ID)
    assert hit["status"] == "draft"
    assert hit["rfi_display"] is None

    by_e803 = client.get(
        "/search_rfis",
        params={"project_id": str(ILSB_PROJECT_ID), "sheet_number": "E-803"},
    )
    assert by_e803.json()["count"] >= 1

    by_query = client.get(
        "/search_rfis",
        params={
            "project_id": str(ILSB_PROJECT_ID),
            "query": "vivarium lighting",
        },
    )
    assert by_query.json()["count"] >= 1
    assert "E-803" in by_query.json()["rfis"][0]["question"]


def test_seeded_ilsb_draft_is_pinned_to_revision(client):
    detail = client.get(f"/rfis/{ILSB_RFI_ID}")
    assert detail.status_code == 200
    rfi = detail.json()
    assert rfi["status"] == "draft"
    assert rfi["rfi_display"] is None
    assert rfi["rfi_number"] is None
    assert rfi["subject"] == ILSB_SUBJECT
    assert rfi["question"] == ILSB_QUESTION
    assert rfi["proposed_solution"] == ILSB_PROPOSED
    assert rfi["priority"] == "standard"
    assert rfi["cost_impact"] == "possible"
    assert rfi["schedule_impact"] == "possible"
    assert rfi["grok_preflight"]["is_duplicate"] is False
    assert rfi["grok_preflight"]["question_count"] == 1
    assert rfi["grok_preflight"]["rewrite_applied"] is True
    assert rfi["grok_preflight"]["missing_fields"] == []
    assert "other jobs" in rfi["grok_preflight"]["notes"]

    pins = rfi["pins"]
    assert len(pins) == 1
    assert pins[0]["sheet_revision_id"] == str(ILSB_REV_27_ID)
    assert pins[0]["x_norm"] == ILSB_PIN_X
    assert pins[0]["y_norm"] == ILSB_PIN_Y
    assert pins[0]["label"] == ILSB_PIN_LABEL

    refs = {ref["sheet_number"]: ref for ref in rfi["refs"]}
    assert refs["EL107_N"]["sheet_revision_id"] == str(ILSB_REV_27_ID)
    assert refs["EL107_N"]["revision"] == "27"
    assert refs["E-803"]["sheet_revision_id"] is None
    assert refs["E-803"]["revision"] is None
    assert refs["E-803"]["detail"] == "revision not stated on EL107_N"

    db = dbmod.SessionLocal()
    try:
        events = list(db.scalars(select(RFIEvent).where(RFIEvent.rfi_id == str(ILSB_RFI_ID))))
        assert events
        assert events[0].to_status == "draft"
    finally:
        db.close()


def test_create_on_el107_stops_when_open_draft_exists(client):
    search = client.get(
        "/search_rfis",
        params={
            "project_id": str(ILSB_PROJECT_ID),
            "sheet_number": ILSB_SHEET_NUMBER,
            "query": "vivarium lighting",
        },
    )
    assert search.json()["count"] >= 1
    payload = {
        "task": "preflight_rfi",
        "project": {"id": str(ILSB_PROJECT_ID), "name": ILSB_PROJECT_NAME},
        "sheet_revision": {
            "id": str(ILSB_REV_27_ID),
            "sheet_number": "EL107_N",
            "revision": "27",
            "discipline": "E",
        },
        "pin": {
            "x_norm": ILSB_PIN_X,
            "y_norm": ILSB_PIN_Y,
            "label": ILSB_PIN_LABEL,
        },
        "photos": [],
        "open_rfis_same_sheet": [],
        "user_note": ILSB_QUESTION,
    }
    created = client.post("/create_rfi_draft", json=payload)
    assert created.status_code == 200
    body = created.json()
    assert body["ok"] is False
    assert body["duplicate"] is True
    assert body["rfi_id"] == str(ILSB_RFI_ID)
    assert body["status"] == "draft"
    assert body["rfi_display"] is None


def test_create_el107_draft_when_search_is_empty(client):
    _wipe_ilsb_rfis()
    search = client.get(
        "/search_rfis",
        params={
            "project_id": str(ILSB_PROJECT_ID),
            "sheet_number": "EL107_N",
            "query": "vivarium lighting E-803",
        },
    )
    assert search.json()["count"] == 0

    payload = {
        "task": "preflight_rfi",
        "project": {"id": str(ILSB_PROJECT_ID), "name": ILSB_PROJECT_NAME},
        "sheet_revision": {
            "id": str(ILSB_REV_27_ID),
            "sheet_number": "EL107_N",
            "revision": "27",
            "discipline": "E",
        },
        "pin": {
            "x_norm": ILSB_PIN_X,
            "y_norm": ILSB_PIN_Y,
            "label": ILSB_PIN_LABEL,
        },
        "photos": [],
        "open_rfis_same_sheet": [],
        "user_note": ILSB_QUESTION,
    }
    created = client.post("/create_rfi_draft", json=payload)
    assert created.status_code == 200
    body = created.json()
    assert body["ok"] is True
    assert body["status"] == "draft"
    assert body["rfi_display"] is None
    assert "internal_review" in body["missing_for_submit"]

    rfi = client.get(f"/rfis/{body['rfi_id']}").json()
    assert rfi["subject"] == ILSB_SUBJECT
    assert rfi["question"] == ILSB_QUESTION
    assert rfi["priority"] == "standard"
    assert rfi["priority"] != "work_stopped"
    assert rfi["pins"][0]["sheet_revision_id"] == str(ILSB_REV_27_ID)
    assert rfi["grok_preflight"]["is_duplicate"] is False
    assert rfi["grok_preflight"]["rewrite_applied"] is True
    refs = {ref["sheet_number"]: ref for ref in rfi["refs"]}
    assert refs["EL107_N"]["sheet_revision_id"] == str(ILSB_REV_27_ID)
    assert refs["E-803"]["sheet_revision_id"] is None
    assert refs["E-803"]["detail"] == "revision not stated on EL107_N"
