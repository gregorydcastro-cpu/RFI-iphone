"""Policy coverage next to the walk tests. Not line coverage. Not Grafana."""

from __future__ import annotations

import pytest

from abac import Action, ActorType, Env, Role
from tests.conftest import (
    AREA,
    CREW,
    OTHER,
    OTHER_AREA,
    OTHER_JOB,
    USER,
    assert_stop,
    resource,
    subject,
)
from tests.coverage_abac import PolicyCoverage, assert_policy_coverage


@pytest.fixture(scope="module")
def walk_cov():
    c = PolicyCoverage()
    yield c
    assert_policy_coverage(c)


def test_same_project_deny(walk_cov: PolicyCoverage) -> None:
    decision, steps = walk_cov.evaluate(
        subject(),
        Action.CREATE_RFI_DRAFT,
        resource(project_id=OTHER_JOB),
    )
    assert_stop(steps, "same_project")
    assert decision.allowed is False


def test_grokbot_lane_deny(walk_cov: PolicyCoverage) -> None:
    decision, steps = walk_cov.evaluate(
        subject(role=Role.GENERAL_FOREMAN, actor_type=ActorType.GROKBOT),
        Action.SUBMIT_RFI,
        resource(),
    )
    assert_stop(steps, "grokbot_lane")
    assert decision.allowed is False


def test_on_site_deny(walk_cov: PolicyCoverage) -> None:
    decision, steps = walk_cov.evaluate(
        subject(role=Role.JOURNEYMAN),
        Action.PIN_DRAFT,
        resource(type="sheet"),
        env=Env(on_site=False),
    )
    assert_stop(steps, "on_site")
    assert decision.allowed is False


def test_role_allows_deny(walk_cov: PolicyCoverage) -> None:
    decision, steps = walk_cov.evaluate(
        subject(role=Role.APPRENTICE),
        Action.SUBMIT_RFI,
        resource(),
    )
    assert_stop(steps, "role_allows")
    assert decision.allowed is False


def test_role_allows_allow(walk_cov: PolicyCoverage) -> None:
    decision, steps = walk_cov.evaluate(
        subject(role=Role.JOURNEYMAN),
        Action.CREATE_RFI_DRAFT,
        resource(),
    )
    assert decision.allowed is True
    assert decision.policy == "role_allows"
    assert not any(step.effect == "deny" for step in steps)


def test_area_scope_deny(walk_cov: PolicyCoverage) -> None:
    decision, steps = walk_cov.evaluate(
        subject(role=Role.AREA_FOREMAN, area_id=AREA),
        Action.SET_PRIORITY,
        resource(area_id=OTHER_AREA),
    )
    assert_stop(steps, "area_scope")
    assert decision.allowed is False
    assert steps[3].policy == "role_allows"
    assert steps[3].effect == "allow"


def test_assigned_only_deny(walk_cov: PolicyCoverage) -> None:
    decision, steps = walk_cov.evaluate(
        subject(role=Role.APPRENTICE, user_id=USER),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=OTHER),
    )
    assert_stop(steps, "assigned_only")
    assert decision.allowed is False


def test_chain_owns_deny(walk_cov: PolicyCoverage) -> None:
    decision, steps = walk_cov.evaluate(
        subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
        Action.SUBMIT_RFI,
        resource(created_by_id=OTHER, crew_foreman_id=OTHER),
    )
    assert_stop(steps, "chain_owns")
    assert decision.allowed is False


def test_status_guard_deny(walk_cov: PolicyCoverage) -> None:
    decision, steps = walk_cov.evaluate(
        subject(role=Role.FOREMAN),
        Action.SUBMIT_RFI,
        resource(status="answered"),
    )
    assert_stop(steps, "status_guard")
    assert decision.allowed is False


def test_work_stop_writer_deny(walk_cov: PolicyCoverage) -> None:
    decision, steps = walk_cov.evaluate(
        subject(role=Role.AREA_FOREMAN),
        Action.SET_PRIORITY,
        resource(priority="work_stopped", work_stopped=True, status="ball_in_court"),
        ctx={"priority": "standard", "allow_demote": False},
    )
    assert_stop(steps, "work_stop_writer")
    assert decision.allowed is False


def test_assert_policy_coverage_includes_format() -> None:
    from tests.coverage_abac import DENY_ONLY

    hole = PolicyCoverage()
    with pytest.raises(AssertionError) as raised:
        assert_policy_coverage(hole)
    text = str(raised.value)
    assert "never_seen" in text
    assert "never_applicable" in text
    assert "deny-only never denied" in text
    assert "permit never allowed" in text
    assert hole.format() in text
    for name in DENY_ONLY:
        assert name in text


def test_deny_only_rules_never_return_allow() -> None:
    from abac import (
        Env,
        area_scope,
        assigned_only,
        chain_owns,
        grokbot_lane,
        on_site,
        same_project,
        status_guard,
        work_stop_writer,
    )

    env = Env()
    s = subject(role=Role.FOREMAN, crew_ids=frozenset({CREW}))
    r = resource()
    results = (
        same_project(s, r),
        grokbot_lane(s, Action.SUBMIT_RFI),
        on_site(s, Action.PIN_DRAFT, r, env),
        area_scope(s, r),
        assigned_only(s, Action.HANDLE_MATERIAL, r, env),
        chain_owns(s, Action.SUBMIT_RFI, r, env),
        status_guard(s, Action.SUBMIT_RFI, r, env),
        work_stop_writer(s, Action.SET_PRIORITY, r, env),
        same_project(subject(), resource(project_id=OTHER_JOB)),
        assigned_only(
            subject(role=Role.APPRENTICE, user_id=USER),
            Action.HANDLE_MATERIAL,
            resource(type="ticket", assigned_to_id=USER),
            env,
        ),
        chain_owns(
            s,
            Action.SUBMIT_RFI,
            resource(created_by_id=USER, crew_foreman_id=USER),
            env,
        ),
    )
    for result in results:
        assert result is None or result.effect.value == "deny"
