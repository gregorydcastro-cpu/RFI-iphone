"""Read-time age buckets for the weekly RFI graph.

No holiday calendar and no project timezone. days_open is floor(life hours / 24)
in UTC. OFF the locked SLA if that SLA is business days in a job TZ.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.schemas import AGE_BUCKET_ORDER, GRAPH_EXCLUDED

# Inferred escalate windows. work_stopped: escalate_after 0 (immediate when late).
ESCALATE_AFTER = {
    "work_stopped": timedelta(0),
    "urgent": timedelta(hours=24),
    "standard": timedelta(hours=72),
}
URGENT_DUE_SOON = timedelta(hours=12)

DAYS_OPEN_RULE = (
    "floor(life_hours/24) calendar days in UTC; not project-TZ business days; "
    "no holiday calendar"
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def as_naive_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def work_stopped(priority: str) -> bool:
    return priority == "work_stopped"


def days_open(created_at: datetime | None, now: datetime | None = None) -> int:
    created = as_naive_utc(created_at)
    if created is None:
        return 0
    moment = as_naive_utc(now) or utc_now()
    hours = max((moment - created).total_seconds(), 0) / 3600
    return int(hours // 24)


def escalate_after(priority: str) -> timedelta:
    return ESCALATE_AFTER.get(priority, ESCALATE_AFTER["standard"])


def age_bucket(
    *,
    status: str,
    priority: str,
    due_at: datetime | None,
    now: datetime | None = None,
) -> str | None:
    """First matching bucket in AGE_BUCKET_ORDER, or None if excluded."""
    if status in GRAPH_EXCLUDED:
        return None
    moment = as_naive_utc(now) or utc_now()
    due = as_naive_utc(due_at)
    stopped = work_stopped(priority)
    if stopped:
        return "work_stopped"

    waiting_on_design = status in ("submitted", "ball_in_court")
    if waiting_on_design and due is not None and moment > due:
        if moment > due + escalate_after(priority):
            return "escalated"
        return "overdue"
    if (
        waiting_on_design
        and due is not None
        and priority == "urgent"
        and timedelta(0) < (due - moment) <= URGENT_DUE_SOON
    ):
        return "due_soon"
    if status in (
        "needs_clarification",
        "answered",
        "impact_review",
        "internal_review",
    ):
        return "gc_holding"
    if waiting_on_design and due is None:
        return "missing_due"
    return "on_cycle"


def bucket_rank(bucket: str | None) -> int:
    if bucket is None:
        return len(AGE_BUCKET_ORDER) + 1
    try:
        return AGE_BUCKET_ORDER.index(bucket)
    except ValueError:
        return len(AGE_BUCKET_ORDER)
