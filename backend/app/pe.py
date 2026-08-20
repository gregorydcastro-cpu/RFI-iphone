"""PE / design / GC helpers for tests and seed. Not Grok tools.

Grokbot may only search_rfis and create_rfi_draft. This module is the other
side of the locked machine: internal_review, first submit, answer, holding,
draft follow-ons, and close.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.aging import utc_now, work_stopped
from app.models import (
    DraftChangeOrder,
    DraftMaterialOrder,
    ProjectRFISettings,
    RFI,
    RFIEvent,
)

ANSWER_DISCLAIMER = (
    "An answer is not a change order and does not authorize work."
)

SLA_DAYS = {"standard": 7, "urgent": 3, "work_stopped": 1}


class PEError(ValueError):
    pass


@dataclass
class PEResult:
    ok: bool
    rfi_id: str
    status: str
    rfi_display: str | None
    first_submit: bool = False
    message: str = ""


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


def approve_internal_review(db: Session, rfi_id: str) -> PEResult:
    rfi = _rfi(db, rfi_id)
    _require(rfi, {"draft"}, "approve internal_review")
    _event(db, rfi, "internal_review")
    db.commit()
    return PEResult(True, rfi.id, rfi.status, rfi.rfi_display, message="Moved to internal_review.")


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


def submit_for_design(db: Session, rfi_id: str, assignee: str) -> PEResult:
    """First submit mints rfi_display and due_at, then lands on ball_in_court.

    Not a Grok tool. submitted is written as an event only — no lingering row.
    """
    rfi = _rfi(db, rfi_id)
    _require(rfi, {"internal_review"}, "submit")
    if work_stopped(rfi.priority) and rfi.priority == "work_stopped":
        # PE may hold work_stopped; Grokbot never set it on this path.
        pass
    first_submit = rfi.rfi_display is None
    now = utc_now()
    if first_submit:
        number, display = next_rfi_number(db, rfi.project_id)
        rfi.rfi_number = number
        rfi.rfi_display = display
        rfi.submitted_at = now
        sla = SLA_DAYS.get(rfi.priority, 7)
        rfi.due_at = now + timedelta(days=sla)
    rfi.assigned = assignee
    _event(db, rfi, "submitted", first_submit=first_submit, assigned=assignee)
    _event(db, rfi, "ball_in_court", first_submit=first_submit)
    db.commit()
    return PEResult(
        True,
        rfi.id,
        rfi.status,
        rfi.rfi_display,
        first_submit=first_submit,
        message="Submitted. Ball in court.",
    )


def record_official_response(db: Session, rfi_id: str, response: str) -> PEResult:
    rfi = _rfi(db, rfi_id)
    _require(rfi, {"ball_in_court"}, "record official_response")
    text = response.strip()
    if ANSWER_DISCLAIMER.lower() not in text.lower():
        text = f"{text} {ANSWER_DISCLAIMER}"
    rfi.official_response = text
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
        text = official_response.strip()
        if ANSWER_DISCLAIMER.lower() not in text.lower():
            text = f"{text} {ANSWER_DISCLAIMER}"
        rfi.official_response = text
    if work_stopped(rfi.priority):
        rfi.priority = "standard"
    rfi.closed_at = utc_now()
    _event(db, rfi, "closed")
    db.commit()
    return PEResult(True, rfi.id, rfi.status, rfi.rfi_display, message="Closed.")
