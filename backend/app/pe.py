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
from app.calendar import (
    DEFAULT_TZ,
    as_aware_utc,
    localize_forward,
    parse_due_time,
    to_naive_utc,
    zone,
)
from app.holiday_cache import holiday_cache
from app.models import (
    Company,
    DraftChangeOrder,
    DraftMaterialOrder,
    ProjectCalendar,
    ProjectRFISettings,
    RFI,
    RFIEvent,
    User,
)
from app.schemas import ALLOWED_PRIORITIES

ANSWER_DISCLAIMER = (
    "An answer is not a change order and does not authorize work."
)

SLA_DAYS = {"standard": 7, "urgent": 3, "work_stopped": 1}
URGENT_DUE_HOURS = 72
WORK_STOPPED_DUE_HOURS = 24
STANDARD_DUE_DAYS = 7
PRIORITY_CONFIRM_COMMENT = "Confirmed on submit."
PRIORITY_RANK = {"standard": 0, "urgent": 1, "work_stopped": 2}
DUE_AT_RULE = (
    "urgent/work_stopped: now_utc + settings hours (elapsed UTC); "
    "standard: +standard_due_days business days at project_calendars.due_time "
    "in project TZ (default America/New_York 17:00), converted to UTC."
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
    reminted: bool = False


def _rfi(db: Session, rfi_id: str) -> RFI:
    row = db.get(RFI, rfi_id)
    if not row:
        raise PEError(f"RFI {rfi_id} not found.")
    return row


def _event(
    db: Session,
    rfi: RFI,
    to_status: str,
    *,
    actor: str = "pe",
    source: str = "pe_helper",
    **payload,
) -> None:
    extra = dict(payload)
    actor = extra.pop("actor", actor)
    source = extra.pop("source", source)
    db.add(
        RFIEvent(
            rfi_id=rfi.id,
            event_type="status_change",
            from_status=rfi.status,
            to_status=to_status,
            payload={"actor": actor, "source": source, **extra},
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


def _settings(db: Session, project_id: str) -> ProjectRFISettings | None:
    return db.scalar(
        select(ProjectRFISettings).where(ProjectRFISettings.project_id == project_id)
    )


def validate_sla_windows(settings: ProjectRFISettings) -> None:
    standard_days = int(settings.standard_due_days or 0)
    urgent_hours = int(settings.urgent_due_hours or 0)
    stop_hours = int(settings.work_stopped_due_hours or 0)
    if standard_days < 1 or urgent_hours < 1 or stop_hours < 1:
        raise PEError(
            "SLA windows must each be >= 1 "
            "(standard_due_days, urgent_due_hours, work_stopped_due_hours)."
        )
    if not (stop_hours <= urgent_hours <= standard_days * 24):
        raise PEError(
            "SLA windows must satisfy work_stopped_due_hours <= "
            "urgent_due_hours <= standard_due_days * 24."
        )


def compute_due_at(
    db: Session,
    project_id: str,
    priority: str,
    work_stopped_flag: bool | None = None,
    *,
    now: datetime | None = None,
    allow_demote: bool = True,
) -> datetime:
    stopped = work_stopped(priority) if work_stopped_flag is None else work_stopped_flag
    normalized = normalize_priority(priority, stopped, allow_demote=allow_demote)
    moment = as_aware_utc(now or utc_now())
    settings = _settings(db, project_id)
    calendar = db.scalar(
        select(ProjectCalendar).where(ProjectCalendar.project_id == project_id)
    )
    standard_days = (
        max(int(settings.standard_due_days), 1) if settings else STANDARD_DUE_DAYS
    )
    urgent_hours = (
        max(int(settings.urgent_due_hours), 1) if settings else URGENT_DUE_HOURS
    )
    stop_hours = (
        max(int(settings.work_stopped_due_hours), 1) if settings else WORK_STOPPED_DUE_HOURS
    )
    if settings:
        validate_sla_windows(settings)
    if normalized == "work_stopped":
        return to_naive_utc(moment + timedelta(hours=stop_hours))
    if normalized == "urgent":
        return to_naive_utc(moment + timedelta(hours=urgent_hours))

    lookup = holiday_cache.get(db, project_id)
    tz = zone(calendar.timezone if calendar else lookup.timezone_name or DEFAULT_TZ)
    local = moment.astimezone(tz)
    unit = (calendar.standard_sla_unit if calendar else lookup.standard_sla_unit) or "business_days"
    if unit == "calendar_days":
        due_date = local.date() + timedelta(days=standard_days)
    else:
        due_date = lookup.add_business_days(local.date(), standard_days)
    due_time = parse_due_time(calendar.due_time if calendar else lookup.due_time)
    due_local = localize_forward(due_date, due_time, tz)
    return to_naive_utc(due_local)


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


def set_priority(
    db: Session,
    rfi_id: str,
    priority: str,
    work_stopped_flag: bool,
    *,
    allow_demote: bool = False,
    source: str = "pe_helper",
    actor: str = "pe",
) -> PEResult:
    rfi = _rfi(db, rfi_id)
    new = normalize_priority(priority, work_stopped_flag, allow_demote=allow_demote)
    old = rfi.priority
    old_rank = PRIORITY_RANK.get(old, 0)
    new_rank = PRIORITY_RANK.get(new, 0)
    if new_rank < old_rank and not allow_demote:
        raise PEError("Lowering priority requires allow_demote.")
    rfi.priority = new
    reminted = False
    if new_rank > old_rank and rfi.status in {"submitted", "ball_in_court"}:
        rfi.due_at = compute_due_at(
            db,
            rfi.project_id,
            new,
            work_stopped(new),
            now=utc_now(),
            allow_demote=allow_demote,
        )
        reminted = True
    db.add(
        RFIEvent(
            rfi_id=rfi.id,
            event_type="priority_change",
            from_status=rfi.status,
            to_status=rfi.status,
            payload={
                "actor": actor,
                "source": source,
                "from_priority": old,
                "to_priority": new,
                "due_at_reminted": reminted,
                "allow_demote": allow_demote,
            },
        )
    )
    db.commit()
    return PEResult(
        True,
        rfi.id,
        rfi.status,
        rfi.rfi_display,
        message="Priority updated.",
        due_at=rfi.due_at,
        assigned=rfi.assigned,
        priority=rfi.priority,
        work_stopped=work_stopped(rfi.priority),
        reminted=reminted,
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
        rfi.due_at = compute_due_at(
            db,
            rfi.project_id,
            rfi.priority,
            work_stopped(rfi.priority),
            now=now,
            allow_demote=True,
        )

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


def record_official_response(
    db: Session,
    rfi_id: str,
    response: str,
    *,
    source: str = "pe_helper",
    actor: str = "pe",
) -> PEResult:
    rfi = _rfi(db, rfi_id)
    _require(rfi, {"submitted", "ball_in_court"}, "record official_response")
    text_body = response.strip()
    if not text_body:
        raise PEError("Official response text is required.")
    if ANSWER_DISCLAIMER.lower() not in text_body.lower():
        text_body = f"{text_body} {ANSWER_DISCLAIMER}"
    prior_priority = rfi.priority
    rfi.official_response = text_body
    rfi.responded_at = utc_now()
    _event(
        db,
        rfi,
        "answered",
        actor=actor,
        source=source,
        action="official_response",
        priority_unchanged=prior_priority,
    )
    db.commit()
    return PEResult(
        True,
        rfi.id,
        rfi.status,
        rfi.rfi_display,
        message="Answer recorded.",
        assigned=rfi.assigned,
        priority=rfi.priority,
        work_stopped=work_stopped(rfi.priority),
        due_at=rfi.due_at,
        submitted_at=rfi.submitted_at,
    )


def request_clarification(
    db: Session,
    rfi_id: str,
    note: str,
    *,
    source: str = "pe_helper",
    actor: str = "pe",
    from_statuses: set[str] | None = None,
) -> PEResult:
    rfi = _rfi(db, rfi_id)
    allowed = from_statuses or {"submitted", "ball_in_court", "answered"}
    _require(rfi, allowed, "request clarification")
    text_body = (note or "").strip()
    if not text_body:
        raise PEError("A clarification note is required.")
    _event(
        db,
        rfi,
        "needs_clarification",
        actor=actor,
        source=source,
        note=text_body,
        action="request_clarification",
        priority_unchanged=rfi.priority,
    )
    rfi.assigned = "Castro GC (aging owner)"
    db.commit()
    return PEResult(
        True,
        rfi.id,
        rfi.status,
        rfi.rfi_display,
        message="GC holding.",
        assigned=rfi.assigned,
        priority=rfi.priority,
        work_stopped=work_stopped(rfi.priority),
    )


def start_impact_review(
    db: Session,
    rfi_id: str,
    *,
    source: str = "pe_helper",
    actor: str = "pe",
) -> PEResult:
    rfi = _rfi(db, rfi_id)
    _require(rfi, {"answered", "needs_clarification"}, "start impact_review")
    if not (rfi.official_response or "").strip():
        raise PEError("Official response is required before impact review.")
    _event(
        db,
        rfi,
        "impact_review",
        actor=actor,
        source=source,
        action="start_impact_review",
        priority_unchanged=rfi.priority,
    )
    rfi.assigned = "Castro GC"
    db.commit()
    return PEResult(
        True,
        rfi.id,
        rfi.status,
        rfi.rfi_display,
        message="GC impact review.",
        assigned=rfi.assigned,
        priority=rfi.priority,
        work_stopped=work_stopped(rfi.priority),
    )


MATERIAL_UOMS = frozenset({"EA", "LF", "SF", "BOX", "SET"})


def _require_official_response(rfi: RFI, action: str) -> None:
    if not (rfi.official_response or "").strip():
        raise PEError(f"Official response is required before {action}.")


def normalize_material_lines(lines: list | None, summary: str | None) -> list[dict]:
    rows: list[dict] = []
    for raw in lines or []:
        if not isinstance(raw, dict):
            raise PEError("Each material line must be an object.")
        description = str(raw.get("description") or "").strip()
        uom = str(raw.get("uom") or "").strip().upper()
        try:
            qty = float(raw.get("qty"))
        except (TypeError, ValueError) as exc:
            raise PEError("Material qty must be a number greater than 0.") from exc
        if not description:
            raise PEError("Each material line needs a description.")
        if qty <= 0:
            raise PEError("Material qty must be greater than 0.")
        if uom not in MATERIAL_UOMS:
            raise PEError(f"Material uom must be one of {', '.join(sorted(MATERIAL_UOMS))}.")
        rows.append({"description": description, "qty": qty, "uom": uom})
    if not rows:
        text = (summary or "").strip()
        if not text:
            raise PEError("At least one material line is required.")
        rows = [{"description": text, "qty": 1.0, "uom": "EA"}]
    return rows


def draft_change_order(
    db: Session,
    rfi_id: str,
    summary: str,
    *,
    title: str | None = None,
    cost_amount: float | None = None,
    schedule_days: int | None = None,
    notes: str | None = None,
    source: str = "pe_helper",
    actor: str = "pe",
) -> DraftChangeOrder:
    rfi = _rfi(db, rfi_id)
    _require(rfi, {"impact_review", "answered"}, "draft a change order")
    _require_official_response(rfi, "drafting a change order")
    heading = (title or summary or "").strip()
    if not heading:
        raise PEError("Change order title is required.")
    if cost_amount is not None and cost_amount < 0:
        raise PEError("cost_amount cannot be negative.")
    if schedule_days is not None and schedule_days < 0:
        raise PEError("schedule_days cannot be negative.")
    row = DraftChangeOrder(
        rfi_id=rfi.id,
        status="draft",
        title=heading,
        summary=(summary or heading).strip(),
        cost_amount=cost_amount,
        schedule_days=schedule_days,
        notes=(notes or "").strip() or None,
    )
    db.add(row)
    db.add(
        RFIEvent(
            rfi_id=rfi.id,
            event_type="follow_on_draft",
            from_status=rfi.status,
            to_status=rfi.status,
            payload={
                "actor": actor,
                "source": source,
                "kind": "change_order",
                "status": "draft",
                "title": heading,
            },
        )
    )
    db.commit()
    return row


def draft_material_order(
    db: Session,
    rfi_id: str,
    summary: str | None = None,
    *,
    lines: list | None = None,
    source: str = "pe_helper",
    actor: str = "pe",
) -> DraftMaterialOrder:
    rfi = _rfi(db, rfi_id)
    _require(rfi, {"impact_review", "answered"}, "draft a material order")
    _require_official_response(rfi, "drafting a material order")
    normalized = normalize_material_lines(lines, summary)
    rollup = (summary or "").strip() or f"{len(normalized)} material line(s). Draft only."
    row = DraftMaterialOrder(
        rfi_id=rfi.id,
        status="draft",
        summary=rollup,
        lines=normalized,
    )
    db.add(row)
    db.add(
        RFIEvent(
            rfi_id=rfi.id,
            event_type="follow_on_draft",
            from_status=rfi.status,
            to_status=rfi.status,
            payload={
                "actor": actor,
                "source": source,
                "kind": "material_order",
                "status": "draft",
                "line_count": len(normalized),
            },
        )
    )
    db.commit()
    return row


def close_rfi(
    db: Session,
    rfi_id: str,
    official_response: str | None = None,
    *,
    source: str = "pe_helper",
    actor: str = "pe",
) -> PEResult:
    rfi = _rfi(db, rfi_id)
    if rfi.status in {"draft", "void"}:
        raise PEError(f"Cannot close from status {rfi.status}.")
    _require(rfi, {"impact_review", "answered"}, "close")
    text_body = (official_response or rfi.official_response or "").strip()
    if not text_body:
        raise PEError("Official response is required to close.")
    if ANSWER_DISCLAIMER.lower() not in text_body.lower():
        text_body = f"{text_body} {ANSWER_DISCLAIMER}"
    rfi.official_response = text_body
    rfi.priority = "standard"
    rfi.closed_at = utc_now()
    _event(db, rfi, "closed", actor=actor, source=source, action="close")
    db.commit()
    return PEResult(
        True,
        rfi.id,
        rfi.status,
        rfi.rfi_display,
        message="Closed.",
        assigned=rfi.assigned,
        priority=rfi.priority,
        work_stopped=False,
    )


def void_rfi(
    db: Session,
    rfi_id: str,
    *,
    source: str = "pe_helper",
    actor: str = "pe",
) -> PEResult:
    rfi = _rfi(db, rfi_id)
    if rfi.status in {"void", "closed"}:
        raise PEError(f"Cannot void from status {rfi.status}.")
    rfi.priority = "standard"
    _event(db, rfi, "void", actor=actor, source=source, action="void")
    db.commit()
    return PEResult(
        True,
        rfi.id,
        rfi.status,
        rfi.rfi_display,
        message="Voided.",
        assigned=rfi.assigned,
        priority=rfi.priority,
        work_stopped=False,
    )
