from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.drawings import ensure_demo_drawings, png_size
from app.holiday_cache import holiday_cache
from app.field_chain import assign_person
from app.ids import (
    COMPANY_CASTRO_ID,
    COMPANY_SAMPLE_AE_ID,
    COMPANY_TENBERKE_ID,
    DEMO_ORG_NAME,
    DEMO_PROJECT_NAME,
    DRAWING_SET_ID,
    HARBOR_CALENDAR_ID,
    HARBOR_HOLIDAY_LABOR_2026_ID,
    HARBOR_HOLIDAY_THANKS_2026_ID,
    HARBOR_HOLIDAY_VETERANS_2026_ID,
    ILSB_ADDRESS,
    ILSB_ARCHITECT,
    ILSB_CALENDAR_ID,
    ILSB_HOLIDAY_LABOR_2026_ID,
    ILSB_HOLIDAY_THANKS_2026_ID,
    ILSB_HOLIDAY_VETERANS_2026_ID,
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
    HARBOR_AREA_ROOF_ID,
    HARBOR_AREA_YARD_ID,
    HARBOR_TICKET_ID,
    ILSB_AREA_L07_ID,
    SAMPLE_ON_CYCLE_ID,
    USER_GREG_PE_ID,
    USER_HARBOR_AF_ID,
    USER_HARBOR_AF_ROOF_ID,
    USER_HARBOR_AP_ID,
    USER_HARBOR_FM_ID,
    USER_HARBOR_JM_ID,
    USER_ILSB_AF_ID,
    USER_ILSB_AP_ID,
    USER_ILSB_FM_ID,
    USER_ILSB_JM_ID,
    USER_SAMPLE_AE_ID,
    USER_SAMPLE_PE_ID,
)
from app.db import ASSETS_DIR
from app.sample_seed import seed_sample_graph_rfis
from app.models import (
    Company,
    DraftMaterialOrder,
    DrawingSet,
    Location,
    Organization,
    Project,
    ProjectArea,
    ProjectCalendar,
    ProjectHoliday,
    ProjectRFISettings,
    RFI,
    RFIEvent,
    RFIPin,
    RFIRef,
    Sheet,
    SheetRevision,
    User,
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
        standard_due_days=7,
        urgent_due_hours=72,
        work_stopped_due_hours=24,
        escalate_after_overdue_hours=48,
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
        standard_due_days=7,
        urgent_due_hours=72,
        work_stopped_due_hours=24,
        escalate_after_overdue_hours=48,
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


def seed_pe_roster(db: Session) -> None:
    """Thin PE / design companies and users. Shared across demo projects."""
    if db.get(Company, str(COMPANY_CASTRO_ID)):
        return
    db.add_all(
        [
            Company(
                id=str(COMPANY_CASTRO_ID),
                project_id=None,
                name="Castro Construction",
                kind="gc",
            ),
            Company(
                id=str(COMPANY_TENBERKE_ID),
                project_id=None,
                name="TenBerke",
                kind="architect",
            ),
            Company(
                id=str(COMPANY_SAMPLE_AE_ID),
                project_id=None,
                name="Sample AE",
                kind="engineer",
            ),
            User(
                id=str(USER_GREG_PE_ID),
                project_id=None,
                company_id=str(COMPANY_CASTRO_ID),
                name="Greg Castro",
                role="pe",
            ),
            User(
                id=str(USER_SAMPLE_AE_ID),
                project_id=None,
                company_id=str(COMPANY_SAMPLE_AE_ID),
                name="Sample AE",
                role="ae",
            ),
            User(
                id=str(USER_SAMPLE_PE_ID),
                project_id=None,
                company_id=str(COMPANY_CASTRO_ID),
                name="Sample PE reviewer",
                role="pe",
            ),
        ]
    )
    db.commit()


def seed_field_people(db: Session) -> None:
    rows = [
        User(
            id=str(USER_HARBOR_AF_ID),
            project_id=str(PROJECT_ID),
            company_id=str(COMPANY_CASTRO_ID),
            name="Harbor Area Foreman",
            role="area_foreman",
        ),
        User(
            id=str(USER_HARBOR_FM_ID),
            project_id=str(PROJECT_ID),
            company_id=str(COMPANY_CASTRO_ID),
            name="Harbor Foreman",
            role="foreman",
        ),
        User(
            id=str(USER_HARBOR_JM_ID),
            project_id=str(PROJECT_ID),
            company_id=str(COMPANY_CASTRO_ID),
            name="Harbor Journeyman",
            role="journeyman",
        ),
        User(
            id=str(USER_HARBOR_AP_ID),
            project_id=str(PROJECT_ID),
            company_id=str(COMPANY_CASTRO_ID),
            name="Harbor Apprentice",
            role="apprentice",
        ),
        User(
            id=str(USER_HARBOR_AF_ROOF_ID),
            project_id=str(PROJECT_ID),
            company_id=str(COMPANY_CASTRO_ID),
            name="Harbor Roof Area Foreman",
            role="area_foreman",
        ),
        User(
            id=str(USER_ILSB_AF_ID),
            project_id=str(ILSB_PROJECT_ID),
            company_id=str(COMPANY_CASTRO_ID),
            name="ILSB Area Foreman",
            role="area_foreman",
        ),
        User(
            id=str(USER_ILSB_FM_ID),
            project_id=str(ILSB_PROJECT_ID),
            company_id=str(COMPANY_CASTRO_ID),
            name="ILSB Foreman",
            role="foreman",
        ),
        User(
            id=str(USER_ILSB_JM_ID),
            project_id=str(ILSB_PROJECT_ID),
            company_id=str(COMPANY_CASTRO_ID),
            name="ILSB Journeyman",
            role="journeyman",
        ),
        User(
            id=str(USER_ILSB_AP_ID),
            project_id=str(ILSB_PROJECT_ID),
            company_id=str(COMPANY_CASTRO_ID),
            name="ILSB Apprentice",
            role="apprentice",
        ),
    ]
    for row in rows:
        if not db.get(User, row.id):
            db.add(row)
    db.commit()


_SEEDED_HOLIDAYS = (
    (date(2026, 9, 7), "Labor Day"),
    (date(2026, 11, 11), "Veterans Day"),
    (date(2026, 11, 26), "Thanksgiving"),
)


def _ensure_calendar(
    db: Session,
    *,
    project_id,
    calendar_id,
    holiday_ids: tuple,
) -> None:
    if not db.get(Project, str(project_id)):
        return
    if db.scalar(select(ProjectCalendar).where(ProjectCalendar.project_id == str(project_id))) is None:
        db.add(
            ProjectCalendar(
                id=str(calendar_id),
                project_id=str(project_id),
                timezone="America/New_York",
                weekend_days=[5, 6],
                standard_sla_unit="business_days",
                due_time="17:00",
                roll_to_business_day=False,
            )
        )
    for holiday_id, (on_date, name) in zip(holiday_ids, _SEEDED_HOLIDAYS, strict=True):
        exists = db.scalar(
            select(ProjectHoliday).where(
                ProjectHoliday.project_id == str(project_id),
                ProjectHoliday.on_date == on_date,
            )
        )
        if exists:
            continue
        db.add(
            ProjectHoliday(
                id=str(holiday_id),
                project_id=str(project_id),
                on_date=on_date,
                name=name,
                source="manual",
                active=True,
            )
        )


def seed_project_calendars(db: Session) -> None:
    """Idempotent Harbor Yard + ILSB calendars. In-process holidays only."""
    _ensure_calendar(
        db,
        project_id=PROJECT_ID,
        calendar_id=HARBOR_CALENDAR_ID,
        holiday_ids=(
            HARBOR_HOLIDAY_LABOR_2026_ID,
            HARBOR_HOLIDAY_VETERANS_2026_ID,
            HARBOR_HOLIDAY_THANKS_2026_ID,
        ),
    )
    _ensure_calendar(
        db,
        project_id=ILSB_PROJECT_ID,
        calendar_id=ILSB_CALENDAR_ID,
        holiday_ids=(
            ILSB_HOLIDAY_LABOR_2026_ID,
            ILSB_HOLIDAY_VETERANS_2026_ID,
            ILSB_HOLIDAY_THANKS_2026_ID,
        ),
    )
    db.commit()
    for project_id in (PROJECT_ID, ILSB_PROJECT_ID):
        if db.get(Project, str(project_id)):
            holiday_cache.refresh(db, str(project_id))


def _ensure_area(db: Session, area_id, project_id, name: str) -> None:
    if db.get(ProjectArea, str(area_id)):
        return
    db.add(ProjectArea(id=str(area_id), project_id=str(project_id), name=name))
    db.commit()


def seed_field_crews(db: Session) -> None:
    """Harbor Yard + ILSB field chain. Greg is GF on both jobs."""
    seed_field_people(db)
    if not db.get(User, str(USER_HARBOR_JM_ID)):
        return
    _ensure_area(db, HARBOR_AREA_YARD_ID, PROJECT_ID, "Yard / docks")
    _ensure_area(db, HARBOR_AREA_ROOF_ID, PROJECT_ID, "Roof")
    _ensure_area(db, ILSB_AREA_L07_ID, ILSB_PROJECT_ID, "Level 07 North")

    assign_person(
        db,
        project_id=str(PROJECT_ID),
        user_id=str(USER_GREG_PE_ID),
        role="general_foreman",
        reports_to_user_id=None,
        area_id=None,
    )
    assign_person(
        db,
        project_id=str(ILSB_PROJECT_ID),
        user_id=str(USER_GREG_PE_ID),
        role="general_foreman",
        reports_to_user_id=None,
        area_id=None,
    )
    assign_person(
        db,
        project_id=str(PROJECT_ID),
        user_id=str(USER_HARBOR_AF_ID),
        role="area_foreman",
        reports_to_user_id=str(USER_GREG_PE_ID),
        area_id=str(HARBOR_AREA_YARD_ID),
    )
    assign_person(
        db,
        project_id=str(PROJECT_ID),
        user_id=str(USER_HARBOR_AF_ROOF_ID),
        role="area_foreman",
        reports_to_user_id=str(USER_GREG_PE_ID),
        area_id=str(HARBOR_AREA_ROOF_ID),
    )
    assign_person(
        db,
        project_id=str(PROJECT_ID),
        user_id=str(USER_HARBOR_FM_ID),
        role="foreman",
        reports_to_user_id=str(USER_HARBOR_AF_ID),
        area_id=str(HARBOR_AREA_YARD_ID),
    )
    assign_person(
        db,
        project_id=str(PROJECT_ID),
        user_id=str(USER_HARBOR_JM_ID),
        role="journeyman",
        reports_to_user_id=str(USER_HARBOR_FM_ID),
        area_id=str(HARBOR_AREA_YARD_ID),
    )
    assign_person(
        db,
        project_id=str(PROJECT_ID),
        user_id=str(USER_HARBOR_AP_ID),
        role="apprentice",
        reports_to_user_id=str(USER_HARBOR_JM_ID),
        area_id=str(HARBOR_AREA_YARD_ID),
    )
    assign_person(
        db,
        project_id=str(ILSB_PROJECT_ID),
        user_id=str(USER_ILSB_AF_ID),
        role="area_foreman",
        reports_to_user_id=str(USER_GREG_PE_ID),
        area_id=str(ILSB_AREA_L07_ID),
    )
    assign_person(
        db,
        project_id=str(ILSB_PROJECT_ID),
        user_id=str(USER_ILSB_FM_ID),
        role="foreman",
        reports_to_user_id=str(USER_ILSB_AF_ID),
        area_id=str(ILSB_AREA_L07_ID),
    )
    assign_person(
        db,
        project_id=str(ILSB_PROJECT_ID),
        user_id=str(USER_ILSB_JM_ID),
        role="journeyman",
        reports_to_user_id=str(USER_ILSB_FM_ID),
        area_id=str(ILSB_AREA_L07_ID),
    )
    assign_person(
        db,
        project_id=str(ILSB_PROJECT_ID),
        user_id=str(USER_ILSB_AP_ID),
        role="apprentice",
        reports_to_user_id=str(USER_ILSB_JM_ID),
        area_id=str(ILSB_AREA_L07_ID),
    )

    if db.get(RFI, str(SAMPLE_ON_CYCLE_ID)) and not db.get(
        DraftMaterialOrder, str(HARBOR_TICKET_ID)
    ):
        db.add(
            DraftMaterialOrder(
                id=str(HARBOR_TICKET_ID),
                rfi_id=str(SAMPLE_ON_CYCLE_ID),
                status="assigned",
                summary="SAMPLE hopper: embed plate at dock. Assigned to Harbor Apprentice.",
                lines=[{"description": "Embed plate at dock", "qty": 1.0, "uom": "EA"}],
                requested_by_user_id=str(USER_HARBOR_JM_ID),
                assigned_to_user_id=str(USER_HARBOR_AP_ID),
            )
        )
        rfi = db.get(RFI, str(SAMPLE_ON_CYCLE_ID))
        if rfi and not rfi.area_id:
            rfi.area_id = str(HARBOR_AREA_YARD_ID)
        db.commit()


def seed_demo(db: Session) -> None:
    paths = ensure_demo_drawings(ASSETS_DIR)
    sizes = {name: png_size(path) for name, path in paths.items()}
    seed_harbor_yard(db, sizes)
    seed_ilsb_catalog(db, sizes)
    seed_project_calendars(db)
    seed_pe_roster(db)
    ingest_ilsb_draft(db)
    seed_sample_graph_rfis(db)
    seed_field_crews(db)


def has_demo_project(db: Session) -> bool:
    return db.scalar(select(Project.id).where(Project.id == str(PROJECT_ID))) is not None
