from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.drawings import ensure_demo_drawings, png_size
from app.holiday_cache import holiday_cache
from app.access import seed_role_permissions
from app.field_chain import assign_person
from app.ids import (
    COMPANY_CASTRO_ID,
    COMPANY_SAMPLE_AE_ID,
    COMPANY_SAMPLE_ARCH_ID,
    DEMO_ORG_NAME,
    DEMO_PROJECT_NAME,
    DEMO_REVISION,
    DEMO_SHEET_NUMBER,
    DRAWING_SET_ID,
    LOC_GRID_B4_ID,
    ORG_ID,
    PROJECT_ID,
    REV_E101_A_ID,
    SAMPLE_ON_CYCLE_ID,
    SETTINGS_ID,
    SHEET_E101_ID,
    SHOP_AREA_FLOOR_ID,
    SHOP_AREA_ROOF_ID,
    SHOP_CALENDAR_ID,
    SHOP_DRAFT_NOTES,
    SHOP_DRAFT_PROPOSED,
    SHOP_DRAFT_QUESTION,
    SHOP_DRAFT_RFI_ID,
    SHOP_DRAFT_SUBJECT,
    SHOP_HOLIDAY_LABOR_2026_ID,
    SHOP_HOLIDAY_THANKS_2026_ID,
    SHOP_HOLIDAY_VETERANS_2026_ID,
    SHOP_LOC_ID,
    SHOP_PIN_LABEL,
    SHOP_PIN_X,
    SHOP_PIN_Y,
    SHOP_TICKET_ID,
    USER_GREG_PE_ID,
    USER_HARBOR_AF_ID,
    USER_HARBOR_AF_ROOF_ID,
    USER_HARBOR_AP_ID,
    USER_HARBOR_FM_ID,
    USER_HARBOR_JM_ID,
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


def seed_shop_catalog(db: Session, sizes: dict[str, tuple[int, int]]) -> None:
    if db.get(Project, str(PROJECT_ID)):
        return
    org = db.get(Organization, str(ORG_ID)) or Organization(
        id=str(ORG_ID), name=DEMO_ORG_NAME
    )
    project = Project(
        id=str(PROJECT_ID),
        organization_id=str(ORG_ID),
        name=DEMO_PROJECT_NAME,
        address=None,
        architect=None,
        project_number=None,
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
        name="Sample drawing set",
        issued_on=date(2026, 6, 25),
    )
    sheet = Sheet(
        id=str(SHEET_E101_ID),
        drawing_set_id=str(DRAWING_SET_ID),
        project_id=str(PROJECT_ID),
        sheet_number=DEMO_SHEET_NUMBER,
        title="Sample lighting plan",
        discipline="E",
    )
    revision = _revision(
        REV_E101_A_ID,
        SHEET_E101_ID,
        DEMO_REVISION,
        "e-101-rev-a.png",
        date(2026, 6, 25),
        True,
        sizes,
    )
    location = Location(
        id=str(SHOP_LOC_ID),
        project_id=str(PROJECT_ID),
        name="Shop floor fixtures",
        grid=None,
    )
    grid = Location(
        id=str(LOC_GRID_B4_ID),
        project_id=str(PROJECT_ID),
        name="Grid B-4",
        grid="B-4",
    )
    db.add_all([org, project, settings, drawing_set, sheet, revision, location, grid])
    db.commit()


def _shop_open_match(db: Session) -> RFI | None:
    stmt = (
        select(RFI)
        .where(RFI.project_id == str(PROJECT_ID))
        .where(RFI.status.in_(("draft", "submitted", "ball_in_court")))
    )
    for rfi in db.scalars(stmt):
        refs = db.scalars(select(RFIRef).where(RFIRef.rfi_id == rfi.id)).all()
        sheets = {ref.sheet_number for ref in refs if ref.sheet_number}
        blob = f"{rfi.subject} {rfi.question}".lower()
        if DEMO_SHEET_NUMBER in sheets and "fixture type" in blob:
            return rfi
    return None


def ingest_shop_draft(db: Session) -> RFI | None:
    """search_rfis first; create_rfi_draft only if nothing open on this print."""
    if db.get(RFI, str(SHOP_DRAFT_RFI_ID)):
        return db.get(RFI, str(SHOP_DRAFT_RFI_ID))
    match = _shop_open_match(db)
    if match:
        return match

    preflight = {
        "task": "preflight_rfi",
        "is_duplicate": False,
        "question_count": 1,
        "rewrite_applied": True,
        "missing_fields": [],
        "notes": SHOP_DRAFT_NOTES,
        "search": {
            "project_id": str(PROJECT_ID),
            "sheet_number": DEMO_SHEET_NUMBER,
            "query": "E-101 fixture type",
            "open_count": 0,
        },
        "drafted": {
            "subject": SHOP_DRAFT_SUBJECT,
            "question": SHOP_DRAFT_QUESTION,
            "priority": "standard",
            "cost_impact": "possible",
            "schedule_impact": "possible",
            "proposed_solution": SHOP_DRAFT_PROPOSED,
            "discipline": "E",
        },
    }
    rfi = RFI(
        id=str(SHOP_DRAFT_RFI_ID),
        project_id=str(PROJECT_ID),
        rfi_number=None,
        rfi_display=None,
        status="draft",
        subject=SHOP_DRAFT_SUBJECT,
        question=SHOP_DRAFT_QUESTION,
        priority="standard",
        work_stopped=False,
        cost_impact="possible",
        schedule_impact="possible",
        proposed_solution=SHOP_DRAFT_PROPOSED,
        grok_preflight=preflight,
    )
    db.add(rfi)
    db.add(
        RFIEvent(
            rfi_id=str(SHOP_DRAFT_RFI_ID),
            event_type="status_change",
            from_status=None,
            to_status="draft",
            payload={"source": "create_rfi_draft", "ingest": "E-101"},
        )
    )
    db.add(
        RFIRef(
            rfi_id=str(SHOP_DRAFT_RFI_ID),
            sheet_revision_id=str(REV_E101_A_ID),
            sheet_number=DEMO_SHEET_NUMBER,
            revision=DEMO_REVISION,
            discipline="E",
            location_id=str(SHOP_LOC_ID),
        )
    )
    db.add(
        RFIPin(
            rfi_id=str(SHOP_DRAFT_RFI_ID),
            sheet_revision_id=str(REV_E101_A_ID),
            x_norm=SHOP_PIN_X,
            y_norm=SHOP_PIN_Y,
            label=SHOP_PIN_LABEL,
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
                id=str(COMPANY_SAMPLE_ARCH_ID),
                project_id=None,
                name="Sample Architect",
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
    """Idempotent G-Line Shop Test calendar. In-process holidays only."""
    _ensure_calendar(
        db,
        project_id=PROJECT_ID,
        calendar_id=SHOP_CALENDAR_ID,
        holiday_ids=(
            SHOP_HOLIDAY_LABOR_2026_ID,
            SHOP_HOLIDAY_VETERANS_2026_ID,
            SHOP_HOLIDAY_THANKS_2026_ID,
        ),
    )
    db.commit()
    if db.get(Project, str(PROJECT_ID)):
        holiday_cache.refresh(db, str(PROJECT_ID))


def _ensure_area(db: Session, area_id, project_id, name: str) -> None:
    if db.get(ProjectArea, str(area_id)):
        return
    db.add(ProjectArea(id=str(area_id), project_id=str(project_id), name=name))
    db.commit()


def seed_field_crews(db: Session) -> None:
    """G-Line Shop Test field chain. Greg is GF."""
    seed_field_people(db)
    if not db.get(User, str(USER_HARBOR_JM_ID)):
        return
    _ensure_area(db, SHOP_AREA_FLOOR_ID, PROJECT_ID, "Shop floor")
    _ensure_area(db, SHOP_AREA_ROOF_ID, PROJECT_ID, "Roof")

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
        project_id=str(PROJECT_ID),
        user_id=str(USER_HARBOR_AF_ID),
        role="area_foreman",
        reports_to_user_id=str(USER_GREG_PE_ID),
        area_id=str(SHOP_AREA_FLOOR_ID),
    )
    assign_person(
        db,
        project_id=str(PROJECT_ID),
        user_id=str(USER_HARBOR_AF_ROOF_ID),
        role="area_foreman",
        reports_to_user_id=str(USER_GREG_PE_ID),
        area_id=str(SHOP_AREA_ROOF_ID),
    )
    assign_person(
        db,
        project_id=str(PROJECT_ID),
        user_id=str(USER_HARBOR_FM_ID),
        role="foreman",
        reports_to_user_id=str(USER_HARBOR_AF_ID),
        area_id=str(SHOP_AREA_FLOOR_ID),
    )
    assign_person(
        db,
        project_id=str(PROJECT_ID),
        user_id=str(USER_HARBOR_JM_ID),
        role="journeyman",
        reports_to_user_id=str(USER_HARBOR_FM_ID),
        area_id=str(SHOP_AREA_FLOOR_ID),
    )
    assign_person(
        db,
        project_id=str(PROJECT_ID),
        user_id=str(USER_HARBOR_AP_ID),
        role="apprentice",
        reports_to_user_id=str(USER_HARBOR_JM_ID),
        area_id=str(SHOP_AREA_FLOOR_ID),
    )

    if db.get(RFI, str(SAMPLE_ON_CYCLE_ID)) and not db.get(
        DraftMaterialOrder, str(SHOP_TICKET_ID)
    ):
        db.add(
            DraftMaterialOrder(
                id=str(SHOP_TICKET_ID),
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
            rfi.area_id = str(SHOP_AREA_FLOOR_ID)
        db.commit()


def seed_demo(db: Session) -> None:
    paths = ensure_demo_drawings(ASSETS_DIR)
    sizes = {name: png_size(path) for name, path in paths.items()}
    seed_shop_catalog(db, sizes)
    seed_project_calendars(db)
    seed_pe_roster(db)
    ingest_shop_draft(db)
    seed_sample_graph_rfis(db)
    seed_role_permissions(db)
    seed_field_crews(db)
    db.commit()


def has_demo_project(db: Session) -> bool:
    return db.scalar(select(Project.id).where(Project.id == str(PROJECT_ID))) is not None
