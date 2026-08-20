from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.drawings import ensure_demo_drawings, png_size
from app.ids import (
    DEMO_ORG_NAME,
    DEMO_PROJECT_NAME,
    DRAWING_SET_ID,
    ILSB_ADDRESS,
    ILSB_ARCHITECT,
    ILSB_LOC_ID,
    ILSB_ORG_ID,
    ILSB_ORG_NAME,
    ILSB_PIN_LABEL,
    ILSB_PIN_X,
    ILSB_PIN_Y,
    ILSB_PREFLIGHT_NOTES,
    ILSB_PROJECT_ID,
    ILSB_PROJECT_NAME,
    ILSB_PROJECT_NO,
    ILSB_PROPOSED,
    ILSB_QUESTION,
    ILSB_REV_27_ID,
    ILSB_REVISION,
    ILSB_RFI_ID,
    ILSB_SET_ID,
    ILSB_SETTINGS_ID,
    ILSB_SHEET_EL107_ID,
    ILSB_SHEET_NUMBER,
    ILSB_SUBJECT,
    LOC_GRID_B4_ID,
    ORG_ID,
    PROJECT_ID,
    REV_S301_B_ID,
    REV_S301_C_ID,
    REV_S302_A_ID,
    SETTINGS_ID,
    SHEET_S301_ID,
    SHEET_S302_ID,
)
from app.db import ASSETS_DIR
from app.models import (
    DrawingSet,
    Location,
    Organization,
    Project,
    ProjectRFISettings,
    RFI,
    RFIEvent,
    RFIPin,
    RFIRef,
    Sheet,
    SheetRevision,
)


def _revision(
    rev_id,
    sheet_id,
    revision: str,
    filename: str,
    issued_on: date,
    is_current: bool,
    sizes: dict[str, tuple[int, int]],
) -> SheetRevision:
    width, height = sizes.get(filename, (0, 0))
    return SheetRevision(
        id=str(rev_id),
        sheet_id=str(sheet_id),
        revision=revision,
        drawing_filename=filename,
        file_url=f"/sheet-revisions/{rev_id}/drawing",
        page_width=width or None,
        page_height=height or None,
        is_current=is_current,
        issued_on=issued_on,
    )


def seed_harbor_yard(db: Session, sizes: dict[str, tuple[int, int]]) -> None:
    if db.get(Project, str(PROJECT_ID)):
        return
    org = db.get(Organization, str(ORG_ID)) or Organization(
        id=str(ORG_ID), name=DEMO_ORG_NAME
    )
    project = Project(
        id=str(PROJECT_ID),
        organization_id=str(ORG_ID),
        name=DEMO_PROJECT_NAME,
    )
    settings = ProjectRFISettings(
        id=str(SETTINGS_ID),
        project_id=str(PROJECT_ID),
        rfi_prefix="RFI",
        number_width=4,
    )
    drawing_set = DrawingSet(
        id=str(DRAWING_SET_ID),
        project_id=str(PROJECT_ID),
        name="Issued for Construction",
        issued_on=date(2026, 3, 12),
    )
    s301 = Sheet(
        id=str(SHEET_S301_ID),
        drawing_set_id=str(DRAWING_SET_ID),
        project_id=str(PROJECT_ID),
        sheet_number="S301",
        title="Foundation Plan",
        discipline="Structural",
    )
    s302 = Sheet(
        id=str(SHEET_S302_ID),
        drawing_set_id=str(DRAWING_SET_ID),
        project_id=str(PROJECT_ID),
        sheet_number="S302",
        title="Framing Plan",
        discipline="Structural",
    )
    revisions = [
        _revision(REV_S301_B_ID, SHEET_S301_ID, "B", "s301-rev-b.png",
                  date(2026, 2, 20), False, sizes),
        _revision(REV_S301_C_ID, SHEET_S301_ID, "C", "s301-rev-c.png",
                  date(2026, 3, 12), True, sizes),
        _revision(REV_S302_A_ID, SHEET_S302_ID, "A", "s302-rev-a.png",
                  date(2026, 3, 12), True, sizes),
    ]
    location = Location(
        id=str(LOC_GRID_B4_ID),
        project_id=str(PROJECT_ID),
        name="Grid B-4",
        grid="B-4",
    )
    db.add_all([org, project, settings, drawing_set, s301, s302, location, *revisions])
    db.commit()


def seed_ilsb_catalog(db: Session, sizes: dict[str, tuple[int, int]]) -> None:
    if db.get(Project, str(ILSB_PROJECT_ID)):
        return
    org = db.get(Organization, str(ILSB_ORG_ID)) or Organization(
        id=str(ILSB_ORG_ID), name=ILSB_ORG_NAME
    )
    project = Project(
        id=str(ILSB_PROJECT_ID),
        organization_id=str(ILSB_ORG_ID),
        name=ILSB_PROJECT_NAME,
        address=ILSB_ADDRESS,
        architect=ILSB_ARCHITECT,
        project_number=ILSB_PROJECT_NO,
    )
    settings = ProjectRFISettings(
        id=str(ILSB_SETTINGS_ID),
        project_id=str(ILSB_PROJECT_ID),
        rfi_prefix="RFI",
        number_width=4,
    )
    drawing_set = DrawingSet(
        id=str(ILSB_SET_ID),
        project_id=str(ILSB_PROJECT_ID),
        name="Bulletin 46",
        issued_on=date(2026, 6, 25),
    )
    sheet = Sheet(
        id=str(ILSB_SHEET_EL107_ID),
        drawing_set_id=str(ILSB_SET_ID),
        project_id=str(ILSB_PROJECT_ID),
        sheet_number=ILSB_SHEET_NUMBER,
        title="Electrical Lighting Plan — Level 07 North",
        discipline="E",
    )
    revision = _revision(
        ILSB_REV_27_ID,
        ILSB_SHEET_EL107_ID,
        ILSB_REVISION,
        "el107_n-rev-27.png",
        date(2026, 6, 25),
        True,
        sizes,
    )
    location = Location(
        id=str(ILSB_LOC_ID),
        project_id=str(ILSB_PROJECT_ID),
        name="Level 07 North, area Gnotobiotics / isolation cubicles",
        grid=None,
    )
    db.add_all([org, project, settings, drawing_set, sheet, revision, location])
    db.commit()


def _ilsb_open_match(db: Session) -> RFI | None:
    stmt = (
        select(RFI)
        .where(RFI.project_id == str(ILSB_PROJECT_ID))
        .where(RFI.status.in_(("draft", "submitted", "ball_in_court")))
    )
    for rfi in db.scalars(stmt):
        refs = db.scalars(select(RFIRef).where(RFIRef.rfi_id == rfi.id)).all()
        sheets = {ref.sheet_number for ref in refs if ref.sheet_number}
        blob = f"{rfi.subject} {rfi.question}".lower()
        if ILSB_SHEET_NUMBER in sheets or "e-803" in sheets or "vivarium" in blob:
            return rfi
    return None


def ingest_ilsb_draft(db: Session) -> RFI | None:
    """search_rfis first; create_rfi_draft only if nothing open on this print."""
    if db.get(RFI, str(ILSB_RFI_ID)):
        return db.get(RFI, str(ILSB_RFI_ID))
    match = _ilsb_open_match(db)
    if match:
        return match

    preflight = {
        "task": "preflight_rfi",
        "is_duplicate": False,
        "question_count": 1,
        "rewrite_applied": True,
        "missing_fields": [],
        "notes": ILSB_PREFLIGHT_NOTES,
        "search": {
            "project_id": str(ILSB_PROJECT_ID),
            "sheet_number": ILSB_SHEET_NUMBER,
            "query": "EL107_N E-803 vivarium lighting",
            "open_count": 0,
        },
        "drafted": {
            "subject": ILSB_SUBJECT,
            "question": ILSB_QUESTION,
            "priority": "standard",
            "cost_impact": "possible",
            "schedule_impact": "possible",
            "proposed_solution": ILSB_PROPOSED,
            "discipline": "E",
        },
    }
    rfi = RFI(
        id=str(ILSB_RFI_ID),
        project_id=str(ILSB_PROJECT_ID),
        rfi_number=None,
        rfi_display=None,
        status="draft",
        subject=ILSB_SUBJECT,
        question=ILSB_QUESTION,
        priority="standard",
        cost_impact="possible",
        schedule_impact="possible",
        proposed_solution=ILSB_PROPOSED,
        grok_preflight=preflight,
    )
    db.add(rfi)
    db.add(
        RFIEvent(
            rfi_id=str(ILSB_RFI_ID),
            event_type="status_change",
            from_status=None,
            to_status="draft",
            payload={"source": "create_rfi_draft", "ingest": "EL107_N"},
        )
    )
    db.add(
        RFIRef(
            rfi_id=str(ILSB_RFI_ID),
            sheet_revision_id=str(ILSB_REV_27_ID),
            sheet_number=ILSB_SHEET_NUMBER,
            revision=ILSB_REVISION,
            discipline="E",
            location_id=str(ILSB_LOC_ID),
        )
    )
    db.add(
        RFIRef(
            rfi_id=str(ILSB_RFI_ID),
            sheet_revision_id=None,
            sheet_number="E-803",
            revision=None,
            discipline="E",
            detail="revision not stated on EL107_N",
        )
    )
    db.add(
        RFIPin(
            rfi_id=str(ILSB_RFI_ID),
            sheet_revision_id=str(ILSB_REV_27_ID),
            x_norm=ILSB_PIN_X,
            y_norm=ILSB_PIN_Y,
            label=ILSB_PIN_LABEL,
        )
    )
    db.commit()
    return rfi


def seed_demo(db: Session) -> None:
    paths = ensure_demo_drawings(ASSETS_DIR)
    sizes = {name: png_size(path) for name, path in paths.items()}
    seed_harbor_yard(db, sizes)
    seed_ilsb_catalog(db, sizes)
    ingest_ilsb_draft(db)


def has_demo_project(db: Session) -> bool:
    return db.scalar(select(Project.id).where(Project.id == str(PROJECT_ID))) is not None
