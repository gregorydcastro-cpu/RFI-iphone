"""PE / design / GC helpers and the PE Submit HTTP implementation.

Not Grok tools. Grokbot may only search_rfis and create_rfi_draft.
This module is the other side of the locked machine: internal_review,
first submit, answer, holding, draft follow-ons, and close.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.aging import utc_now, work_stopped
from app.models import (
    Company,
    DraftChangeOrder,
    DraftMaterialOrder,
    ProjectRFISettings,
    RFI,
    RFIEvent,
    User,
)
from app.schemas import ALLOWED_PRIORITIES

ANSWER_DISCLAIMER = (
    "An answer is not a change order and does not authorize work."
)

# Legacy calendar-day map kept for SAMPLE seed comments. First-submit due_at
# uses hours for urgent/work_stopped and a 17:00 UTC clock for standard.
SLA_DAYS = {"standard": 7, "urgent": 3, "work_stopped": 1}
URGENT_DUE_HOURS = 72
WORK_STOPPED_DUE_HOURS = 24
STANDARD_DUE_DAYS = 7
STANDARD_DUE_HOUR = 17
STANDARD_DUE_MINUTE = 0
PRIORITY_CONFIRM_COMMENT = "Confirmed on submit."
DUE_AT_RULE = (
    "urgent: now_utc + 72h; work_stopped: now_utc + 24h; "
    "standard: +7 calendar days at 17:00 UTC. "
    "Project timezone is not seeded (still OFF)."
)

SUBMITTABLE = frozenset({"draft", "internal_review", "needs_clarification"})
BLOCKED = frozenset(
    {
        "submitted",
        "ball_in_court",
        "answered",
        "impact_review",
        "closed",
        "void",
    }
)


class PEError(ValueError):
    pass


@dataclass
class PEResult:
    ok: bool
    rfi_id: str
    status: str
    rfi_display: str | None
    first_submit: bool = False
    rfi_number: int | None = None
    message: str = ""
    due_at: datetime | None = None
    submitted_at: datetime | None = None
    assigned: str | None = None
    assigned_to_user_id: str | None = None
    assigned_to_company_id: str | None = None
    priority: str | None = None
    work_stopped: bool = False


def _rfi(db: Session, rfi_id: str) -> RFI:
    row = db.get(RFI, rfi_id)
    if not row:
        raise PEError(f"RFI {rfi_id} not found.")
    return row


def _event(db: Session, rfi: RFI, to_status: str, **payload) -> None:
    db.add(
        RFIEvent(
            rfi_id=rfi.id,
            event_type="status_change",
            from_status=rfi.status,
            to_status=to_status,
            payload={"actor": "pe", "source": "pe_helper", **payload},
        )
    )
    rfi.status = to_status


def _require(rfi: RFI, allowed: set[str], action: str) -> None:
    if rfi.status not in allowed:
        raise PEError(f"Cannot {action} from status {rfi.status}.")


def last_status_event(db: Session, rfi_id: str) -> RFIEvent | None:
    return db.scalar(
        select(RFIEvent)
        .where(RFIEvent.rfi_id == rfi_id, RFIEvent.event_type == "status_change")
        .order_by(RFIEvent.created_at.desc(), text("rowid desc"))
        .limit(1)
    )


def last_event_is_internal_approve(db: Session, rfi_id: str) -> bool:
    event = last_status_event(db, rfi_id)
    return bool(event and event.to_status == "internal_review")


def normalize_priority(
    priority: str,
    work_stopped_flag: bool,
    *,
    allow_demote: bool = True,
) -> str:
    """Sync priority ↔ work_stopped. work_stopped true iff priority is work_stopped."""
    value = (priority or "").strip().lower()
    if work_stopped_flag:
        return "work_stopped"
    if value == "work_stopped":
        if allow_demote:
            return "standard"
        return "work_stopped"
    if value not in ALLOWED_PRIORITIES:
        raise PEError(f"Invalid priority: {priority}")
    return value


def compute_due_at(priority: str, now: datetime | None = None) -> datetime:
    moment = now or utc_now()
    if priority == "work_stopped":
        return moment + timedelta(hours=WORK_STOPPED_DUE_HOURS)
    if priority == "urgent":
        return moment + timedelta(hours=URGENT_DUE_HOURS)
    day = moment.date() + timedelta(days=STANDARD_DUE_DAYS)
    return datetime(day.year, day.month, day.day, STANDARD_DUE_HOUR, STANDARD_DUE_MINUTE, 0)


def has_pin_or_ref(rfi: RFI) -> bool:
    if rfi.pins:
        return True
    return any(
        ref.sheet_revision_id or (ref.sheet_number or "").strip() for ref in (rfi.refs or [])
    )


def missing_for_submit(
    rfi: RFI,
    db: Session | None = None,
    *,
    require_internal_review: bool = True,
) -> list[str]:
    missing: list[str] = []
    if not (rfi.question or "").strip():
        missing.append("question")
    if not has_pin_or_ref(rfi):
        missing.append("sheet_ref_or_pin")
    if rfi.status in BLOCKED:
        missing.append("status")
    elif rfi.status not in SUBMITTABLE:
        missing.append("status")
    if require_internal_review and rfi.status == "draft":
        if db is None or not last_event_is_internal_approve(db, rfi.id):
            missing.append("internal_review")
    return missing


def resolve_assignment(
    db: Session,
    *,
    assignee: str | None = None,
    assigned_to_user_id: str | None = None,
    assigned_to_company_id: str | None = None,
) -> tuple[str, str | None, str | None]:
    user = db.get(User, assigned_to_user_id) if assigned_to_user_id else None
    if assigned_to_user_id and not user:
        raise PEError("assigned_to_user_id is not a known user.")
    company = db.get(Company, assigned_to_company_id) if assigned_to_company_id else None
    if assigned_to_company_id and not company:
        raise PEError("assigned_to_company_id is not a known company.")
    if user and not company and user.company_id:
        company = db.get(Company, user.company_id)
    parts: list[str] = []
    if user:
        parts.append(user.name)
    if company and (not user or company.name not in parts):
        parts.append(company.name)
    name = (assignee or "").strip() or " — ".join(parts)
    if not name:
        raise PEError(
            "Assign ball-in-court: assigned_to_user_id, assigned_to_company_id, "
            "or an assignee name is required."
        )
    return name, (user.id if user else None), (company.id if company else None)


def approve_internal_review(
    db: Session, rfi_id: str, *, source: str = "pe_helper"
) -> PEResult:
    rfi = _rfi(db, rfi_id)
    _require(rfi, {"draft"}, "approve internal_review")
    _event(db, rfi, "internal_review", source=source, action="approve_internal_review")
    db.commit()
    return PEResult(
        True,
        rfi.id,
        rfi.status,
        rfi.rfi_display,
        message="Moved to internal_review.",
        priority=rfi.priority,
        work_stopped=work_stopped(rfi.priority),
    )


def next_rfi_number(db: Session, project_id: str) -> tuple[int, str]:
    settings = db.scalar(
        select(ProjectRFISettings).where(ProjectRFISettings.project_id == project_id)
    )
    prefix = settings.rfi_prefix if settings else "RFI"
    width = settings.number_width if settings else 4
    current = db.scalar(
        select(func.max(RFI.rfi_number)).where(RFI.project_id == project_id)
    )
    number = int(current or 0) + 1
    return number, f"{prefix}-{number:0{width}d}"


def submit_for_design(
    db: Session,
    rfi_id: str,
    assignee: str | None = None,
    *,
    assigned_to_user_id: str | None = None,
    assigned_to_company_id: str | None = None,
    priority: str | None = None,
    work_stopped_flag: bool | None = None,
    require_internal_review: bool = True,
    comment: str | None = None,
    source: str = "pe_helper",
) -> PEResult:
    """First submit mints rfi_display and due_at, then lands on ball_in_court.

    Not a Grok tool. submitted is written as an event only — no lingering row.
    """
    rfi = _rfi(db, rfi_id)
    if rfi.status in BLOCKED:
        raise PEError(f"Cannot submit from status {rfi.status}.")
    if rfi.status not in SUBMITTABLE:
        raise PEError(f"Cannot submit from status {rfi.status}.")
    if require_internal_review and rfi.status == "draft":
        if not last_event_is_internal_approve(db, rfi.id):
            raise PEError(
                "Internal review must be approved before submit from draft."
            )

    if not (rfi.question or "").strip():
        raise PEError("Question is required to submit.")
    if not has_pin_or_ref(rfi):
        raise PEError("At least one sheet ref or pin is required to submit.")

    chosen_priority = priority if priority is not None else rfi.priority
    chosen_stopped = (
        work_stopped_flag
        if work_stopped_flag is not None
        else work_stopped(chosen_priority)
    )
    rfi.priority = normalize_priority(
        chosen_priority, chosen_stopped, allow_demote=True
    )
    assigned_name, user_id, company_id = resolve_assignment(
        db,
        assignee=assignee,
        assigned_to_user_id=assigned_to_user_id,
        assigned_to_company_id=assigned_to_company_id,
    )
    rfi.assigned = assigned_name
    rfi.assigned_to_user_id = user_id
    rfi.assigned_to_company_id = company_id

    first_submit = rfi.rfi_display is None
    now = utc_now()
    if first_submit:
        number, display = next_rfi_number(db, rfi.project_id)
        rfi.rfi_number = number
        rfi.rfi_display = display
        rfi.submitted_at = now
        rfi.due_at = compute_due_at(rfi.priority, now)

    note = (comment or "").strip()
    _event(
        db,
        rfi,
        "submitted",
        first_submit=first_submit,
        assigned=assigned_name,
        assigned_to_user_id=user_id,
        assigned_to_company_id=company_id,
        priority=rfi.priority,
        work_stopped=work_stopped(rfi.priority),
        comment=note or None,
        priority_comment=PRIORITY_CONFIRM_COMMENT,
        require_internal_review=require_internal_review,
        source=source,
    )
    _event(
        db,
        rfi,
        "ball_in_court",
        first_submit=first_submit,
        source=source,
    )
    db.commit()
    return PEResult(
        True,
        rfi.id,
        rfi.status,
        rfi.rfi_display,
        first_submit=first_submit,
        rfi_number=rfi.rfi_number,
        message="Submitted. Ball in court.",
        due_at=rfi.due_at,
        submitted_at=rfi.submitted_at,
        assigned=rfi.assigned,
        assigned_to_user_id=rfi.assigned_to_user_id,
        assigned_to_company_id=rfi.assigned_to_company_id,
        priority=rfi.priority,
        work_stopped=work_stopped(rfi.priority),
    )


def record_official_response(db: Session, rfi_id: str, response: str) -> PEResult:
    rfi = _rfi(db, rfi_id)
    _require(rfi, {"ball_in_court"}, "record official_response")
    text_body = response.strip()
    if ANSWER_DISCLAIMER.lower() not in text_body.lower():
        text_body = f"{text_body} {ANSWER_DISCLAIMER}"
    rfi.official_response = text_body
    rfi.responded_at = utc_now()
    _event(db, rfi, "answered")
    db.commit()
    return PEResult(True, rfi.id, rfi.status, rfi.rfi_display, message="Answer recorded.")


def request_clarification(db: Session, rfi_id: str, note: str) -> PEResult:
    rfi = _rfi(db, rfi_id)
    _require(rfi, {"ball_in_court", "answered"}, "request clarification")
    _event(db, rfi, "needs_clarification", note=note)
    rfi.assigned = "Castro GC (aging owner)"
    db.commit()
    return PEResult(True, rfi.id, rfi.status, rfi.rfi_display, message="GC holding.")


def start_impact_review(db: Session, rfi_id: str) -> PEResult:
    rfi = _rfi(db, rfi_id)
    _require(rfi, {"answered", "needs_clarification"}, "start impact_review")
    _event(db, rfi, "impact_review")
    rfi.assigned = "Castro GC"
    db.commit()
    return PEResult(True, rfi.id, rfi.status, rfi.rfi_display, message="GC impact review.")


def draft_change_order(db: Session, rfi_id: str, summary: str) -> DraftChangeOrder:
    rfi = _rfi(db, rfi_id)
    _require(rfi, {"impact_review", "answered"}, "draft a change order")
    row = DraftChangeOrder(rfi_id=rfi.id, status="draft", summary=summary)
    db.add(row)
    db.add(
        RFIEvent(
            rfi_id=rfi.id,
            event_type="follow_on_draft",
            from_status=rfi.status,
            to_status=rfi.status,
            payload={"actor": "pe", "kind": "change_order", "status": "draft"},
        )
    )
    db.commit()
    return row


def draft_material_order(db: Session, rfi_id: str, summary: str) -> DraftMaterialOrder:
    rfi = _rfi(db, rfi_id)
    _require(rfi, {"impact_review", "answered"}, "draft a material order")
    row = DraftMaterialOrder(rfi_id=rfi.id, status="draft", summary=summary)
    db.add(row)
    db.add(
        RFIEvent(
            rfi_id=rfi.id,
            event_type="follow_on_draft",
            from_status=rfi.status,
            to_status=rfi.status,
            payload={"actor": "pe", "kind": "material_order", "status": "draft"},
        )
    )
    db.commit()
    return row


def close_rfi(db: Session, rfi_id: str, official_response: str | None = None) -> PEResult:
    rfi = _rfi(db, rfi_id)
    _require(rfi, {"impact_review", "answered"}, "close")
    if official_response:
        text_body = official_response.strip()
        if ANSWER_DISCLAIMER.lower() not in text_body.lower():
            text_body = f"{text_body} {ANSWER_DISCLAIMER}"
        rfi.official_response = text_body
    if work_stopped(rfi.priority):
        rfi.priority = "standard"
    rfi.closed_at = utc_now()
    _event(db, rfi, "closed")
    db.commit()
    return PEResult(True, rfi.id, rfi.status, rfi.rfi_display, message="Closed.")
