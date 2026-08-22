"""Grokbot preflight after a new print. Ask only. Do not auto-close leftovers."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from rfi.access import ActorType, Role, Subject
from rfi.compare import (
    apply_carry_forward,
    compare_revisions,
    preflight_ask,
    search_open_on_revision,
)
from rfi.core import Job, Sheet, SheetRevision, Store, WriteError, create_rfi_draft, submit_rfi
from rfi.tests.conftest import AREA, COMPANY, JOB, USER, subject


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


def _grok() -> Subject:
    return subject(role=Role.GENERAL_FOREMAN, actor_type=ActorType.GROKBOT)


def test_preflight_splits_leftover_and_carried() -> None:
    store = Store()
    store.add_job(Job(id=JOB))
    sheet = store.add_sheet(
        Sheet(id=uuid4(), project_id=JOB, sheet_number="EL107_N", discipline="E")
    )
    old = store.add_revision(
        SheetRevision(id=uuid4(), sheet_id=sheet.id, revision="27", is_current=True)
    )
    leftover = create_rfi_draft(
        store,
        subject(),
        question="Leftover on the old print?",
        pin={"sheet_revision_id": old.id, "x": 0.2, "y": 0.3, "label": "draft"},
    )
    numbered = create_rfi_draft(
        store,
        subject(),
        question="Which breaker?",
        pin={"sheet_revision_id": old.id, "x": 0.4, "y": 0.5, "label": "panel"},
    )
    submit_rfi(store, _foreman(), numbered.id)
    new = store.add_revision(
        SheetRevision(id=uuid4(), sheet_id=sheet.id, revision="28", is_current=True)
    )
    apply_carry_forward(
        store, compare_revisions(store, old.id, new.id), actor_id=_foreman().user_id
    )
    ask = preflight_ask(store, previous_revision_id=old.id)
    assert [row.id for row in ask.leftover] == [leftover.id]
    assert [row.id for row in ask.carried] == [numbered.id]
    assert leftover.status == "draft"
    assert leftover.rfi_number is None
    on_old = {row.id for row in search_open_on_revision(store, old.id)}
    assert leftover.id in on_old
    assert numbered.id in on_old


def test_grokbot_returns_leftover_match_and_does_not_close() -> None:
    store = Store()
    store.add_job(Job(id=JOB))
    sheet = store.add_sheet(
        Sheet(id=uuid4(), project_id=JOB, sheet_number="EL107_N", discipline="E")
    )
    old = store.add_revision(
        SheetRevision(id=uuid4(), sheet_id=sheet.id, revision="27", is_current=True)
    )
    leftover = create_rfi_draft(
        store,
        subject(),
        question="Same hatch on the old print?",
        pin={"sheet_revision_id": old.id, "x": 0.31, "y": 0.48, "label": "leftover"},
    )
    new = store.add_revision(
        SheetRevision(id=uuid4(), sheet_id=sheet.id, revision="28", is_current=True)
    )
    before = len(store.rfis)
    hit = create_rfi_draft(
        store,
        _grok(),
        question="Same hatch on the old print?",
        pin={
            "sheet_revision_id": new.id,
            "x": 0.31,
            "y": 0.48,
            "label": "leftover",
        },
    )
    assert hit.id == leftover.id
    assert leftover.status == "draft"
    assert leftover.rfi_number is None
    assert len(store.rfis) == before


def test_grokbot_returns_carried_open_and_does_not_number() -> None:
    store = Store()
    store.add_job(Job(id=JOB))
    sheet = store.add_sheet(
        Sheet(id=uuid4(), project_id=JOB, sheet_number="EL107_N", discipline="E")
    )
    old = store.add_revision(
        SheetRevision(id=uuid4(), sheet_id=sheet.id, revision="27", is_current=True)
    )
    drafted = create_rfi_draft(
        store,
        subject(),
        question="Clearance at grid A-3?",
        pin={"sheet_revision_id": old.id, "x": 0.28, "y": 0.52, "label": "A-3"},
    )
    submitted = submit_rfi(store, _foreman(), drafted.id)
    number = submitted.rfi_number
    new = store.add_revision(
        SheetRevision(id=uuid4(), sheet_id=sheet.id, revision="28", is_current=True)
    )
    apply_carry_forward(
        store, compare_revisions(store, old.id, new.id), actor_id=_foreman().user_id
    )
    hit = create_rfi_draft(
        store,
        _grok(),
        question="Clearance at grid A-3?",
        pin={
            "sheet_revision_id": new.id,
            "x": 0.28,
            "y": 0.52,
            "label": "A-3",
        },
    )
    assert hit.id == submitted.id
    assert submitted.rfi_number == number
    assert submitted.status == "ball_in_court"


def test_grokbot_creates_only_when_search_finds_no_match() -> None:
    store = Store()
    store.add_job(Job(id=JOB))
    sheet = store.add_sheet(
        Sheet(id=uuid4(), project_id=JOB, sheet_number="EL107_N", discipline="E")
    )
    old = store.add_revision(
        SheetRevision(id=uuid4(), sheet_id=sheet.id, revision="27", is_current=True)
    )
    leftover = create_rfi_draft(
        store,
        subject(),
        question="Leftover on the old print?",
        pin={"sheet_revision_id": old.id, "x": 0.2, "y": 0.3, "label": "draft"},
    )
    new = store.add_revision(
        SheetRevision(id=uuid4(), sheet_id=sheet.id, revision="28", is_current=True)
    )
    fresh = create_rfi_draft(
        store,
        _grok(),
        question="New hatch after Bulletin 46?",
        pin={"sheet_revision_id": new.id, "x": 0.8, "y": 0.8, "label": "new"},
    )
    assert fresh.id != leftover.id
    assert fresh.status == "draft"
    assert fresh.rfi_number is None
    assert leftover.status == "draft"


def test_preflight_does_not_invent_a_revision() -> None:
    store = Store()
    store.add_job(Job(id=JOB))
    with pytest.raises(WriteError, match="not a known revision"):
        create_rfi_draft(
            store,
            _grok(),
            question="Which hatch?",
            pin={"sheet_revision_id": uuid4(), "x": 0.1, "y": 0.1, "label": "x"},
        )
