from __future__ import annotations

import base64
import binascii
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app import db as dbmod
from app.db import get_db, init_db
from app.aging import (
    DAYS_OPEN_RULE,
    DEFAULT_ESCALATE_AFTER_HOURS,
    age_bucket,
    as_naive_utc,
    bucket_rank,
    days_open,
    utc_now,
    work_stopped,
)
from app.calendar import DEFAULT_TZ
from app.access import (
    AccessDenied,
    Action,
    ActorType,
    Env,
    Resource,
    as_uuid,
    flag_up,
    grok_denied,
    handle_material,
    load_rfi,
    must_uuid,
    raise_http,
    require_access,
    resource_from_rfi,
)
from app.field_chain import (
    FieldError,
    assignment_payload,
    grok_out_of_lane,
    grant_work_stop,
    load_actor,
    require_can,
    resolve_actor,
    subject_for,
)
from app.holiday_cache import holiday_cache
from app.grokbot import GrokbotError, draft_from_preflight
from app.models import (
    Company,
    DraftChangeOrder,
    DraftMaterialOrder,
    Organization,
    Project,
    ProjectAssignment,
    ProjectRFISettings,
    RFI,
    RFIAttachment,
    RFIEvent,
    RFIPin,
    RFIRef,
    Sheet,
    SheetRevision,
    User,
)
from app.pe import (
    ANSWER_DISCLAIMER,
    DUE_AT_RULE,
    PEError,
    approve_internal_review,
    last_event_is_internal_approve,
    missing_for_submit,
    close_rfi,
    draft_change_order,
    draft_material_order,
    normalize_material_lines,
    record_official_response,
    request_clarification,
    set_priority,
    start_impact_review,
    submit_for_design,
    void_rfi,
)
from app.rules import DraftValidationError, is_open_status, validate_draft_payload
from app.schemas import (
    AGE_BUCKET_ORDER,
    ALL_STATUSES,
    STATUS_MACHINE_BRANCHES,
    STATUS_MACHINE_MAIN,
    AssigneeCompanyOut,
    AssigneeRosterOut,
    AssigneeUserOut,
    AssignmentOut,
    CrewMemberOut,
    CrewOut,
    DesignActionResult,
    DesignAnswerBody,
    DesignClarifyBody,
    DraftResult,
    GCCloseBody,
    GCDraftChangeOrderBody,
    GCDraftMaterialOrderBody,
    GCDraftResult,
    GraphResponse,
    GraphRow,
    MaterialAssignBody,
    MaterialFlagBody,
    MaterialRequestBody,
    MaterialTicketOut,
    MaterialTicketsOut,
    PEApproveBody,
    PEApproveResult,
    PESetPriorityBody,
    PESetPriorityResult,
    PESubmitBody,
    PESubmitResult,
    PreflightEnvelope,
    ProjectOut,
    RFIOut,
    SearchHit,
    SearchResponse,
    SheetRevisionOut,
    WorkStopGrantBody,
)
from app.seed import seed_demo


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        seed_demo(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Field RFI", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AccessDenied)
async def _access_denied_handler(_, exc: AccessDenied):
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=403,
        content={"detail": {"policy": exc.decision.policy, "reason": exc.decision.reason}},
    )

DEFAULT_PE_TOKEN = "pe-demo"
DEFAULT_DESIGN_TOKEN = "design-demo"
DEFAULT_GC_TOKEN = "gc-demo"


def require_pe(
    x_field_actor: str | None = Header(default=None, alias="X-Field-Actor"),
    x_pe_token: str | None = Header(default=None, alias="X-PE-Token"),
) -> str:
    expected = os.environ.get("RFI_PE_TOKEN", DEFAULT_PE_TOKEN)
    if (x_field_actor or "").strip().lower() != "pe" or (x_pe_token or "") != expected:
        raise HTTPException(403, "PE credentials required. Submit is PE-only.")
    return "pe"


def require_design(
    x_field_actor: str | None = Header(default=None, alias="X-Field-Actor"),
    x_design_token: str | None = Header(default=None, alias="X-Design-Token"),
) -> str:
    expected = os.environ.get("RFI_DESIGN_TOKEN", DEFAULT_DESIGN_TOKEN)
    if (x_field_actor or "").strip().lower() != "design" or (x_design_token or "") != expected:
        raise HTTPException(403, "Design credentials required. Official response is design-only.")
    return "design"


def require_gc(
    x_field_actor: str | None = Header(default=None, alias="X-Field-Actor"),
    x_gc_token: str | None = Header(default=None, alias="X-GC-Token"),
) -> str:
    expected = os.environ.get("RFI_GC_TOKEN", DEFAULT_GC_TOKEN)
    if (x_field_actor or "").strip().lower() != "gc" or (x_gc_token or "") != expected:
        raise HTTPException(403, "GC credentials required. Impact review is GC-only.")
    return "gc"


def _http_field(exc: FieldError) -> HTTPException:
    return HTTPException(exc.status_code, str(exc))


def _http_denied(exc: AccessDenied) -> HTTPException:
    try:
        raise_http(exc)
    except HTTPException as mapped:
        return mapped
    return HTTPException(
        status_code=403,
        detail={"policy": exc.decision.policy, "reason": exc.decision.reason},
    )


def _field_actor(
    db: Session,
    project_id: str,
    x_user_id: str | None,
    x_field_role: str | None = None,
    *,
    office_kind: str | None = None,
):
    try:
        if x_user_id:
            return resolve_actor(
                db,
                project_id,
                user_id=x_user_id.strip(),
                claimed_role=x_field_role,
            )
        if office_kind:
            return resolve_actor(db, project_id, office_kind=office_kind)
    except FieldError as exc:
        raise _http_field(exc) from exc
    raise HTTPException(403, "Actor role is required.")


def _gate(
    db: Session,
    actor,
    action: str,
    *,
    rfi=None,
    ticket=None,
    env=None,
    ctx=None,
    actor_type: ActorType = ActorType.HUMAN,
) -> None:
    try:
        require_can(
            db,
            actor,
            action,
            rfi=rfi,
            ticket=ticket,
            env=env,
            ctx=ctx,
            actor_type=actor_type,
        )
    except AccessDenied as exc:
        raise _http_denied(exc) from exc
    except FieldError as exc:
        if isinstance(exc.__cause__, AccessDenied):
            raise _http_denied(exc.__cause__) from exc
        raise _http_field(exc) from exc


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.get("/projects", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)) -> list[ProjectOut]:
    rows = db.execute(
        select(Project, Organization.name)
        .join(Organization, Organization.id == Project.organization_id)
        .order_by(Project.name)
    ).all()
    return [
        ProjectOut(
            id=project.id,
            name=project.name,
            organization_name=org_name,
            address=project.address,
            architect=project.architect,
            project_number=project.project_number,
        )
        for project, org_name in rows
    ]


@app.get("/projects/{project_id}/crew", response_model=CrewOut)
def project_crew(project_id: str, db: Session = Depends(get_db)) -> CrewOut:
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found.")
    rows = list(
        db.scalars(
            select(ProjectAssignment).where(
                ProjectAssignment.project_id == project_id,
                ProjectAssignment.active.is_(True),
            )
        )
    )
    members: list[CrewMemberOut] = []
    for row in rows:
        try:
            actor = load_actor(db, project_id, row.user_id)
        except FieldError:
            continue
        members.append(
            CrewMemberOut(
                user_id=actor.user_id,
                name=actor.name,
                role=actor.role,
                area_id=actor.area_id,
                area_name=actor.area_name,
                reports_to_user_id=actor.reports_to_user_id,
                boss_name=actor.boss_name,
                active=True,
            )
        )
    members.sort(key=lambda item: (item.role, item.name))
    return CrewOut(ok=True, project_id=project_id, members=members)


@app.get("/me/assignment", response_model=AssignmentOut)
def my_assignment(
    project_id: str,
    user_id: str,
    db: Session = Depends(get_db),
) -> AssignmentOut:
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found.")
    try:
        actor = load_actor(db, project_id, user_id)
    except FieldError as exc:
        raise _http_field(exc) from exc
    return AssignmentOut(**assignment_payload(db, actor))


@app.get("/projects/{project_id}/sheet-revisions", response_model=list[SheetRevisionOut])
def list_sheet_revisions(project_id: str, db: Session = Depends(get_db)) -> list[SheetRevisionOut]:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found.")
    rows = db.execute(
        select(SheetRevision, Sheet)
        .join(Sheet, Sheet.id == SheetRevision.sheet_id)
        .where(Sheet.project_id == project_id)
        .order_by(Sheet.sheet_number, SheetRevision.revision)
    ).all()
    return [
        SheetRevisionOut(
            id=rev.id,
            sheet_id=sheet.id,
            sheet_number=sheet.sheet_number,
            revision=rev.revision,
            discipline=sheet.discipline,
            title=sheet.title,
            drawing_url=rev.file_url or f"/sheet-revisions/{rev.id}/drawing",
            file_url=rev.file_url or f"/sheet-revisions/{rev.id}/drawing",
            page_width=rev.page_width,
            page_height=rev.page_height,
            is_current=bool(rev.is_current),
        )
        for rev, sheet in rows
    ]


@app.get("/sheet-revisions/{revision_id}/drawing")
def get_drawing(revision_id: str, db: Session = Depends(get_db)):
    rev = db.get(SheetRevision, revision_id)
    if not rev:
        raise HTTPException(404, "Sheet revision not found.")
    path = dbmod.ASSETS_DIR / rev.drawing_filename
    if not path.is_file():
        raise HTTPException(404, "Drawing file missing.")
    return FileResponse(path, media_type="image/png")


def _sheet_numbers_for(rfi: RFI) -> list[str]:
    numbers = {ref.sheet_number for ref in rfi.refs if ref.sheet_number}
    return sorted(numbers)


def _grids_for(rfi: RFI) -> list[str]:
    grids = {ref.grid for ref in rfi.refs if ref.grid}
    grids.update(pin.label for pin in rfi.pins if pin.label)
    return sorted(grids)


def _search_query(
    db: Session,
    project_id: str,
    query: str | None,
    sheet_number: str | None,
    grid: str | None,
    status_in: list[str] | None,
    limit: int,
    exclude_sample: bool = True,
) -> list[RFI]:
    stmt = (
        select(RFI)
        .options(selectinload(RFI.refs), selectinload(RFI.pins))
        .where(RFI.project_id == project_id)
    )
    if exclude_sample:
        stmt = stmt.where(RFI.is_sample.is_(False))
    if status_in:
        stmt = stmt.where(RFI.status.in_(status_in))
    if query:
        like = f"%{query.strip()}%"
        stmt = stmt.where(
            or_(RFI.subject.ilike(like), RFI.question.ilike(like), RFI.proposed_solution.ilike(like))
        )
    rfis = list(db.scalars(stmt.order_by(RFI.created_at.desc())).all())

    filtered: list[RFI] = []
    for rfi in rfis:
        sheets = {n.lower() for n in _sheet_numbers_for(rfi)}
        grids = {g.lower() for g in _grids_for(rfi)}
        if sheet_number and sheet_number.lower() not in sheets:
            # Also match via pin -> revision -> sheet
            pin_sheets = _pin_sheet_numbers(db, rfi)
            if sheet_number.lower() not in {s.lower() for s in pin_sheets}:
                continue
        if grid and grid.lower() not in grids:
            continue
        filtered.append(rfi)
        if len(filtered) >= limit:
            break
    return filtered


def _pin_sheet_numbers(db: Session, rfi: RFI) -> list[str]:
    if not rfi.pins:
        return []
    rev_ids = [pin.sheet_revision_id for pin in rfi.pins]
    rows = db.execute(
        select(Sheet.sheet_number)
        .join(SheetRevision, SheetRevision.sheet_id == Sheet.id)
        .where(SheetRevision.id.in_(rev_ids))
    ).all()
    return [row[0] for row in rows]


@app.get("/search_rfis", response_model=SearchResponse)
def search_rfis(
    project_id: str = Query(..., description="Required project UUID"),
    query: str | None = None,
    sheet_number: str | None = None,
    grid: str | None = None,
    status_in: str | None = Query(None, description="Comma-separated statuses"),
    limit: int = Query(10, ge=1, le=25),
    exclude_sample: bool = Query(True, description="Hide PE SAMPLE meeting-log rows"),
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_field_role: str | None = Header(default=None, alias="X-Field-Role"),
) -> SearchResponse:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found.")
    if x_user_id:
        actor = _field_actor(db, project_id, x_user_id, x_field_role)
        if actor.role == "apprentice":
            raise HTTPException(
                403,
                {"policy": "role_allows", "reason": "apprentice cannot view the RFI list"},
            )
    statuses = None
    if status_in:
        statuses = [part.strip() for part in status_in.split(",") if part.strip()]
        bad = [s for s in statuses if s not in ALL_STATUSES]
        if bad:
            raise HTTPException(422, f"Unknown status_in values: {', '.join(bad)}")
    rows = _search_query(
        db, project_id, query, sheet_number, grid, statuses, limit, exclude_sample
    )
    hits = [
        SearchHit(
            id=rfi.id,
            project_id=rfi.project_id,
            status=rfi.status,
            subject=rfi.subject,
            question=rfi.question,
            priority=rfi.priority,
            rfi_display=rfi.rfi_display,
            sheet_numbers=_sheet_numbers_for(rfi) or _pin_sheet_numbers(db, rfi),
            grids=_grids_for(rfi),
            created_at=rfi.created_at.isoformat() if rfi.created_at else None,
        )
        for rfi in rows
    ]
    return SearchResponse(ok=True, count=len(hits), rfis=hits)


def _primary_sheet(rfi: RFI) -> str | None:
    for ref in rfi.refs:
        if ref.sheet_revision_id and ref.sheet_number:
            return ref.sheet_number
    sheets = _sheet_numbers_for(rfi)
    return sheets[0] if sheets else None


def _project_clock(db: Session, project_id: str) -> tuple:
    lookup = holiday_cache.get(db, project_id)
    settings = db.scalar(
        select(ProjectRFISettings).where(ProjectRFISettings.project_id == project_id)
    )
    escalate = (
        int(settings.escalate_after_overdue_hours)
        if settings and settings.escalate_after_overdue_hours is not None
        else DEFAULT_ESCALATE_AFTER_HOURS
    )
    return lookup, escalate


def _graph_row(rfi: RFI, project_name: str, now, lookup, escalate_hours: int) -> GraphRow:
    bucket = age_bucket(
        status=rfi.status,
        priority=rfi.priority,
        due_at=rfi.due_at,
        now=now,
        escalate_after_overdue_hours=escalate_hours,
    )
    due = as_naive_utc(rfi.due_at)
    return GraphRow(
        id=rfi.id,
        project_id=rfi.project_id,
        project_name=project_name,
        rfi_display=rfi.rfi_display,
        rfi_number=rfi.rfi_number,
        subject=rfi.subject,
        sheet_number=_primary_sheet(rfi),
        status=rfi.status,
        priority=rfi.priority,
        work_stopped=work_stopped(rfi.priority),
        assigned=rfi.assigned,
        due_at=due.isoformat() + "Z" if due else None,
        days_open=days_open(submitted_at=rfi.submitted_at, now=now, lookup=lookup),
        age_bucket=bucket,
        is_sample=bool(rfi.is_sample),
        is_draft=rfi.status == "draft" or (
            rfi.status == "internal_review" and rfi.rfi_display is None
        ),
    )


@app.get("/rfi_graph", response_model=GraphResponse)
def rfi_graph(
    project_id: str | None = None,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_field_role: str | None = Header(default=None, alias="X-Field-Role"),
) -> GraphResponse:
    if x_user_id and project_id:
        actor = _field_actor(db, project_id, x_user_id, x_field_role)
        if actor.role == "apprentice":
            raise HTTPException(
                403,
                {"policy": "role_allows", "reason": "apprentice cannot view the RFI list"},
            )
    now = utc_now()
    stmt = select(RFI, Project.name).join(Project, Project.id == RFI.project_id)
    if project_id:
        if not db.get(Project, project_id):
            raise HTTPException(404, "Project not found.")
        stmt = stmt.where(RFI.project_id == project_id)
    stmt = stmt.options(selectinload(RFI.refs), selectinload(RFI.pins))
    pairs = db.execute(stmt).all()

    clocks: dict[str, tuple] = {}
    open_rows: list[GraphRow] = []
    drafts: list[GraphRow] = []
    closed_or_void = 0
    for rfi, project_name in pairs:
        if rfi.project_id not in clocks:
            clocks[rfi.project_id] = _project_clock(db, rfi.project_id)
        lookup, escalate_hours = clocks[rfi.project_id]
        row = _graph_row(rfi, project_name, now, lookup, escalate_hours)
        if rfi.status == "draft" or (
            rfi.status == "internal_review" and rfi.rfi_display is None
        ):
            drafts.append(row)
        elif rfi.status in ("closed", "void"):
            closed_or_void += 1
        else:
            open_rows.append(row)

    open_rows.sort(key=lambda row: (bucket_rank(row.age_bucket), row.subject))
    drafts.sort(key=lambda row: row.subject)
    counts = {bucket: 0 for bucket in AGE_BUCKET_ORDER}
    for row in open_rows:
        if row.age_bucket in counts:
            counts[row.age_bucket] += 1

    zones = {lookup.timezone_name for lookup, _ in clocks.values()}
    graph_tz = next(iter(zones)) if len(zones) == 1 else DEFAULT_TZ
    if project_id and clocks:
        graph_tz = clocks[project_id][0].timezone_name

    return GraphResponse(
        ok=True,
        generated_at=now.isoformat() + "Z",
        timezone=graph_tz,
        days_open_rule=DAYS_OPEN_RULE,
        sample_notice=(
            "Open rows marked SAMPLE / is_sample are PE-seeded examples, "
            "not live ILSB field RFIs. The E-803 vivarium draft is real and unnumbered."
        ),
        status_machine={
            "main": list(STATUS_MACHINE_MAIN),
            "branches": list(STATUS_MACHINE_BRANCHES),
            "note": "Sample diagram of the locked machine. Not live counts.",
        },
        bucket_order=list(AGE_BUCKET_ORDER),
        bucket_counts=counts,
        open=open_rows,
        drafts=drafts,
        closed_or_void_count=closed_or_void,
    )


def _missing_for_submit(rfi: RFI | None = None, db: Session | None = None) -> list[str]:
    if rfi is None:
        return ["internal_review"]
    return missing_for_submit(rfi, db, require_internal_review=True)


def _duplicate_result(rfi: RFI) -> DraftResult:
    return DraftResult(
        ok=False,
        rfi_id=rfi.id,
        status=rfi.status,
        rfi_display=rfi.rfi_display,
        missing_for_submit=[],
        message="An open RFI already exists for this sheet, grid, or subject. Do not duplicate.",
        duplicate=True,
    )


def _find_open_match(
    db: Session,
    project_id: str,
    sheet_number: str | None,
    grid: str | None,
    subject_query: str | None,
) -> RFI | None:
    open_statuses = list({"draft", "submitted", "ball_in_court"})
    # Prefer same sheet / grid; fall back to subject text.
    if sheet_number or grid:
        hits = _search_query(
            db, project_id, None, sheet_number, grid, open_statuses, limit=1
        )
        if hits:
            return hits[0]
    if subject_query:
        hits = _search_query(
            db, project_id, subject_query, None, None, open_statuses, limit=5
        )
        needle = subject_query.strip().lower()
        for hit in hits:
            if needle and needle in (hit.subject or "").lower():
                return hit
            if needle and needle in (hit.question or "").lower():
                return hit
    return None


def _store_photos(rfi_id: str, photos: list) -> list[RFIAttachment]:
    saved: list[RFIAttachment] = []
    dest_dir = dbmod.ATTACHMENTS_DIR / rfi_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    for photo in photos:
        try:
            raw = base64.b64decode(photo.data_base64, validate=False)
        except (binascii.Error, ValueError) as exc:
            raise HTTPException(422, f"Invalid photo encoding: {exc}") from exc
        safe_name = Path(photo.filename).name or f"{uuid.uuid4().hex}.jpg"
        path = dest_dir / safe_name
        path.write_bytes(raw)
        saved.append(
            RFIAttachment(
                rfi_id=rfi_id,
                filename=safe_name,
                content_type=photo.content_type,
                storage_path=str(path),
                kind="photo",
            )
        )
    return saved


@app.post("/create_rfi_draft", response_model=DraftResult)
def create_rfi_draft(
    raw: dict,
    db: Session = Depends(get_db),
    x_on_site: str | None = Header(default=None, alias="X-On-Site"),
) -> DraftResult:
    actor_raw = raw.get("actor") if isinstance(raw, dict) else None
    if not isinstance(actor_raw, dict) or not actor_raw.get("user_id"):
        raise HTTPException(
            403,
            "Actor role is required so a hopper note is never treated as a submitted RFI.",
        )
    project_info = raw.get("project") if isinstance(raw.get("project"), dict) else {}
    project_id = project_info.get("id")
    if not project_id:
        raise HTTPException(422, "project.id is required.")
    project = db.get(Project, str(project_id))
    if not project:
        raise HTTPException(404, "Project not found.")
    # Packet on_behalf_of_role is not a wish. Assignment wins. This write is GROKBOT.
    actor = _field_actor(
        db,
        str(project_id),
        str(actor_raw.get("user_id")),
        actor_raw.get("role"),
    )
    subject = subject_for(db, actor, actor_type=ActorType.GROKBOT)
    try:
        require_access(
            subject,
            Action.CREATE_RFI_DRAFT,
            Resource(
                type="rfi",
                project_id=must_uuid(project_id),
                area_id=subject.area_id,
                status="draft",
                created_by_id=subject.user_id,
            ),
            env=Env(project_id=must_uuid(project_id), area_id=subject.area_id),
        )
    except AccessDenied as exc:
        raise HTTPException(status_code=403, detail=grok_denied(exc.decision))
    lane = grok_out_of_lane(raw, actor.role)
    if lane:
        raise HTTPException(403, lane)
    try:
        validate_draft_payload(raw)
        envelope = PreflightEnvelope.model_validate(raw)
    except DraftValidationError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(422, f"Invalid preflight_rfi envelope: {exc}") from exc

    if project.name != envelope.project.name:
        raise HTTPException(422, "project.name does not match the catalog.")

    sheet_rev = None
    sheet = None
    if envelope.sheet_revision:
        sheet_rev = db.get(SheetRevision, str(envelope.sheet_revision.id))
        if not sheet_rev:
            raise HTTPException(422, "sheet_revision.id is not a known revision.")
        sheet = db.get(Sheet, sheet_rev.sheet_id)
        if not sheet or sheet.project_id != project.id:
            raise HTTPException(422, "Sheet revision is not on this project.")
        if sheet.sheet_number != envelope.sheet_revision.sheet_number:
            raise HTTPException(422, "Pin to a sheet_revision, not a loose sheet number.")
        if sheet_rev.revision != envelope.sheet_revision.revision:
            raise HTTPException(422, "Revision does not match the selected sheet_revision.")

    if envelope.pin and not envelope.sheet_revision:
        raise HTTPException(422, "A pin must target a sheet_revision, not a loose sheet number.")

    has_anchor = bool(envelope.sheet_revision or envelope.pin)
    if not has_anchor:
        raise HTTPException(
            422,
            "A draft requires at least one sheet_revision_id, pin, or ref.",
        )

    for existing in envelope.open_rfis_same_sheet:
        if is_open_status(existing.status):
            if existing.id:
                found = db.get(RFI, str(existing.id))
                if found:
                    return _duplicate_result(found)
            raise HTTPException(
                409,
                "An open RFI already exists for this sheet. Do not duplicate.",
            )

    sheet_number = sheet.sheet_number if sheet else None
    grid = envelope.pin.label if envelope.pin and envelope.pin.label else None
    match = _find_open_match(db, project.id, sheet_number, grid, envelope.user_note[:80] or None)
    if match:
        return _duplicate_result(match)

    try:
        drafted = draft_from_preflight(
            user_note=envelope.user_note,
            sheet_number=sheet_number,
            revision=sheet_rev.revision if sheet_rev else None,
            discipline=sheet.discipline if sheet else None,
            grid=grid,
        )
    except GrokbotError as exc:
        raise HTTPException(422, str(exc)) from exc

    rfi_id = str(uuid.uuid4())
    preflight = {
        "envelope": envelope.model_dump(mode="json"),
        "is_duplicate": False,
        "question_count": drafted.question_count,
        "rewrite_applied": drafted.rewrite_applied,
        "missing_fields": [],
        "notes": drafted.notes,
        "rules": {
            "search_first": True,
            "one_question": True,
            "write": "draft",
            "priority_allowed": ["standard", "urgent"],
            "work_stopped_forbidden": True,
            "never_set": [
                "status",
                "rfi_number",
                "rfi_display",
                "due_at",
                "official_response",
                "submitted_at",
                "closed_at",
            ],
            "disclaimer": "An answer is not a CO and does not authorize work.",
        },
        "drafted": {
            "subject": drafted.subject,
            "question": drafted.question,
            "priority": drafted.priority,
            "cost_impact": drafted.cost_impact,
            "schedule_impact": drafted.schedule_impact,
            "proposed_solution": drafted.proposed_solution,
        },
    }

    rfi = RFI(
        id=rfi_id,
        project_id=project.id,
        rfi_number=None,
        rfi_display=None,
        status="draft",
        subject=drafted.subject,
        question=drafted.question,
        priority=drafted.priority,
        work_stopped=False,
        cost_impact=drafted.cost_impact,
        schedule_impact=drafted.schedule_impact,
        proposed_solution=drafted.proposed_solution,
        grok_preflight=preflight,
        created_by_user_id=actor.user_id or None,
        area_id=actor.area_id,
        due_at=None,
        cycle_due_at=None,
        official_response=None,
        submitted_at=None,
        first_submitted_at=None,
        closed_at=None,
    )
    db.add(rfi)
    db.add(
        RFIEvent(
            rfi_id=rfi_id,
            event_type="status_change",
            from_status=None,
            to_status="draft",
            payload={"source": "create_rfi_draft"},
        )
    )
    if sheet_rev and sheet:
        db.add(
            RFIRef(
                rfi_id=rfi_id,
                sheet_revision_id=sheet_rev.id,
                sheet_number=sheet.sheet_number,
                revision=sheet_rev.revision,
                discipline=sheet.discipline,
                grid=grid,
            )
        )
        if "e-803" in drafted.question.lower() and sheet.sheet_number == "EL107_N":
            db.add(
                RFIRef(
                    rfi_id=rfi_id,
                    sheet_revision_id=None,
                    sheet_number="E-803",
                    revision=None,
                    discipline="E",
                    detail="revision not stated on EL107_N",
                )
            )
    if envelope.pin and sheet_rev:
        db.add(
            RFIPin(
                rfi_id=rfi_id,
                sheet_revision_id=sheet_rev.id,
                x_norm=envelope.pin.x_norm,
                y_norm=envelope.pin.y_norm,
                label=envelope.pin.label,
            )
        )
    for attachment in _store_photos(rfi_id, envelope.photos):
        db.add(attachment)
    db.commit()

    return DraftResult(
        ok=True,
        rfi_id=rfi_id,
        status="draft",
        rfi_display=None,
        missing_for_submit=_missing_for_submit(),
        message="Draft saved. Human numbers stay blank until submit.",
        duplicate=False,
    )


@app.get("/rfis/{rfi_id}", response_model=RFIOut)
def get_rfi(rfi_id: str, db: Session = Depends(get_db)) -> RFIOut:
    rfi = db.execute(
        select(RFI)
        .options(selectinload(RFI.pins), selectinload(RFI.refs), selectinload(RFI.attachments))
        .where(RFI.id == rfi_id)
    ).scalar_one_or_none()
    if not rfi:
        raise HTTPException(404, "RFI not found.")
    return _rfi_out(rfi, db)


def _iso(value) -> str | None:
    if value is None:
        return None
    text = value.isoformat()
    return text if text.endswith("Z") else text + "Z"


def _rfi_out(rfi: RFI, db: Session) -> RFIOut:
    return RFIOut(
        id=rfi.id,
        project_id=rfi.project_id,
        status=rfi.status,
        rfi_number=rfi.rfi_number,
        rfi_display=rfi.rfi_display,
        subject=rfi.subject,
        question=rfi.question,
        priority=rfi.priority,
        work_stopped=work_stopped(rfi.priority),
        cost_impact=rfi.cost_impact,
        schedule_impact=rfi.schedule_impact,
        proposed_solution=rfi.proposed_solution,
        grok_preflight=rfi.grok_preflight,
        assigned=rfi.assigned,
        assigned_to_user_id=rfi.assigned_to_user_id,
        assigned_to_company_id=rfi.assigned_to_company_id,
        official_response=rfi.official_response,
        responded_at=_iso(rfi.responded_at),
        due_at=_iso(rfi.due_at),
        submitted_at=_iso(rfi.submitted_at),
        closed_at=_iso(rfi.closed_at),
        pins=[
            {
                "id": pin.id,
                "sheet_revision_id": pin.sheet_revision_id,
                "x_norm": pin.x_norm,
                "y_norm": pin.y_norm,
                "label": pin.label,
            }
            for pin in rfi.pins
        ],
        refs=[
            {
                "id": ref.id,
                "sheet_revision_id": ref.sheet_revision_id,
                "sheet_number": ref.sheet_number,
                "revision": ref.revision,
                "discipline": ref.discipline,
                "detail": ref.detail,
                "grid": ref.grid,
                "location_id": ref.location_id,
            }
            for ref in rfi.refs
        ],
        attachment_count=len(rfi.attachments),
        missing_for_submit=_missing_for_submit(rfi, db),
        last_internal_review=last_event_is_internal_approve(db, rfi.id),
        draft_change_orders=[
            {
                "id": row.id,
                "status": row.status,
                "title": row.title,
                "summary": row.summary,
                "cost_amount": row.cost_amount,
                "schedule_days": row.schedule_days,
                "notes": row.notes,
            }
            for row in db.scalars(select(DraftChangeOrder).where(DraftChangeOrder.rfi_id == rfi.id))
        ],
        draft_material_orders=[
            {
                "id": row.id,
                "status": row.status,
                "summary": row.summary,
                "lines": row.lines or [],
                "line_count": len(row.lines or []),
            }
            for row in db.scalars(
                select(DraftMaterialOrder).where(DraftMaterialOrder.rfi_id == rfi.id)
            )
        ],
    )


@app.get("/pe/assignees", response_model=AssigneeRosterOut)
def pe_assignees(_: str = Depends(require_pe), db: Session = Depends(get_db)) -> AssigneeRosterOut:
    companies = list(db.scalars(select(Company).order_by(Company.name)))
    users = list(db.scalars(select(User).order_by(User.name)))
    company_names = {row.id: row.name for row in companies}
    return AssigneeRosterOut(
        ok=True,
        companies=[
            AssigneeCompanyOut(id=row.id, name=row.name, kind=row.kind) for row in companies
        ],
        users=[
            AssigneeUserOut(
                id=row.id,
                name=row.name,
                role=row.role,
                company_id=row.company_id,
                company_name=company_names.get(row.company_id) if row.company_id else None,
            )
            for row in users
        ],
    )


def _actor_on_rfi(
    db: Session,
    rfi: RFI,
    x_user_id: str | None,
    x_field_role: str | None,
    *,
    office_kind: str = "pe",
):
    return _field_actor(
        db,
        rfi.project_id,
        x_user_id,
        x_field_role,
        office_kind=office_kind if not x_user_id else None,
    )


@app.post("/pe/rfis/{rfi_id}/approve_internal_review", response_model=PEApproveResult)
def pe_approve_internal_review(
    rfi_id: str,
    body: PEApproveBody = PEApproveBody(),
    _: str = Depends(require_pe),
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_field_role: str | None = Header(default=None, alias="X-Field-Role"),
) -> PEApproveResult:
    rfi = db.get(RFI, rfi_id)
    if not rfi:
        raise HTTPException(404, "RFI not found.")
    actor = _actor_on_rfi(db, rfi, x_user_id, x_field_role)
    _gate(db, actor, "internal_review", rfi=rfi)
    try:
        result = approve_internal_review(db, rfi_id, source="pe_http")
    except PEError as exc:
        raise HTTPException(422, str(exc)) from exc
    return PEApproveResult(
        ok=True,
        rfi_id=result.rfi_id,
        status=result.status,
        rfi_display=result.rfi_display,
        message=result.message,
    )


@app.post("/pe/rfis/{rfi_id}/submit", response_model=PESubmitResult)
def pe_submit_rfi(
    rfi_id: str,
    body: PESubmitBody,
    _: str = Depends(require_pe),
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_field_role: str | None = Header(default=None, alias="X-Field-Role"),
) -> PESubmitResult:
    rfi = db.get(RFI, rfi_id)
    if not rfi:
        raise HTTPException(404, "RFI not found.")
    actor = _actor_on_rfi(db, rfi, x_user_id, x_field_role)
    subject = subject_for(
        db, actor, actor_type=ActorType.HUMAN, project_id=rfi.project_id
    )
    loaded, mapped = load_rfi(db, rfi.id)
    try:
        require_access(
            subject,
            Action.SUBMIT_RFI,
            Resource(
                type="rfi",
                project_id=mapped.project_id,
                area_id=mapped.area_id,
                status=mapped.status,
                created_by_id=mapped.created_by_id,
                crew_foreman_id=mapped.crew_foreman_id,
                requires_internal_review=body.require_internal_review,
            ),
        )
        if body.work_stopped or body.priority == "work_stopped":
            require_access(
                subject,
                Action.SET_PRIORITY,
                Resource(
                    type="rfi",
                    project_id=must_uuid(loaded.project_id),
                    area_id=as_uuid(loaded.area_id),
                    status=loaded.status,
                    priority=loaded.priority,
                    work_stopped=loaded.priority == "work_stopped",
                ),
                ctx={"priority": "work_stopped", "allow_demote": False},
            )
    except AccessDenied as exc:
        raise_http(exc)
    try:
        result = submit_for_design(
            db,
            rfi_id,
            assignee=body.assignee,
            assigned_to_user_id=str(body.assigned_to_user_id) if body.assigned_to_user_id else None,
            assigned_to_company_id=(
                str(body.assigned_to_company_id) if body.assigned_to_company_id else None
            ),
            priority=body.priority,
            work_stopped_flag=body.work_stopped,
            require_internal_review=body.require_internal_review,
            comment=body.comment,
            source="pe_http",
        )
    except PEError as exc:
        raise HTTPException(422, str(exc)) from exc
    return PESubmitResult(
        ok=True,
        rfi_id=result.rfi_id,
        status=result.status,
        rfi_display=result.rfi_display,
        rfi_number=result.rfi_number,
        due_at=_iso(result.due_at),
        submitted_at=_iso(result.submitted_at),
        first_submit=result.first_submit,
        assigned=result.assigned,
        assigned_to_user_id=result.assigned_to_user_id,
        assigned_to_company_id=result.assigned_to_company_id,
        priority=result.priority or "",
        work_stopped=result.work_stopped,
        due_at_rule=DUE_AT_RULE,
        message=result.message,
    )


@app.post("/pe/rfis/{rfi_id}/set_priority", response_model=PESetPriorityResult)
def pe_set_priority(
    rfi_id: str,
    body: PESetPriorityBody,
    _: str = Depends(require_pe),
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_field_role: str | None = Header(default=None, alias="X-Field-Role"),
) -> PESetPriorityResult:
    rfi = db.get(RFI, rfi_id)
    if not rfi:
        raise HTTPException(404, "RFI not found.")
    actor = _actor_on_rfi(db, rfi, x_user_id, x_field_role)
    subject = subject_for(
        db, actor, actor_type=ActorType.HUMAN, project_id=rfi.project_id
    )
    loaded, _ = load_rfi(db, rfi.id)
    try:
        require_access(
            subject,
            Action.SET_PRIORITY,
            Resource(
                type="rfi",
                project_id=must_uuid(loaded.project_id),
                area_id=as_uuid(loaded.area_id),
                status=loaded.status,
                priority=loaded.priority,
                work_stopped=loaded.priority == "work_stopped",
            ),
            ctx={"priority": body.priority, "allow_demote": body.allow_demote},
        )
        if body.allow_demote:
            require_access(
                subject,
                Action.ALLOW_DEMOTE,
                Resource(
                    type="rfi",
                    project_id=must_uuid(loaded.project_id),
                    area_id=as_uuid(loaded.area_id),
                    status=loaded.status,
                    priority=loaded.priority,
                    work_stopped=loaded.priority == "work_stopped",
                ),
            )
    except AccessDenied as exc:
        raise_http(exc)
    try:
        result = set_priority(
            db,
            rfi_id,
            body.priority,
            body.work_stopped,
            allow_demote=body.allow_demote,
            source="pe_http",
            actor="pe",
        )
    except PEError as exc:
        raise HTTPException(422, str(exc)) from exc
    return PESetPriorityResult(
        ok=True,
        rfi_id=result.rfi_id,
        status=result.status,
        rfi_display=result.rfi_display,
        priority=result.priority or "",
        work_stopped=result.work_stopped,
        due_at=_iso(result.due_at),
        reminted=result.reminted,
        message=result.message,
    )


@app.post("/pe/rfis/{rfi_id}/void", response_model=PEApproveResult)
def pe_void_rfi(
    rfi_id: str,
    _: str = Depends(require_pe),
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_field_role: str | None = Header(default=None, alias="X-Field-Role"),
) -> PEApproveResult:
    rfi = db.get(RFI, rfi_id)
    if not rfi:
        raise HTTPException(404, "RFI not found.")
    actor = _actor_on_rfi(db, rfi, x_user_id, x_field_role)
    _gate(db, actor, "void", rfi=rfi)
    try:
        result = void_rfi(db, rfi_id, source="pe_http", actor="pe")
    except PEError as exc:
        raise HTTPException(422, str(exc)) from exc
    return PEApproveResult(
        ok=True,
        rfi_id=result.rfi_id,
        status=result.status,
        rfi_display=result.rfi_display,
        message=result.message,
    )


@app.post("/pe/work_stop_grants")
def pe_grant_work_stop(
    body: WorkStopGrantBody,
    _: str = Depends(require_pe),
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_field_role: str | None = Header(default=None, alias="X-Field-Role"),
    project_id: str | None = Query(default=None),
) -> dict:
    rfi = db.get(RFI, str(body.rfi_id)) if body.rfi_id else None
    pid = project_id or (rfi.project_id if rfi else None)
    if not pid:
        raise HTTPException(422, "project_id or rfi_id is required.")
    actor = _field_actor(db, pid, x_user_id, x_field_role, office_kind="pe" if not x_user_id else None)
    try:
        row = grant_work_stop(
            db,
            grantor=actor,
            grantee_user_id=str(body.grantee_user_id),
            rfi_id=str(body.rfi_id) if body.rfi_id else None,
        )
    except FieldError as exc:
        raise _http_field(exc) from exc
    return {"ok": True, "id": row.id, "grantee_user_id": row.grantee_user_id}


def _ticket_out(row: DraftMaterialOrder) -> MaterialTicketOut:
    return MaterialTicketOut(
        id=row.id,
        rfi_id=row.rfi_id,
        status=row.status,
        summary=row.summary,
        assigned_to_user_id=row.assigned_to_user_id,
        handled_at=_iso(row.handled_at),
        approved_at=_iso(row.approved_at),
        line_count=len(row.lines or []),
    )


@app.get("/field/tickets", response_model=MaterialTicketsOut)
def field_tickets(
    project_id: str,
    user_id: str,
    db: Session = Depends(get_db),
) -> MaterialTicketsOut:
    actor = _field_actor(db, project_id, user_id, None)
    rows = list(db.scalars(select(DraftMaterialOrder)))
    tickets = []
    for row in rows:
        rfi = db.get(RFI, row.rfi_id)
        if not rfi or rfi.project_id != project_id:
            continue
        if actor.role == "apprentice" and row.assigned_to_user_id != actor.user_id:
            continue
        tickets.append(_ticket_out(row))
    return MaterialTicketsOut(ok=True, tickets=tickets)


@app.post("/field/rfis/{rfi_id}/material_request", response_model=MaterialTicketOut)
def field_material_request(
    rfi_id: str,
    body: MaterialRequestBody,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_field_role: str | None = Header(default=None, alias="X-Field-Role"),
) -> MaterialTicketOut:
    rfi = db.get(RFI, rfi_id)
    if not rfi:
        raise HTTPException(404, "RFI not found.")
    actor = _field_actor(db, rfi.project_id, x_user_id, x_field_role)
    _gate(db, actor, "request_material", rfi=rfi)
    try:
        lines = normalize_material_lines(
            [item.model_dump() for item in body.lines], body.summary
        )
    except PEError as exc:
        raise HTTPException(422, str(exc)) from exc
    rollup = (body.summary or "").strip() or f"{len(lines)} material line(s). Draft only."
    row = DraftMaterialOrder(
        rfi_id=rfi.id,
        status="draft",
        summary=rollup,
        lines=lines,
        requested_by_user_id=actor.user_id,
    )
    db.add(row)
    db.add(
        RFIEvent(
            rfi_id=rfi.id,
            event_type="follow_on_draft",
            from_status=rfi.status,
            to_status=rfi.status,
            payload={
                "actor": actor.role,
                "source": "field_http",
                "kind": "material_request",
                "status": "draft",
            },
        )
    )
    db.commit()
    db.refresh(row)
    return _ticket_out(row)


@app.post("/field/material_orders/{ticket_id}/assign", response_model=MaterialTicketOut)
def field_assign_ticket(
    ticket_id: str,
    body: MaterialAssignBody,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_field_role: str | None = Header(default=None, alias="X-Field-Role"),
) -> MaterialTicketOut:
    row = db.get(DraftMaterialOrder, ticket_id)
    if not row:
        raise HTTPException(404, "Ticket not found.")
    rfi = db.get(RFI, row.rfi_id)
    actor = _field_actor(db, rfi.project_id, x_user_id, x_field_role)
    _gate(db, actor, "assign_tickets", rfi=rfi, ticket=row)
    hopper = load_actor(db, rfi.project_id, str(body.user_id))
    if hopper.role != "apprentice":
        raise HTTPException(422, "Tickets are assigned to an apprentice.")
    row.assigned_to_user_id = hopper.user_id
    row.status = "assigned"
    db.commit()
    db.refresh(row)
    return _ticket_out(row)


@app.post("/field/material_orders/{ticket_id}/handle", response_model=MaterialTicketOut)
def field_handle_ticket(
    ticket_id: str,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_field_role: str | None = Header(default=None, alias="X-Field-Role"),
) -> MaterialTicketOut:
    row = db.get(DraftMaterialOrder, ticket_id)
    if not row:
        raise HTTPException(404, "Ticket not found.")
    rfi = db.get(RFI, row.rfi_id)
    actor = _field_actor(db, rfi.project_id, x_user_id, x_field_role)
    subject = subject_for(
        db, actor, actor_type=ActorType.HUMAN, project_id=rfi.project_id
    )
    try:
        handle_material(db, subject, must_uuid(ticket_id))
    except AccessDenied as exc:
        raise_http(exc)
    except KeyError:
        raise HTTPException(404, "Ticket not found.")
    # existing handle rules after this (picked/dropped/photo). Do not skip assign or approve.
    row.handled_at = utc_now()
    row.status = "handled"
    db.commit()
    db.refresh(row)
    return _ticket_out(row)


@app.post("/field/material_orders/{ticket_id}/flag")
def field_flag_ticket(
    ticket_id: str,
    body: MaterialFlagBody,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_field_role: str | None = Header(default=None, alias="X-Field-Role"),
) -> dict:
    row = db.get(DraftMaterialOrder, ticket_id)
    if not row:
        raise HTTPException(404, "Ticket not found.")
    rfi = db.get(RFI, row.rfi_id)
    actor = _field_actor(db, rfi.project_id, x_user_id, x_field_role)
    subject = subject_for(
        db, actor, actor_type=ActorType.HUMAN, project_id=rfi.project_id
    )
    try:
        flag_up(db, subject, must_uuid(ticket_id))
    except AccessDenied as exc:
        raise_http(exc)
    except KeyError:
        raise HTTPException(404, "Ticket not found.")
    if not (body.note or "").strip():
        raise HTTPException(422, "A flag note is required.")
    db.add(
        RFIEvent(
            rfi_id=rfi.id,
            event_type="material_flag",
            from_status=rfi.status,
            to_status=rfi.status,
            payload={
                "actor": actor.role,
                "user_id": actor.user_id,
                "ticket_id": row.id,
                "kind": body.kind,
                "note": body.note.strip(),
            },
        )
    )
    db.commit()
    return {"ok": True, "flagged": True}


@app.post("/field/material_orders/{ticket_id}/approve", response_model=MaterialTicketOut)
def field_approve_ticket(
    ticket_id: str,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_field_role: str | None = Header(default=None, alias="X-Field-Role"),
) -> MaterialTicketOut:
    row = db.get(DraftMaterialOrder, ticket_id)
    if not row:
        raise HTTPException(404, "Ticket not found.")
    rfi = db.get(RFI, row.rfi_id)
    actor = _field_actor(db, rfi.project_id, x_user_id, x_field_role)
    _gate(db, actor, "approve_material", rfi=rfi, ticket=row)
    row.approved_at = utc_now()
    row.status = "approved"
    db.commit()
    db.refresh(row)
    return _ticket_out(row)


def _action_result(result, db: Session, message: str | None = None) -> DesignActionResult:
    rfi = db.get(RFI, result.rfi_id)
    return DesignActionResult(
        ok=True,
        rfi_id=result.rfi_id,
        status=result.status,
        rfi_display=result.rfi_display,
        official_response=rfi.official_response if rfi else None,
        responded_at=_iso(rfi.responded_at) if rfi and rfi.responded_at else None,
        assigned=result.assigned or (rfi.assigned if rfi else None),
        priority=result.priority or (rfi.priority if rfi else None),
        work_stopped=result.work_stopped,
        message=message or result.message,
        disclaimer=ANSWER_DISCLAIMER,
    )


@app.post("/design/rfis/{rfi_id}/official_response", response_model=DesignActionResult)
def design_official_response(
    rfi_id: str,
    body: DesignAnswerBody,
    _: str = Depends(require_design),
    db: Session = Depends(get_db),
) -> DesignActionResult:
    try:
        result = record_official_response(
            db,
            rfi_id,
            body.official_response,
            source="design_http",
            actor="design",
        )
    except PEError as exc:
        raise HTTPException(422, str(exc)) from exc
    return _action_result(result, db)


@app.post("/design/rfis/{rfi_id}/request_clarification", response_model=DesignActionResult)
def design_request_clarification(
    rfi_id: str,
    body: DesignClarifyBody,
    _: str = Depends(require_design),
    db: Session = Depends(get_db),
) -> DesignActionResult:
    try:
        result = request_clarification(
            db,
            rfi_id,
            body.note,
            source="design_http",
            actor="design",
            from_statuses={"submitted", "ball_in_court"},
        )
    except PEError as exc:
        raise HTTPException(422, str(exc)) from exc
    return _action_result(result, db)


@app.post("/gc/rfis/{rfi_id}/start_impact_review", response_model=DesignActionResult)
def gc_start_impact_review(
    rfi_id: str,
    _: str = Depends(require_gc),
    db: Session = Depends(get_db),
) -> DesignActionResult:
    try:
        result = start_impact_review(
            db, rfi_id, source="gc_http", actor="gc"
        )
    except PEError as exc:
        raise HTTPException(422, str(exc)) from exc
    return _action_result(result, db)


@app.post("/gc/rfis/{rfi_id}/draft_change_order", response_model=GCDraftResult)
def gc_draft_change_order(
    rfi_id: str,
    body: GCDraftChangeOrderBody,
    _: str = Depends(require_gc),
    db: Session = Depends(get_db),
) -> GCDraftResult:
    try:
        row = draft_change_order(
            db,
            rfi_id,
            body.title,
            title=body.title,
            cost_amount=body.cost_amount,
            schedule_days=body.schedule_days,
            notes=body.notes,
            source="gc_http",
            actor="gc",
        )
    except PEError as exc:
        raise HTTPException(422, str(exc)) from exc
    rfi = db.get(RFI, rfi_id)
    return GCDraftResult(
        ok=True,
        rfi_id=rfi_id,
        status=rfi.status if rfi else "",
        rfi_display=rfi.rfi_display if rfi else None,
        draft_id=row.id,
        draft_status=row.status,
        kind="change_order",
        title=row.title,
        message="Draft change order saved. Not approved. Does not authorize work.",
        disclaimer=ANSWER_DISCLAIMER,
    )


@app.post("/gc/rfis/{rfi_id}/draft_material_order", response_model=GCDraftResult)
def gc_draft_material_order(
    rfi_id: str,
    body: GCDraftMaterialOrderBody,
    _: str = Depends(require_gc),
    db: Session = Depends(get_db),
) -> GCDraftResult:
    try:
        row = draft_material_order(
            db,
            rfi_id,
            lines=[line.model_dump() for line in body.lines],
            source="gc_http",
            actor="gc",
        )
    except PEError as exc:
        raise HTTPException(422, str(exc)) from exc
    rfi = db.get(RFI, rfi_id)
    return GCDraftResult(
        ok=True,
        rfi_id=rfi_id,
        status=rfi.status if rfi else "",
        rfi_display=rfi.rfi_display if rfi else None,
        draft_id=row.id,
        draft_status=row.status,
        kind="material_order",
        line_count=len(row.lines or []),
        message="Draft material order saved. Not ordered.",
        disclaimer=ANSWER_DISCLAIMER,
    )


@app.post("/gc/rfis/{rfi_id}/close", response_model=DesignActionResult)
def gc_close_rfi(
    rfi_id: str,
    body: GCCloseBody = GCCloseBody(),
    _: str = Depends(require_gc),
    db: Session = Depends(get_db),
) -> DesignActionResult:
    try:
        result = close_rfi(db, rfi_id, source="gc_http", actor="gc")
    except PEError as exc:
        raise HTTPException(422, str(exc)) from exc
    return _action_result(result, db)
