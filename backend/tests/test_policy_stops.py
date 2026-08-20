"""Strategy 1: one deny each. Strategy 2: journeyman draft full walk."""

from __future__ import annotations

import pytest

from abac import Action, ActorType, Env, Role
from app.policy_coverage import EXPECTED_ORDER
from tests.conftest import (
    AREA,
    CREW,
    JOB,
    OTHER,
    OTHER_AREA,
    OTHER_JOB,
    USER,
    assert_stop,
    format_trace,
    names,
    resource,
    subject,
)

evaluate = None


def _prefix(steps, stop: str) -> None:
    assert_stop(steps, stop)
    walked = [step.policy for step in steps]
    assert walked == list(EXPECTED_ORDER[: len(walked)])
    after = [name for name in EXPECTED_ORDER if name not in walked]
    assert stop not in after


def test_same_project(cov):
    walk = cov.evaluate(
        subject(project_id=JOB),
        Action.SUBMIT_RFI,
        resource(project_id=OTHER_JOB),
    )
    assert names(walk) == ["same_project"]
    _prefix(walk.steps, "same_project")


def test_grokbot_lane(cov):
    walk = cov.evaluate(
        subject(role=Role.GENERAL_FOREMAN, actor_type=ActorType.GROKBOT),
        Action.SUBMIT_RFI,
        resource(),
    )
    _prefix(walk.steps, "grokbot_lane")


def test_on_site(cov):
    walk = cov.evaluate(
        subject(role=Role.JOURNEYMAN),
        Action.PIN_DRAFT,
        resource(type="sheet"),
        env=Env(on_site=False),
    )
    _prefix(walk.steps, "on_site")


def test_role_deny(cov):
    walk = cov.evaluate(subject(role=Role.APPRENTICE), Action.SUBMIT_RFI, resource())
    _prefix(walk.steps, "role_allows")


def test_role_allow(cov):
    walk = cov.evaluate(
        subject(role=Role.JOURNEYMAN),
        Action.CREATE_RFI_DRAFT,
        resource(),
    )
    decision, steps = walk
    assert [step.effect for step in steps if step.effect == "allow"] == ["allow"]
    assert steps[3].policy == "role_allows"
    assert steps[3].effect == "allow"
    assert steps[3].stopped is False
    assert steps[-1].policy == "default_deny"
    assert steps[-1].applicable is False
    assert steps[-1].effect is None
    assert steps[-1].order == 99
    assert decision.allowed is True
    assert decision.policy == "role_allows"


def test_area_scope(cov):
    walk = cov.evaluate(
        subject(role=Role.AREA_FOREMAN, area_id=AREA),
        Action.SET_PRIORITY,
        resource(area_id=OTHER_AREA),
    )
    _prefix(walk.steps, "area_scope")


def test_assigned_only(cov):
    walk = cov.evaluate(
        subject(role=Role.APPRENTICE, user_id=USER),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=OTHER),
    )
    _prefix(walk.steps, "assigned_only")


def test_chain_owns(cov):
    walk = cov.evaluate(
        subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
        Action.SUBMIT_RFI,
        resource(created_by_id=OTHER, crew_foreman_id=OTHER),
    )
    _prefix(walk.steps, "chain_owns")


def test_status_guard(cov):
    walk = cov.evaluate(
        subject(role=Role.GENERAL_FOREMAN),
        Action.SUBMIT_RFI,
        resource(status="answered"),
    )
    _prefix(walk.steps, "status_guard")


def test_work_stop_writer(cov):
    walk = cov.evaluate(
        subject(role=Role.GENERAL_FOREMAN),
        Action.SET_PRIORITY,
        resource(priority="work_stopped", work_stopped=True, status="ball_in_court"),
        ctx={"priority": "standard", "allow_demote": False},
    )
    _prefix(walk.steps, "work_stop_writer")


def test_assert_stop_prints_receipt_on_mismatch(cov):
    walk = cov.evaluate(
        subject(project_id=JOB),
        Action.SUBMIT_RFI,
        resource(project_id=OTHER_JOB),
    )
    with pytest.raises(AssertionError) as raised:
        assert_stop(walk.steps, "role_allows")
    assert "expected stop at role_allows, got same_project" in str(raised.value)
    assert format_trace(walk.steps) in str(raised.value)
