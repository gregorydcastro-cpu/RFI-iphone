"""One stop per field lane. assert_stop / format_trace."""

from __future__ import annotations

import pytest

from abac import (
    AccessDenied,
    Action,
    ActorType,
    Env,
    HUNG_WRITES,
    Role,
    grok_denied,
    raise_http,
    require_access,
)
from tests.conftest import (
    AREA,
    CREW,
    JOB,
    OTHER,
    OTHER_AREA,
    OTHER_JOB,
    USER,
    assert_stop,
    evaluate,
    first_stop,
    format_trace,
    gold_rows,
    resource,
    subject,
)


def test_same_project_stops(cov):
    decision, steps = evaluate(
        subject(project_id=JOB),
        Action.SUBMIT_RFI,
        resource(project_id=OTHER_JOB),
    )
    cov.record((decision, steps))
    assert_stop(steps, "same_project")
    assert "same_project" in format_trace(steps)
    assert decision.policy == "same_project"
    assert decision.allowed is False


def test_grokbot_lane_stops(cov):
    decision, steps = evaluate(
        subject(role=Role.GENERAL_FOREMAN, actor_type=ActorType.GROKBOT),
        Action.SUBMIT_RFI,
        resource(),
    )
    cov.record((decision, steps))
    assert_stop(steps, "grokbot_lane")
    assert "grokbot_lane" in format_trace(steps)
    assert gold_rows((decision, steps))[-1][1] == "grokbot_lane"
    assert decision.policy == "grokbot_lane"


def test_on_site_stops(cov):
    decision, steps = evaluate(
        subject(role=Role.JOURNEYMAN),
        Action.PIN_DRAFT,
        resource(type="sheet"),
        env=Env(on_site=False),
    )
    cov.record((decision, steps))
    assert_stop(steps, "on_site")
    assert "on_site" in format_trace(steps)
    assert decision.policy == "on_site"


def test_role_allows_stops(cov):
    decision, steps = evaluate(subject(role=Role.APPRENTICE), Action.SUBMIT_RFI, resource())
    cov.record((decision, steps))
    assert_stop(steps, "role_allows")
    assert "apprentice cannot submit_rfi" in format_trace(steps)
    assert decision.policy == "role_allows"


def test_area_scope_stops(cov):
    decision, steps = evaluate(
        subject(role=Role.AREA_FOREMAN, area_id=AREA),
        Action.SET_PRIORITY,
        resource(area_id=OTHER_AREA),
    )
    cov.record((decision, steps))
    assert_stop(steps, "area_scope")
    assert "area_scope" in format_trace(steps)
    assert decision.policy == "area_scope"


def test_assigned_only_stops(cov):
    decision, steps = evaluate(
        subject(role=Role.APPRENTICE, user_id=USER),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=OTHER),
    )
    cov.record((decision, steps))
    assert_stop(steps, "assigned_only")
    assert "assigned_only" in format_trace(steps)
    assert decision.policy == "assigned_only"


def test_chain_owns_stops(cov):
    decision, steps = evaluate(
        subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
        Action.SUBMIT_RFI,
        resource(created_by_id=OTHER, crew_foreman_id=OTHER),
    )
    cov.record((decision, steps))
    assert_stop(steps, "chain_owns")
    assert first_stop((decision, steps)).reason == "not your crew's ticket"
    assert "chain_owns" in format_trace(steps)
    assert decision.policy == "chain_owns"


def test_status_guard_stops(cov):
    decision, steps = evaluate(
        subject(role=Role.GENERAL_FOREMAN),
        Action.SUBMIT_RFI,
        resource(status="answered"),
    )
    cov.record((decision, steps))
    assert_stop(steps, "status_guard")
    assert "status_guard" in format_trace(steps)
    assert decision.policy == "status_guard"


def test_work_stop_writer_stops(cov):
    decision, steps = evaluate(
        subject(role=Role.GENERAL_FOREMAN),
        Action.SET_PRIORITY,
        resource(priority="work_stopped", work_stopped=True, status="ball_in_court"),
        ctx={"priority": "standard", "allow_demote": False},
    )
    cov.record((decision, steps))
    assert_stop(steps, "work_stop_writer")
    assert "work_stop_writer" in format_trace(steps)
    assert decision.policy == "work_stop_writer"


def test_assert_stop_prints_receipt_on_mismatch():
    decision, steps = evaluate(
        subject(project_id=JOB),
        Action.SUBMIT_RFI,
        resource(project_id=OTHER_JOB),
    )
    with pytest.raises(AssertionError) as raised:
        assert_stop(steps, "role_allows")
    receipt = str(raised.value)
    assert "expected stop at role_allows, got same_project" in receipt
    assert format_trace(steps) in receipt
    assert decision.policy == "same_project"


def test_debug_on_fail():
    decision, steps = evaluate(subject(role=Role.APPRENTICE), Action.SUBMIT_RFI, resource())
    if decision.policy != "role_allows":
        raise AssertionError(format_trace(steps, decision=decision))


def test_require_access_raises_with_trace_stop(cov):
    from fastapi import HTTPException

    audit: list = []
    with pytest.raises(AccessDenied) as raised:
        require_access(
            subject(role=Role.APPRENTICE),
            Action.SUBMIT_RFI,
            resource(),
            audit=audit,
        )
    cov.record(raised.value)
    steps = list(raised.value.trace)
    assert_stop(steps, "role_allows")
    assert format_trace(steps)
    with pytest.raises(HTTPException) as http:
        raise_http(raised.value)
    assert http.value.status_code == 403
    assert http.value.detail == {
        "policy": "role_allows",
        "reason": "apprentice cannot submit_rfi",
    }


def test_grok_sees_denied_and_policy_only():
    decision, steps = evaluate(
        subject(role=Role.GENERAL_FOREMAN, actor_type=ActorType.GROKBOT),
        Action.SUBMIT_RFI,
        resource(),
    )
    assert_stop(steps, "grokbot_lane")
    body = grok_denied(decision)
    assert body == {"denied": True, "policy": "grokbot_lane"}
    assert format_trace(steps) not in str(body)


def test_three_writes_hang_require_access():
    import inspect

    from app import main

    assert HUNG_WRITES == frozenset(
        {"create_rfi_draft", "submit_rfi", "set_priority"}
    )
    sources = (
        inspect.getsource(main.create_rfi_draft),
        inspect.getsource(main.pe_submit_rfi),
        inspect.getsource(main.pe_set_priority),
    )
    for src in sources:
        assert "require_access(" in src
        assert src.index("require_access(") < src.index("except AccessDenied")
