from __future__ import annotations

import base64
import binascii
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app import db as dbmod
from app.db import get_db, init_db
from app.grokbot import GrokbotError, draft_from_preflight
from app.models import (
    Organization,
    Project,
    RFI,
    RFIAttachment,
    RFIEvent,
    RFIPin,
    RFIRef,
    Sheet,
    SheetRevision,
)
from app.rules import DraftValidationError, is_open_status, validate_draft_payload
from app.schemas import (
    ALL_STATUSES,
    DraftResult,
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
        ProjectOut(id=project.id, name=project.name, organization_name=org_name)
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
            drawing_url=f"/sheet-revisions/{rev.id}/drawing",
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
) -> list[RFI]:
    stmt = (
        select(RFI)
        .options(selectinload(RFI.refs), selectinload(RFI.pins))
        .where(RFI.project_id == project_id)
    )
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
    rows = _search_query(db, project_id, query, sheet_number, grid, statuses, limit)
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


def _missing_for_submit() -> list[str]:
    return ["internal_review"]


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
    return RFIOut(
        id=rfi.id,
        project_id=rfi.project_id,
        status=rfi.status,
        rfi_number=rfi.rfi_number,
        rfi_display=rfi.rfi_display,
        subject=rfi.subject,
        question=rfi.question,
        priority=rfi.priority,
        cost_impact=rfi.cost_impact,
        schedule_impact=rfi.schedule_impact,
        proposed_solution=rfi.proposed_solution,
        grok_preflight=rfi.grok_preflight,
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
                "grid": ref.grid,
            }
            for ref in rfi.refs
        ],
        attachment_count=len(rfi.attachments),
        missing_for_submit=_missing_for_submit() if rfi.status == "draft" else [],
    )
