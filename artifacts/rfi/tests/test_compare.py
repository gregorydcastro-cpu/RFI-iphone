"""Compare / carry-forward. A new print does not spawn RFIs."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from rfi.access import ActorType, Role, Subject
from rfi.compare import (
    CompareError,
    apply_carry_forward,
    compare_revisions,
    search_open_on_sheet,
)
from rfi.core import Job, Pin, RFI, Sheet, SheetRevision, Store, create_rfi_draft, submit_rfi
from rfi.tests.conftest import AREA, COMPANY, JOB, USER, subject


def _sheet(store: Store, number: str, *, sheet_id: UUID | None = None) -> Sheet:
    return store.add_sheet(
        Sheet(
            id=sheet_id or uuid4(),
            project_id=JOB,
            sheet_number=number,
            title=number,
            discipline="E",
        )
    )


def _rev(store: Store, sheet: Sheet, revision: str, *, current: bool = False) -> SheetRevision:
    return store.add_revision(
        SheetRevision(id=uuid4(), sheet_id=sheet.id, revision=revision, is_current=current)
    )


def _foreman() -> Subject:
    return Subject(
        user_id=UUID("00000000-0000-4000-8000-000000000002"),
        company_id=COMPANY,
        project_id=JOB,
        role=Role.FOREMAN,
        actor_type=ActorType.HUMAN,
        area_id=AREA,
        crew_ids=frozenset({USER}),
    )


def _pin(store: Store, rfi: RFI, rev: SheetRevision, x: float = 0.28, y: float = 0.52) -> Pin:
    pin = Pin(sheet_revision_id=rev.id, x=x, y=y, label="fixture")
    rfi.pins.append(pin)
    return pin


def test_same_sheet_only() -> None:
    store = Store()
    e201 = _sheet(store, "E-201")
    e202 = _sheet(store, "E-202")
    a = _rev(store, e201, "1")
    b = _rev(store, e202, "1")
    with pytest.raises(CompareError, match="same sheet only"):
        compare_revisions(store, a.id, b.id)


def test_carry_open_copy_xy_same_rfi_row() -> None:
    store = Store()
    store.add_job(Job(id=JOB))
    sheet = _sheet(store, "E-101")
    old = _rev(store, sheet, "A", current=True)
    new = _rev(store, sheet, "B", current=True)
    drafted = create_rfi_draft(
        store,
        subject(),
        question="Which E-101 revision?",
        pin={"sheet_revision_id": old.id, "x": 0.28, "y": 0.52, "label": "fixture"},
    )
    submitted = submit_rfi(store, _foreman(), drafted.id)
    before = len(store.rfis)
    diff = compare_revisions(store, old.id, new.id)
    assert [item.rfi_id for item in diff.carry] == [submitted.id]
    assert diff.leftover == []
    copied = apply_carry_forward(store, diff, actor_id=_foreman().user_id)
    assert len(store.rfis) == before
    assert len(copied) == 1
    assert copied[0].x == 0.28
    assert copied[0].y == 0.52
    assert copied[0].sheet_revision_id == new.id
    assert {pin.sheet_revision_id for pin in submitted.pins} == {old.id, new.id}


def test_closed_and_void_stay_on_old_print() -> None:
    store = Store()
    sheet = _sheet(store, "E-101")
    old = _rev(store, sheet, "A")
    new = _rev(store, sheet, "B")
    closed = RFI(
        id="closed",
        project_id=JOB,
        question="Closed stays.",
        created_by_id=USER,
        status="closed",
        rfi_number=9,
        rfi_display="RFI-9",
    )
    voided = RFI(
        id="voided",
        project_id=JOB,
        question="Void stays.",
        created_by_id=USER,
        status="void",
        rfi_number=10,
        rfi_display="RFI-10",
    )
    store.rfis[closed.id] = closed
    store.rfis[voided.id] = voided
    _pin(store, closed, old)
    _pin(store, voided, old)
    diff = compare_revisions(store, old.id, new.id)
    assert {item.rfi_id for item in diff.stay} == {"closed", "voided"}
    assert diff.carry == []
    apply_carry_forward(store, diff, actor_id=USER)
    assert [pin.sheet_revision_id for pin in closed.pins] == [old.id]
    assert [pin.sheet_revision_id for pin in voided.pins] == [old.id]


def test_unnumbered_drafts_are_leftover_not_carried() -> None:
    store = Store()
    store.add_job(Job(id=JOB))
    sheet = _sheet(store, "E-101")
    old = _rev(store, sheet, "A")
    new = _rev(store, sheet, "B")
    draft = create_rfi_draft(
        store,
        subject(),
        question="Leftover on the old print?",
        pin={"sheet_revision_id": old.id, "x": 0.2, "y": 0.3, "label": "draft"},
    )
    assert draft.rfi_number is None
    diff = compare_revisions(store, old.id, new.id)
    assert [item.rfi_id for item in diff.leftover] == [draft.id]
    assert diff.carry == []
    apply_carry_forward(store, diff, actor_id=USER)
    assert [pin.sheet_revision_id for pin in draft.pins] == [old.id]
    found = search_open_on_sheet(store, sheet.id)
    assert [row.id for row in found] == [draft.id]


def test_already_pinned_on_new_rev_skips_and_second_apply_is_noop() -> None:
    store = Store()
    store.add_job(Job(id=JOB))
    sheet = _sheet(store, "E-101")
    old = _rev(store, sheet, "A")
    new = _rev(store, sheet, "B")
    drafted = create_rfi_draft(
        store,
        subject(),
        question="Already on both prints?",
        pin={"sheet_revision_id": old.id, "x": 0.4, "y": 0.6, "label": "both"},
    )
    submitted = submit_rfi(store, _foreman(), drafted.id)
    submitted.pins.append(Pin(sheet_revision_id=new.id, x=0.4, y=0.6, label="both"))
    diff = compare_revisions(store, old.id, new.id)
    assert [item.rfi_id for item in diff.skip] == [submitted.id]
    assert apply_carry_forward(store, diff, actor_id=USER) == []
    again = compare_revisions(store, old.id, new.id)
    copied = apply_carry_forward(store, again, actor_id=USER)
    assert copied == []
    assert sum(1 for event in store.events if event.event_type == "pin_carried") == 0


def test_apply_twice_writes_one_pin_carried() -> None:
    store = Store()
    store.add_job(Job(id=JOB))
    sheet = _sheet(store, "E-101")
    old = _rev(store, sheet, "A")
    new = _rev(store, sheet, "B")
    drafted = create_rfi_draft(
        store,
        subject(),
        question="Carry once?",
        pin={"sheet_revision_id": old.id, "x": 0.1, "y": 0.2, "label": "once"},
    )
    submitted = submit_rfi(store, _foreman(), drafted.id)
    diff = compare_revisions(store, old.id, new.id)
    first = apply_carry_forward(store, diff, actor_id=_foreman().user_id)
    second = apply_carry_forward(store, diff, actor_id=_foreman().user_id)
    assert len(first) == 1
    assert second == []
    assert len([p for p in submitted.pins if p.sheet_revision_id == new.id]) == 1
    assert sum(1 for event in store.events if event.event_type == "pin_carried") == 1


def test_new_revision_does_not_spawn_rfis() -> None:
    store = Store()
    sheet = _sheet(store, "E-101")
    _rev(store, sheet, "A", current=True)
    before = len(store.rfis)
    _rev(store, sheet, "B", current=True)
    assert len(store.rfis) == before


def test_search_open_on_sheet_is_preflight_and_skips_closed() -> None:
    store = Store()
    store.add_job(Job(id=JOB))
    sheet = _sheet(store, "E-101")
    old = _rev(store, sheet, "A")
    draft = create_rfi_draft(
        store,
        subject(),
        question="Draft leftover?",
        pin={"sheet_revision_id": old.id, "x": 0.2, "y": 0.2, "label": "d"},
    )
    numbered = create_rfi_draft(
        store,
        subject(),
        question="Submitted open?",
        pin={"sheet_revision_id": old.id, "x": 0.3, "y": 0.3, "label": "s"},
    )
    submit_rfi(store, _foreman(), numbered.id)
    closed = RFI(
        id="done",
        project_id=JOB,
        question="Closed out.",
        created_by_id=USER,
        status="closed",
        rfi_number=3,
    )
    store.rfis[closed.id] = closed
    _pin(store, closed, old)
    found = {row.id for row in search_open_on_sheet(store, sheet.id)}
    assert draft.id in found
    assert numbered.id in found
    assert closed.id not in found
