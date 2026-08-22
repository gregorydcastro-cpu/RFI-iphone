"""Impact review: answered → review → close. Drafts only. Grokbot cannot close."""

from __future__ import annotations

from datetime import timedelta
from uuid import UUID, uuid4

import pytest

from rfi.access import AccessDenied, Action, ActorType, Role, Subject, evaluate
from rfi.core import (
    GC_HOLDING,
    Job,
    RFI,
    Sheet,
    SheetRevision,
    Store,
    age_rfis,
    create_rfi_draft,
    set_priority,
    submit_rfi,
)
from rfi.impact import (
    ImpactError,
    close_rfi,
    draft_change_order,
    draft_material_order,
    enter_impact_review,
    record_answer,
    suggest_impact_none,
)
from rfi.tests.conftest import AREA, COMPANY, JOB, OTHER, OTHER_JOB, USER, resource, subject


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


def _af() -> Subject:
    return Subject(
        user_id=UUID("00000000-0000-4000-8000-000000000004"),
        company_id=COMPANY,
        project_id=JOB,
        role=Role.AREA_FOREMAN,
        actor_type=ActorType.HUMAN,
        area_id=AREA,
    )


def _grok() -> Subject:
    return subject(role=Role.GENERAL_FOREMAN, actor_type=ActorType.GROKBOT)


def _answered(store: Store) -> RFI:
    store.add_job(Job(id=JOB))
    sheet = store.add_sheet(
        Sheet(id=uuid4(), project_id=JOB, sheet_number="EL107_N", discipline="E")
    )
    old = store.add_revision(
        SheetRevision(id=uuid4(), sheet_id=sheet.id, revision="27", is_current=False)
    )
    new = store.add_revision(
        SheetRevision(id=uuid4(), sheet_id=sheet.id, revision="28", is_current=True)
    )
    drafted = create_rfi_draft(
        store,
        subject(),
        question="Which breaker?",
        pin={"sheet_revision_id": old.id, "x": 0.2, "y": 0.3, "label": "panel"},
    )
    submitted = submit_rfi(store, _foreman(), drafted.id)
    submitted.pins.append(
        type(submitted.pins[0])(
            sheet_revision_id=new.id,
            x=0.2,
            y=0.3,
            label="panel",
        )
    )
    record_answer(store, submitted.id, "Use 225A.")
    store._impact_sheet = sheet
    store._rev_a = old
    store._rev_b = new
    return submitted


def test_enter_only_from_answered_not_ball_in_court() -> None:
    store = Store()
    store.add_job(Job(id=JOB))
    drafted = create_rfi_draft(store, subject(), question="Clearance?")
    submitted = submit_rfi(store, _foreman(), drafted.id)
    with pytest.raises(AccessDenied) as denied:
        enter_impact_review(store, _foreman(), submitted.id)
    assert denied.value.decision.policy == "status_guard"
    record_answer(store, submitted.id, "Use the detail on the print.")
    entered = enter_impact_review(store, _foreman(), submitted.id)
    assert entered.status == "impact_review"


def test_work_stopped_survives_enter_and_drafts() -> None:
    store = Store()
    rfi = _answered(store)
    set_priority(store, _af(), rfi.id, "work_stopped", work_stopped=True)
    due = rfi.due_at
    number = rfi.rfi_number
    assert rfi.status == "answered"
    mo = draft_material_order(store, _grok(), rfi.id, sku="225A", qty=1)
    assert mo.status == "draft"
    assert rfi.status == "impact_review"
    assert rfi.work_stopped is True
    assert rfi.priority == "work_stopped"
    assert rfi.due_at == due
    assert rfi.rfi_number == number
    with pytest.raises(ImpactError, match="work_stopped"):
        close_rfi(store, _af(), rfi.id)


def test_journeyman_cannot_enter_draft_or_close() -> None:
    store = Store()
    rfi = _answered(store)
    jman = subject()
    with pytest.raises(AccessDenied) as denied:
        enter_impact_review(store, jman, rfi.id)
    assert denied.value.decision.policy == "role_allows"
    enter_impact_review(store, _foreman(), rfi.id)
    with pytest.raises(AccessDenied) as denied:
        draft_change_order(store, jman, rfi.id, description="Move the panel.")
    assert denied.value.decision.policy == "role_allows"
    with pytest.raises(AccessDenied) as denied:
        draft_material_order(store, jman, rfi.id, sku="225A", qty=1)
    assert denied.value.decision.policy == "role_allows"
    with pytest.raises(AccessDenied) as denied:
        close_rfi(store, jman, rfi.id, impact_none=True)
    assert denied.value.decision.policy == "role_allows"


def test_grokbot_drafts_mo_cannot_enter_or_close() -> None:
    store = Store()
    rfi = _answered(store)
    grok = _grok()
    with pytest.raises(AccessDenied) as denied:
        enter_impact_review(store, grok, rfi.id)
    assert denied.value.decision.policy == "grokbot_lane"
    enter_impact_review(store, _foreman(), rfi.id)
    walk = evaluate(grok, Action.DRAFT_MATERIAL_ORDER, resource(status="impact_review"))
    assert walk.decision.allowed is True
    mo = draft_material_order(store, grok, rfi.id, sku="225A", qty=1)
    assert mo.status == "draft"
    assert mo.source == "grokbot"
    assert mo.sheet_revision_id == store._rev_b.id
    assert mo.asked_revision_id == store._rev_a.id
    assert mo.current_revision_id == store._rev_b.id
    assert mo.project_id == rfi.project_id
    assert mo.area_id == rfi.area_id
    assert mo.lines[0].description == "225A"
    assert mo.lines[0].uom == "EA"
    with pytest.raises(AccessDenied) as denied:
        close_rfi(store, grok, rfi.id)
    assert denied.value.decision.policy == "grokbot_lane"
    assert rfi.status == "impact_review"


def test_suggest_impact_none_does_not_close() -> None:
    store = Store()
    rfi = _answered(store)
    suggest_impact_none(store, _grok(), rfi.id)
    assert rfi.status == "impact_review"
    assert rfi.impact_none_suggested is True
    assert rfi.status != "closed"
    with pytest.raises(ImpactError, match="human must confirm"):
        close_rfi(store, _af(), rfi.id)
    closed = close_rfi(store, _af(), rfi.id, impact_none=True)
    assert closed.status == "closed"
    assert closed.impact == "none"


def test_close_requires_spawned_drafts_for_change_or_material() -> None:
    store = Store()
    rfi = _answered(store)
    enter_impact_review(store, _foreman(), rfi.id)
    draft_change_order(store, _foreman(), rfi.id, description="Different homerun.", qty=1)
    with pytest.raises(ImpactError, match="material impact"):
        rfi.impact = "both"
        close_rfi(store, _af(), rfi.id)
    mo = draft_material_order(store, _grok(), rfi.id, sku="225A", qty=1)
    assert mo.status == "draft"
    closed = close_rfi(store, _af(), rfi.id)
    assert closed.status == "closed"
    assert store.change_orders[next(iter(store.change_orders))].status == "draft"
    assert mo.status == "draft"


def test_leftover_draft_is_a_different_ticket() -> None:
    store = Store()
    leftover = create_rfi_draft(store, subject(), question="Leftover on the pin?")
    with pytest.raises(AccessDenied):
        close_rfi(store, _af(), leftover.id, impact_none=True)
    assert leftover.status == "draft"
    assert leftover.rfi_number is None


def test_foreman_cannot_close() -> None:
    store = Store()
    rfi = _answered(store)
    enter_impact_review(store, _foreman(), rfi.id)
    with pytest.raises(AccessDenied) as denied:
        close_rfi(store, _foreman(), rfi.id, impact_none=True)
    assert denied.value.decision.policy == "role_allows"


def test_age_rfis_does_not_escalate_impact_review() -> None:
    store = Store()
    rfi = _answered(store)
    enter_impact_review(store, _foreman(), rfi.id)
    rfi.due_at = store.now - timedelta(days=3)
    assert rfi.status in GC_HOLDING
    assert age_rfis(store, now=store.now) == []
    assert not any(event.event_type == "cycle" for event in store.events)


def test_new_print_is_not_an_answer() -> None:
    store = Store()
    store.add_job(Job(id=JOB))
    sheet = store.add_sheet(Sheet(id=uuid4(), project_id=JOB, sheet_number="EL107_N"))
    store.add_revision(SheetRevision(id=uuid4(), sheet_id=sheet.id, revision="27", is_current=True))
    drafted = create_rfi_draft(
        store,
        subject(),
        question="Which breaker?",
        pin={
            "sheet_revision_id": next(iter(store.revisions.values())).id,
            "x": 0.2,
            "y": 0.2,
            "label": "p",
        },
    )
    submitted = submit_rfi(store, _foreman(), drafted.id)
    store.add_revision(
        SheetRevision(id=uuid4(), sheet_id=sheet.id, revision="28", is_current=True)
    )
    assert submitted.status == "ball_in_court"
    with pytest.raises(AccessDenied):
        enter_impact_review(store, _foreman(), submitted.id)
    with pytest.raises(AccessDenied) as denied:
        draft_change_order(store, _foreman(), submitted.id, description="Move the panel.")
    assert denied.value.decision.policy == "status_guard"
    with pytest.raises(AccessDenied) as denied:
        draft_material_order(store, _grok(), submitted.id, sku="225A", qty=1)
    assert denied.value.decision.policy == "status_guard"


def test_first_draft_from_answered_does_not_need_enter() -> None:
    store = Store()
    rfi = _answered(store)
    assert rfi.status == "answered"
    walk = evaluate(_grok(), Action.DRAFT_CHANGE_ORDER, resource(status="answered"))
    assert walk.decision.allowed is True
    co = draft_change_order(store, _foreman(), rfi.id, description="Different fixture.")
    assert co.status == "draft"
    assert co.rfi_id == rfi.id
    assert co.co_number is None
    assert co.source == "human"
    assert co.project_id == rfi.project_id
    assert co.area_id == rfi.area_id
    assert co.sheet_revision_id == store._rev_b.id
    assert co.asked_revision_id == store._rev_a.id
    assert co.current_revision_id == store._rev_b.id
    assert rfi.status == "impact_review"
    mo = draft_material_order(store, _grok(), rfi.id, sku="225A", qty=1)
    assert mo.status == "draft"
    assert mo.rfi_id == rfi.id


def test_one_rfi_many_co_drafts_each_one_change() -> None:
    store = Store()
    rfi = _answered(store)
    first = draft_change_order(store, _foreman(), rfi.id, description="Different fixture.")
    second = draft_change_order(
        store, _foreman(), rfi.id, description="Different homerun."
    )
    assert first.id != second.id
    assert first.rfi_id == second.rfi_id == rfi.id
    assert {first.description, second.description} == {
        "Different fixture.",
        "Different homerun.",
    }
    assert len([row for row in store.change_orders.values() if row.rfi_id == rfi.id]) == 2
    with pytest.raises(ImpactError, match="one change"):
        draft_change_order(
            store,
            _foreman(),
            rfi.id,
            description="Different fixture and a different homerun.",
        )
    with pytest.raises(ImpactError, match="one change"):
        draft_change_order(
            store,
            _foreman(),
            rfi.id,
            description="Move the panel. Reroute the homerun.",
        )


def test_search_before_insert_returns_existing_draft() -> None:
    store = Store()
    rfi = _answered(store)
    first = draft_change_order(
        store,
        _foreman(),
        rfi.id,
        title="Relocate panel 214",
        description="Answer moved the panel off the old hatch.",
    )
    again = draft_change_order(
        store,
        _foreman(),
        rfi.id,
        title="relocate panel 214,",
        description="Answer moved the panel off the old hatch.",
    )
    assert again.id == first.id
    assert len([row for row in store.change_orders.values() if row.rfi_id == rfi.id]) == 1
    mo = draft_material_order(
        store,
        _grok(),
        rfi.id,
        lines=[{"description": "225A breaker", "qty": 1, "uom": "EA"}],
    )
    twin = draft_material_order(
        store, _grok(), rfi.id, sku="225A breaker", qty=1, uom="EA"
    )
    assert twin.id == mo.id
    extra = draft_material_order(
        store,
        _grok(),
        rfi.id,
        lines=[{"description": "2 in conduit", "qty": 10, "uom": "LF"}],
    )
    assert extra.id == mo.id
    assert [line.uom for line in mo.lines] == ["EA", "LF"]


def test_grokbot_cannot_set_status_other_than_draft() -> None:
    store = Store()
    rfi = _answered(store)
    with pytest.raises(ImpactError, match="Grokbot may only write draft"):
        draft_change_order(
            store,
            _grok(),
            rfi.id,
            title="Relocate panel 214",
            description="Scope change from the answer.",
            status="submitted",
        )
    with pytest.raises(ImpactError, match="Grokbot may only write draft"):
        draft_material_order(
            store, _grok(), rfi.id, sku="225A", qty=1, status="submitted"
        )
    row = draft_change_order(
        store,
        _grok(),
        rfi.id,
        title="Relocate panel 214",
        description="Scope change from the answer.",
    )
    assert row.status == "draft"
    assert row.source == "grokbot"
    assert row.co_number is None


def test_reject_empty_description_wrong_job_and_retarget() -> None:
    store = Store()
    rfi = _answered(store)
    with pytest.raises(ImpactError, match="description is empty"):
        draft_change_order(
            store, _foreman(), rfi.id, title="Relocate panel 214", description=""
        )
    other_sheet = store.add_sheet(
        Sheet(id=uuid4(), project_id=OTHER_JOB, sheet_number="E-999")
    )
    other_rev = store.add_revision(
        SheetRevision(id=uuid4(), sheet_id=other_sheet.id, revision="1", is_current=True)
    )
    with pytest.raises(ImpactError, match="not this job"):
        draft_change_order(
            store,
            _foreman(),
            rfi.id,
            title="Relocate panel 214",
            description="Scope change from the answer.",
            sheet_revision_id=other_rev.id,
        )
    with pytest.raises(ImpactError, match="cannot retarget"):
        draft_change_order(
            store,
            _foreman(),
            rfi.id,
            title="Relocate panel 214",
            description="Scope change from the answer.",
            project_id=OTHER_JOB,
        )


def test_closed_and_void_cannot_draft() -> None:
    store = Store()
    rfi = _answered(store)
    rfi.status = "closed"
    with pytest.raises(AccessDenied) as denied:
        draft_change_order(
            store,
            _foreman(),
            rfi.id,
            title="Relocate panel 214",
            description="Too late.",
        )
    assert denied.value.decision.policy == "status_guard"
    rfi.status = "void"
    with pytest.raises(AccessDenied) as denied:
        draft_material_order(store, _grok(), rfi.id, sku="225A", qty=1)
    assert denied.value.decision.policy == "status_guard"
