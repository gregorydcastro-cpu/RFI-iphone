"""RFI module that runs. Model + three writes + require_access + age_rfis.

Hang ABAC on create_rfi_draft, submit_rfi, and set_priority only.
403 body is {policy, reason}. Grokbot never numbers, closes, or work-stops.
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
    "WRITES",
    "age_rfis",
    "grok_subject",
    "require_access",
    "set_priority",
    "submit_rfi",
)
