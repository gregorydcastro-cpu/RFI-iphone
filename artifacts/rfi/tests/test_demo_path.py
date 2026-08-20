"""Demo path and the five hung pieces. In-memory only."""

from __future__ import annotations

from datetime import timedelta
from uuid import UUID

import pytest

from rfi.access import AccessDenied, ActorType, Role, Subject
from rfi.core import (
    Job,
    Store,
    WriteError,
    age_rfis,
    create_rfi_draft,
    pair_holds,
    run_demo,
    set_priority,
    submit_rfi,
)
from rfi.tests.conftest import AREA, COMPANY, JOB, USER, subject


def test_demo_path() -> None:
    facts = run_demo()
    assert facts["draft_status"] == "draft"
    assert facts["draft_number"] is None
    assert facts["pin"] == {"label": "A-3"}
    assert facts["grokbot_policy"] == "grokbot_lane"
    assert facts["display"] == "RFI-1"
    assert facts["status"] == "ball_in_court"
    assert facts["internal_review"] is True
    assert facts["priority"] == "work_stopped"
    assert facts["work_stopped"] is True
    assert facts["pair_holds"] is True
    assert facts["cycle_events"] == 1
    assert facts["cycle_kind"] == "escalated"
    assert facts["replay"] == 0
    assert facts["carried_pins"] == 1
    assert facts["pin_carried_events"] == 1
    assert facts["leftover_still_on_old"] is True
    assert facts["carried_has_both_revs"] is True
    assert facts["leftover_draft"].id in facts["search_open_ids"]


def test_grokbot_can_only_draft() -> None:
    store = Store()
    store.add_job(Job(id=JOB))
    grok = subject(role=Role.GENERAL_FOREMAN, actor_type=ActorType.GROKBOT)
    draft = create_rfi_draft(store, grok, question="One question?")
    assert draft.status == "draft"
    assert draft.rfi_number is None
    with pytest.raises(AccessDenied) as raised:
        submit_rfi(store, grok, draft.id)
    assert raised.value.decision.policy == "grokbot_lane"
    with pytest.raises(AccessDenied) as raised:
        set_priority(store, grok, draft.id, "urgent")
    assert raised.value.decision.policy == "grokbot_lane"


def test_create_rejects_work_stopped_and_two_questions() -> None:
    store = Store()
    with pytest.raises(WriteError, match="work_stopped"):
        create_rfi_draft(store, subject(), question="One?", priority="work_stopped")
    with pytest.raises(WriteError, match="one question"):
        create_rfi_draft(store, subject(), question="One? Two?")


def test_set_priority_is_only_pair_writer_and_demote_needs_flag() -> None:
    store = Store()
    store.add_job(Job(id=JOB))
    jman = subject()
    draft = create_rfi_draft(store, jman, question="Clearance?", pin={"label": "B-1"})
    submitted = submit_rfi(
        store,
        Subject(
            user_id=UUID("00000000-0000-4000-8000-000000000002"),
            company_id=COMPANY,
            project_id=JOB,
            role=Role.FOREMAN,
            actor_type=ActorType.HUMAN,
            area_id=AREA,
            crew_ids=frozenset({USER}),
        ),
        draft.id,
    )
    first_due = submitted.due_at
    area = Subject(
        user_id=UUID("00000000-0000-4000-8000-000000000004"),
        company_id=COMPANY,
        project_id=JOB,
        role=Role.AREA_FOREMAN,
        actor_type=ActorType.HUMAN,
        area_id=AREA,
    )
    store.now = store.now + timedelta(minutes=5)
    raised = set_priority(store, area, submitted.id, "work_stopped", work_stopped=True)
    assert pair_holds(raised.priority, raised.work_stopped)
    assert raised.due_at != first_due
    with pytest.raises(AccessDenied) as denied:
        set_priority(store, area, submitted.id, "standard", work_stopped=False)
    assert denied.value.decision.policy == "work_stop_writer"
    demoted = set_priority(
        store, area, submitted.id, "standard", work_stopped=False, allow_demote=True
    )
    assert pair_holds(demoted.priority, demoted.work_stopped)
    assert demoted.work_stopped is False


def test_age_rfis_once_per_due_and_work_stopped_queue() -> None:
    facts = run_demo()
    store = facts["store"]
    rfi = facts["rfi"]
    assert rfi.work_stopped is True
    later = rfi.due_at + timedelta(hours=1)
    assert age_rfis(store, now=later) == []
    cycles = [e for e in store.events if e.event_type == "cycle"]
    assert len(cycles) == 1
    assert cycles[0].kind == "escalated"
    assert cycles[0].due_at == rfi.due_at
