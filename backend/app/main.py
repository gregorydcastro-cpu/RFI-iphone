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
    age_bucket,
    as_naive_utc,
    bucket_rank,
    days_open,
    utc_now,
    work_stopped,
)
from app.grokbot import GrokbotError, draft_from_preflight
from app.models import (
    Company,
    DraftChangeOrder,
    DraftMaterialOrder,
    Organization,
    Project,
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
    record_official_response,
    request_clarification,
    start_impact_review,
    submit_for_design,
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
    DesignActionResult,
    DesignAnswerBody,
    DesignClarifyBody,
    DraftResult,
    GraphResponse,
    GraphRow,
    PEApproveBody,
    PEApproveResult,
    PESubmitBody,
    PESubmitResult,
    PreflightEnvelope,
    ProjectOut,
    RFIOut,
    SearchHit,
    SearchResponse,
    SheetRevisionOut,
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
) -> SearchResponse:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found.")
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


def _graph_row(rfi: RFI, project_name: str, now) -> GraphRow:
    bucket = age_bucket(
        status=rfi.status, priority=rfi.priority, due_at=rfi.due_at, now=now
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
        days_open=days_open(rfi.created_at, now),
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
) -> GraphResponse:
    now = utc_now()
    stmt = select(RFI, Project.name).join(Project, Project.id == RFI.project_id)
    if project_id:
        if not db.get(Project, project_id):
            raise HTTPException(404, "Project not found.")
        stmt = stmt.where(RFI.project_id == project_id)
    stmt = stmt.options(selectinload(RFI.refs), selectinload(RFI.pins))
    pairs = db.execute(stmt).all()

    open_rows: list[GraphRow] = []
    drafts: list[GraphRow] = []
    closed_or_void = 0
    for rfi, project_name in pairs:
        row = _graph_row(rfi, project_name, now)
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

    return GraphResponse(
        ok=True,
        generated_at=now.isoformat() + "Z",
        timezone="UTC",
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
def create_rfi_draft(raw: dict, db: Session = Depends(get_db)) -> DraftResult:
    try:
        validate_draft_payload(raw)
        envelope = PreflightEnvelope.model_validate(raw)
    except DraftValidationError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(422, f"Invalid preflight_rfi envelope: {exc}") from exc

    project = db.get(Project, str(envelope.project.id))
    if not project:
        raise HTTPException(404, "Project not found.")
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
        cost_impact=drafted.cost_impact,
        schedule_impact=drafted.schedule_impact,
        proposed_solution=drafted.proposed_solution,
        grok_preflight=preflight,
        due_at=None,
        official_response=None,
        submitted_at=None,
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
            {"id": row.id, "status": row.status, "summary": row.summary}
            for row in db.scalars(select(DraftChangeOrder).where(DraftChangeOrder.rfi_id == rfi.id))
        ],
        draft_material_orders=[
            {"id": row.id, "status": row.status, "summary": row.summary}
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


@app.post("/pe/rfis/{rfi_id}/approve_internal_review", response_model=PEApproveResult)
def pe_approve_internal_review(
    rfi_id: str,
    body: PEApproveBody = PEApproveBody(),
    _: str = Depends(require_pe),
    db: Session = Depends(get_db),
) -> PEApproveResult:
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
) -> PESubmitResult:
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
