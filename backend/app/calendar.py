"""In-process project calendar: weekends, holidays, due_time, business days.

No Redis, no Prometheus. Python weekday numbers: Mon=0 … Sun=6.
DEFAULT weekend is {5, 6} (Saturday, Sunday). JS {6, 0} is wrong.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ProjectCalendar, ProjectHoliday

DEFAULT_TZ = "America/New_York"
DEFAULT_WEEKEND = frozenset({5, 6})
DEFAULT_DUE_TIME = time(17, 0)
CACHE_TTL_SECONDS = 600


class CalendarError(ValueError):
    pass


def parse_due_time(value: str | time | None) -> time:
    if isinstance(value, time):
        return value.replace(tzinfo=None)
    text = (value or "17:00").strip()
    if text in {"17:00", "17:00:00"}:
        return time(17, 0)
    if text in {"23:59", "23:59:00"}:
        return time(23, 59)
    parts = text.split(":")
    hour = int(parts[0])
    minute = int(parts[1]) if len(parts) > 1 else 0
    if (hour, minute) not in {(17, 0), (23, 59)}:
        # Allowed fallbacks only; anything else becomes 17:00.
        return time(17, 0)
    return time(hour, minute)


def parse_weekend_days(raw) -> frozenset[int]:
    if raw is None:
        days = DEFAULT_WEEKEND
    else:
        days = frozenset(int(item) for item in raw)
    if not days <= frozenset(range(7)):
        raise CalendarError("weekend_days must be Python weekday numbers 0–6.")
    if len(days) >= 7:
        raise CalendarError("weekend_days must leave at least one work day.")
    return days


def zone(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo((name or DEFAULT_TZ).strip() or DEFAULT_TZ)
    except Exception:
        return ZoneInfo(DEFAULT_TZ)


def as_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def to_naive_utc(value: datetime) -> datetime:
    return as_aware_utc(value).replace(tzinfo=None)


def localize_forward(day: date, due: time, tz: ZoneInfo) -> datetime:
    """Combine local date + due_time. DST gap folds forward to the next valid minute."""
    naive = datetime.combine(day, due)
    cursor = naive
    for _ in range(180):
        probe = cursor.replace(tzinfo=tz)
        back = probe.astimezone(timezone.utc).astimezone(tz)
        if back.replace(tzinfo=None) == cursor:
            return probe
        cursor += timedelta(minutes=1)
    return naive.replace(tzinfo=tz)


@dataclass(frozen=True)
class HolidayLookup:
    project_id: str
    weekend_days: frozenset[int]
    holidays: frozenset[date]
    fingerprint: str
    timezone_name: str = DEFAULT_TZ
    due_time: time = DEFAULT_DUE_TIME
    standard_sla_unit: str = "business_days"
    roll_to_business_day: bool = False

    def is_business_day(self, day: date) -> bool:
        if day.weekday() in self.weekend_days:
            return False
        return day not in self.holidays

    def add_business_days(self, start: date, n: int) -> date:
        if n < 0:
            raise CalendarError("add_business_days n must be >= 0.")
        if n == 0:
            return start
        current = start
        added = 0
        while added < n:
            current += timedelta(days=1)
            if self.is_business_day(current):
                added += 1
        return current

    def count_business_days(self, start_exclusive: date, end_inclusive: date) -> int:
        if end_inclusive < start_exclusive:
            return 0
        count = 0
        day = start_exclusive + timedelta(days=1)
        while day <= end_inclusive:
            if self.is_business_day(day):
                count += 1
            day += timedelta(days=1)
        return count


def fingerprint_for(
    weekend_days: frozenset[int],
    holidays: list[tuple[date, datetime | None]],
    tz_name: str,
    due: str,
    unit: str,
) -> str:
    stamps = ",".join(
        f"{on.isoformat()}:{updated.isoformat() if updated else ''}"
        for on, updated in sorted(holidays, key=lambda item: item[0])
    )
    week = ",".join(str(d) for d in sorted(weekend_days))
    return f"{tz_name}|{week}|{due}|{unit}|{stamps}"


def load_holiday_lookup(db: Session, project_id: str) -> HolidayLookup:
    calendar = db.scalar(
        select(ProjectCalendar).where(ProjectCalendar.project_id == project_id)
    )
    rows = list(
        db.scalars(
            select(ProjectHoliday).where(
                ProjectHoliday.project_id == project_id,
                ProjectHoliday.active.is_(True),
            )
        )
    )
    weekend = parse_weekend_days(calendar.weekend_days if calendar else None)
    tz_name = calendar.timezone if calendar else DEFAULT_TZ
    due = parse_due_time(calendar.due_time if calendar else None)
    unit = (calendar.standard_sla_unit if calendar else "business_days") or "business_days"
    holidays = frozenset(row.on_date for row in rows)
    fp = fingerprint_for(
        weekend,
        [(row.on_date, row.updated_at) for row in rows],
        tz_name,
        due.strftime("%H:%M"),
        unit,
    )
    return HolidayLookup(
        project_id=project_id,
        weekend_days=weekend,
        holidays=holidays,
        fingerprint=fp,
        timezone_name=tz_name,
        due_time=due,
        standard_sla_unit=unit,
        roll_to_business_day=bool(calendar.roll_to_business_day) if calendar else False,
    )


def days_open_business(
    *,
    submitted_at: datetime | None,
    now: datetime,
    lookup: HolidayLookup,
) -> int:
    if submitted_at is None:
        return 0
    tz = zone(lookup.timezone_name)
    local_now = as_aware_utc(now).astimezone(tz)
    submitted_local = as_aware_utc(submitted_at).astimezone(tz)
    today = local_now.date()
    end = today
    if local_now.timetz().replace(tzinfo=None) < lookup.due_time:
        end = today - timedelta(days=1)
    return lookup.count_business_days(submitted_local.date(), end)
