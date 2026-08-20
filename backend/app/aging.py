"""Read-time age buckets and business-day days_open for the weekly RFI graph.

escalate_after: work_stopped 0h; urgent 12h (matches urgent due_soon);
standard from project_rfi_settings.escalate_after_overdue_hours (default 48).
due_soon windows: work_stopped 6h, urgent 12h, standard 72h.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.calendar import HolidayLookup, days_open_business
from app.schemas import AGE_BUCKET_ORDER, GRAPH_EXCLUDED

DEFAULT_ESCALATE_AFTER_HOURS = 48
URGENT_ESCALATE_AFTER_HOURS = 12
DUE_SOON_HOURS = {
    "work_stopped": 6,
    "urgent": 12,
    "standard": 72,
}

DAYS_OPEN_RULE = (
    "business days in project TZ over (submitted_date, today], "
    "excluding weekends and active holidays; today is not counted before due_time; "
    "not UTC floor(hours/24)"
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


def days_open(
    submitted_at: datetime | None = None,
    now: datetime | None = None,
    *,
    lookup: HolidayLookup | None = None,
    created_at: datetime | None = None,
) -> int:
    """Meeting days_open. Pass lookup for the locked business-day clock.

    created_at is accepted only as a fallback when submitted_at is omitted
    and no lookup is provided (should not be used for the graph).
    """
    moment = as_naive_utc(now) or utc_now()
    start = submitted_at if submitted_at is not None else created_at
    if lookup is not None:
        return days_open_business(submitted_at=start, now=moment, lookup=lookup)
    started = as_naive_utc(start)
    if started is None:
        return 0
    hours = max((moment - started).total_seconds(), 0) / 3600
    return int(hours // 24)


def escalate_after_hours(priority: str, standard_hours: int | None = None) -> int:
    if work_stopped(priority):
        return 0
    if priority == "urgent":
        return URGENT_ESCALATE_AFTER_HOURS
    return int(standard_hours if standard_hours is not None else DEFAULT_ESCALATE_AFTER_HOURS)


def escalate_after(priority: str, standard_hours: int | None = None) -> timedelta:
    return timedelta(hours=escalate_after_hours(priority, standard_hours))


def age_bucket(
    *,
    status: str,
    priority: str,
    due_at: datetime | None,
    now: datetime | None = None,
    escalate_after_overdue_hours: int | None = None,
) -> str | None:
    """First matching bucket in AGE_BUCKET_ORDER, or None if excluded."""
    if status in GRAPH_EXCLUDED:
        return None
    moment = as_naive_utc(now) or utc_now()
    due = as_naive_utc(due_at)
    stopped = work_stopped(priority)
    waiting_on_design = status in ("submitted", "ball_in_court")
    holding = status in (
        "needs_clarification",
        "answered",
        "impact_review",
        "internal_review",
    )
    late = due is not None and moment > due

    if stopped and waiting_on_design and late:
        return "escalated"
    if stopped:
        return "work_stopped"
    if holding:
        return "gc_holding"
    if waiting_on_design and due is None:
        return "missing_due"
    if waiting_on_design and late:
        hours_late = (moment - due).total_seconds() / 3600
        if hours_late >= escalate_after_hours(priority, escalate_after_overdue_hours):
            return "escalated"
        return "overdue"
    if waiting_on_design and due is not None and not late:
        hours_to_due = (due - moment).total_seconds() / 3600
        window = DUE_SOON_HOURS.get(priority, DUE_SOON_HOURS["standard"])
        if 0 < hours_to_due <= window:
            return "due_soon"
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
