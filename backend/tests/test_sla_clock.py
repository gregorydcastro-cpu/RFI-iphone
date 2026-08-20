"""Locked SLA clock: due_at, days_open, due_soon, escalate. No Redis."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from app import db as dbmod
from app.aging import DUE_SOON_HOURS, age_bucket, days_open
from app.calendar import CalendarError, HolidayLookup, localize_forward, parse_weekend_days
from app.holiday_cache import holiday_cache
from app.ids import PROJECT_ID
from app.models import ProjectHoliday, ProjectRFISettings
from app.pe import compute_due_at, set_priority
from tests.test_pe_submit import PE_HEADERS, _new_draft, _submit_body

NY = ZoneInfo("America/New_York")
UTC = timezone.utc


def _db():
    return dbmod.SessionLocal()


def _settings(db, **fields) -> ProjectRFISettings:
    row = db.scalar(
        select(ProjectRFISettings).where(ProjectRFISettings.project_id == str(PROJECT_ID))
    )
    for key, value in fields.items():
        setattr(row, key, value)
    db.commit()
    return row


def _refresh():
    db = _db()
    try:
        return holiday_cache.refresh(db, str(PROJECT_ID))
    finally:
        db.close()


def _due_utc(day: date, hour: int = 17, minute: int = 0) -> datetime:
    local = datetime(day.year, day.month, day.day, hour, minute, tzinfo=NY)
    return local.astimezone(UTC).replace(tzinfo=None)


def test_add_business_days_rules():
    lookup = HolidayLookup(
        project_id="x",
        weekend_days=frozenset({5, 6}),
        holidays=frozenset(),
        fingerprint="t",
    )
    thursday = date(2026, 8, 20)
    assert lookup.add_business_days(thursday, 1) == date(2026, 8, 21)
    assert lookup.add_business_days(thursday, 0) == thursday
    saturday = date(2026, 8, 22)
    assert lookup.add_business_days(saturday, 0) == saturday
    assert lookup.add_business_days(date(2026, 8, 21), 1) == date(2026, 8, 24)
    with pytest.raises(CalendarError):
        lookup.add_business_days(thursday, -1)


def test_weekend_days_are_python_weekday_numbers():
    days = parse_weekend_days([5, 6])
    assert days == frozenset({5, 6})
    lookup = HolidayLookup(
        project_id="x",
        weekend_days=days,
        holidays=frozenset(),
        fingerprint="t",
    )
    assert lookup.is_business_day(date(2026, 8, 21)) is True
    assert lookup.is_business_day(date(2026, 8, 22)) is False
    assert lookup.is_business_day(date(2026, 8, 23)) is False
    with pytest.raises(CalendarError):
        parse_weekend_days([0, 1, 2, 3, 4, 5, 6])


def test_dst_gap_folds_forward():
    # 2026-03-08 02:00–03:00 does not exist in America/New_York.
    folded = localize_forward(date(2026, 3, 8), time(2, 30), NY)
    assert folded.hour == 3
    assert folded.minute == 0


def test_standard_due_thursday_plus_one_business_day(client):
    db = _db()
    try:
        _settings(
            db,
            standard_due_days=1,
            urgent_due_hours=1,
            work_stopped_due_hours=1,
        )
        now = datetime(2026, 8, 20, 14, 30, tzinfo=UTC)
        due = compute_due_at(db, str(PROJECT_ID), "standard", False, now=now)
        assert due == _due_utc(date(2026, 8, 21))
    finally:
        db.close()


def test_standard_due_skips_weekend(client):
    db = _db()
    try:
        _settings(
            db,
            standard_due_days=1,
            urgent_due_hours=1,
            work_stopped_due_hours=1,
        )
        now = datetime(2026, 8, 21, 15, 0, tzinfo=UTC)
        due = compute_due_at(db, str(PROJECT_ID), "standard", False, now=now)
        assert due == _due_utc(date(2026, 8, 24))
    finally:
        db.close()


def test_standard_due_skips_active_holiday(client):
    db = _db()
    try:
        _settings(
            db,
            standard_due_days=1,
            urgent_due_hours=1,
            work_stopped_due_hours=1,
        )
        db.add(
            ProjectHoliday(
                project_id=str(PROJECT_ID),
                on_date=date(2026, 8, 21),
                name="Friday shutdown",
                source="manual",
                active=True,
            )
        )
        db.commit()
        holiday_cache.refresh(db, str(PROJECT_ID))
        now = datetime(2026, 8, 20, 14, 30, tzinfo=UTC)
        due = compute_due_at(db, str(PROJECT_ID), "standard", False, now=now)
        assert due == _due_utc(date(2026, 8, 24))
    finally:
        db.close()


def test_urgent_and_stop_are_elapsed_utc_hours_not_business_days(client):
    db = _db()
    try:
        friday = datetime(2026, 8, 21, 20, 0, tzinfo=UTC)
        urgent = compute_due_at(db, str(PROJECT_ID), "urgent", False, now=friday)
        stopped = compute_due_at(db, str(PROJECT_ID), "work_stopped", True, now=friday)
        assert urgent == datetime(2026, 8, 24, 20, 0)
        assert stopped == datetime(2026, 8, 22, 20, 0)
        assert urgent.hour != 21
    finally:
        db.close()


def test_days_open_skips_weekend_holiday_and_today_before_due_time(client):
    lookup = _refresh()
    submitted = datetime(2026, 11, 6, 18, 0)  # Friday
    monday_before = datetime(2026, 11, 9, 20, 30)  # 15:30 NY, before 17:00
    monday_after = datetime(2026, 11, 9, 22, 30)  # 17:30 NY
    assert days_open(submitted_at=submitted, now=monday_before, lookup=lookup) == 0
    assert days_open(submitted_at=submitted, now=monday_after, lookup=lookup) == 1

    veterans_before = datetime(2026, 11, 12, 16, 0)  # Thu 11:00 NY, before 17:00
    veterans_after = datetime(2026, 11, 12, 22, 30)  # Thu 17:30 NY
    tue = datetime(2026, 11, 10, 18, 0)
    # (Tue 10, Wed 11] — Wed is seeded Veterans Day.
    assert days_open(submitted_at=tue, now=veterans_before, lookup=lookup) == 0
    # (Tue 10, Thu 12] — holiday skipped, Thursday counted after due_time.
    assert days_open(submitted_at=tue, now=veterans_after, lookup=lookup) == 1


def test_classify_escalate_overdue_and_due_soon_windows():
    now = datetime(2026, 8, 20, 18, 0)

    assert (
        age_bucket(
            status="ball_in_court",
            priority="work_stopped",
            due_at=now - timedelta(minutes=1),
            now=now,
        )
        == "escalated"
    )
    assert (
        age_bucket(
            status="ball_in_court",
            priority="urgent",
            due_at=now - timedelta(hours=12),
            now=now,
        )
        == "escalated"
    )
    assert (
        age_bucket(
            status="ball_in_court",
            priority="urgent",
            due_at=now - timedelta(hours=11, minutes=59),
            now=now,
        )
        == "overdue"
    )
    assert (
        age_bucket(
            status="ball_in_court",
            priority="standard",
            due_at=now - timedelta(hours=47),
            now=now,
        )
        == "overdue"
    )
    assert (
        age_bucket(
            status="ball_in_court",
            priority="standard",
            due_at=now - timedelta(hours=48),
            now=now,
        )
        == "escalated"
    )

    for status in ("needs_clarification", "answered", "impact_review"):
        assert (
            age_bucket(
                status=status,
                priority="standard",
                due_at=now - timedelta(hours=80),
                now=now,
            )
            == "gc_holding"
        )
        assert (
            age_bucket(
                status=status,
                priority="urgent",
                due_at=now + timedelta(hours=2),
                now=now,
            )
            == "gc_holding"
        )

    assert (
        age_bucket(
            status="impact_review",
            priority="work_stopped",
            due_at=now - timedelta(hours=8),
            now=now,
        )
        == "work_stopped"
    )

    assert DUE_SOON_HOURS == {"work_stopped": 6, "urgent": 12, "standard": 72}
    assert (
        age_bucket(
            status="ball_in_court",
            priority="urgent",
            due_at=now + timedelta(hours=12),
            now=now,
        )
        == "due_soon"
    )
    assert (
        age_bucket(
            status="ball_in_court",
            priority="urgent",
            due_at=now + timedelta(hours=12, minutes=1),
            now=now,
        )
        == "on_cycle"
    )
    assert (
        age_bucket(
            status="ball_in_court",
            priority="standard",
            due_at=now + timedelta(hours=72),
            now=now,
        )
        == "due_soon"
    )
    assert (
        age_bucket(
            status="ball_in_court",
            priority="standard",
            due_at=now + timedelta(hours=72, minutes=1),
            now=now,
        )
        == "on_cycle"
    )
    assert (
        age_bucket(
            status="ball_in_court",
            priority="work_stopped",
            due_at=now + timedelta(hours=6),
            now=now,
        )
        == "work_stopped"
    )


def test_raise_priority_remints_due_at_lower_leaves_it(client):
    rfi_id = _new_draft(client, "Confirm embed conflict at column line C before pour.")
    client.post(f"/pe/rfis/{rfi_id}/approve_internal_review", json={}, headers=PE_HEADERS)
    first = client.post(
        f"/pe/rfis/{rfi_id}/submit", json=_submit_body(), headers=PE_HEADERS
    ).json()
    original_due = first["due_at"]
    assert first["priority"] == "standard"

    raised = client.post(
        f"/pe/rfis/{rfi_id}/set_priority",
        json={"priority": "urgent", "work_stopped": False},
        headers=PE_HEADERS,
    )
    assert raised.status_code == 200
    body = raised.json()
    assert body["priority"] == "urgent"
    assert body["reminted"] is True
    assert body["due_at"] != original_due

    denied = client.post(
        f"/pe/rfis/{rfi_id}/set_priority",
        json={"priority": "standard", "work_stopped": False, "allow_demote": False},
        headers=PE_HEADERS,
    )
    assert denied.status_code == 422

    kept = body["due_at"]
    lowered = client.post(
        f"/pe/rfis/{rfi_id}/set_priority",
        json={"priority": "standard", "work_stopped": False, "allow_demote": True},
        headers=PE_HEADERS,
    ).json()
    assert lowered["priority"] == "standard"
    assert lowered["reminted"] is False
    assert lowered["due_at"] == kept

    db = _db()
    try:
        helper = set_priority(
            db,
            rfi_id,
            "work_stopped",
            True,
            allow_demote=False,
            source="pe_helper",
        )
        assert helper.reminted is True
        assert helper.due_at is not None
    finally:
        db.close()


def test_holiday_cache_refresh_after_write(client):
    db = _db()
    try:
        first = holiday_cache.get(db, str(PROJECT_ID))
        again = holiday_cache.get(db, str(PROJECT_ID))
        assert again is first
        extra = date(2026, 8, 28)
        assert extra not in first.holidays
        db.add(
            ProjectHoliday(
                project_id=str(PROJECT_ID),
                on_date=extra,
                name="Cache probe",
                source="manual",
                active=True,
            )
        )
        db.commit()
        stale = holiday_cache.get(db, str(PROJECT_ID))
        assert extra not in stale.holidays
        warm = holiday_cache.refresh(db, str(PROJECT_ID))
        assert extra in warm.holidays
        assert holiday_cache.get(db, str(PROJECT_ID)) is warm
    finally:
        db.close()
