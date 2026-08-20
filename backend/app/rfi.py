"""RFI module that runs. Model + three writes + require_access + age_rfis.

Hang ABAC on create_rfi_draft, submit_rfi, and set_priority only.
403 body is {policy, reason}. Grokbot never numbers, closes, or work-stops.

Invariant 1 — work_stopped ⇔ priority = work_stopped
  True iff priority is work_stopped. False iff standard or urgent.
  Enforce on create, edit, and in the DB (rfis_work_stopped_priority_chk,
  NOT VALID this pass). Only set_priority writes the pair. Grokbot must
  not set work_stopped. Demote still needs allow_demote.

Invariant 2 — rfi_number assigned only on first submit
  Null until the first PE submit. Never assigned in a draft, never
  invented in SQL, never rfi_number + N. Resubmit after
  needs_clarification keeps the same number. first_submitted_at is the
  sticky clock for that first submit.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.abac import AccessDenied, Action, ActorType, Role, Subject, require_access
from app.access import must_uuid
from app.aging import age_bucket
from app.models import RFI, RFIEvent, RFIPin, RFIRef
from app.pe import set_priority, submit_for_design

WRITES = ("create_rfi_draft", "submit_rfi", "set_priority")
WORK_STOPPED_PRIORITY = "work_stopped"


def pair_holds(priority: str, work_stopped: bool) -> bool:
    """Invariant 1. work_stopped true iff priority is work_stopped."""
    return bool(work_stopped) is (priority == WORK_STOPPED_PRIORITY)


def is_first_submit(rfi: RFI) -> bool:
    """Invariant 2. rfi_number is null until the first PE submit."""
    return rfi.rfi_number is None


def grok_subject(project_id: str | UUID) -> Subject:
    """Bare Grok tool call. Claimed GF still stops at grokbot_lane on submit."""
    return Subject(
        user_id=UUID(int=0),
        company_id=UUID(int=0),
        project_id=must_uuid(project_id),
        role=Role.GENERAL_FOREMAN,
        actor_type=ActorType.GROKBOT,
        crew_ids=frozenset(),
    )


def submit_rfi(db: Session, rfi_id: str, **kwargs):
    """First PE submit assigns rfi_number. Null on drafts. Not a Grok tool."""
    return submit_for_design(db, rfi_id, **kwargs)


def age_rfis(
    rows: list[RFI],
    *,
    now: datetime | None = None,
    escalate_after_overdue_hours: int | None = None,
) -> list[str | None]:
    """Read-time age buckets. Not a job. Not Redis."""
    return [
        age_bucket(
            status=row.status,
            priority=row.priority,
            due_at=row.due_at,
            now=now,
            escalate_after_overdue_hours=escalate_after_overdue_hours,
        )
        for row in rows
    ]


__all__ = (
    "AccessDenied",
    "Action",
    "RFI",
    "RFIEvent",
    "RFIPin",
    "RFIRef",
    "WORK_STOPPED_PRIORITY",
    "WRITES",
    "age_rfis",
    "grok_subject",
    "is_first_submit",
    "pair_holds",
    "require_access",
    "set_priority",
    "submit_rfi",
)
