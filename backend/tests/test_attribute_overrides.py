"""Strategy 4: pairwise flips from a permitted cell. Not Cartesian."""

from __future__ import annotations

from abac import Action, Role
from app.policy_coverage import EXPECTED_ORDER
from tests.conftest import (
    CREW,
    OTHER,
    OTHER_AREA,
    OTHER_JOB,
    USER,
    assert_stop,
    names,
    resource,
    subject,
)


def _foreman():
    return subject(role=Role.FOREMAN, user_id=USER, crew_ids=frozenset({CREW}))


def _own_rfi(**kwargs):
    base = {
        "created_by_id": USER,
        "crew_foreman_id": USER,
        "status": "draft",
    }
    base.update(kwargs)
    return resource(**base)


def _prefix_stop(walk, stop: str) -> None:
    assert_stop(walk.steps, stop)
    assert names(walk) == list(EXPECTED_ORDER[: len(walk.steps)])


def test_foreman_submit_other_job_stops_at_same_project(evaluate_cov):
    walk = evaluate_cov(_foreman(), Action.SUBMIT_RFI, _own_rfi(project_id=OTHER_JOB))
    _prefix_stop(walk, "same_project")


def test_foreman_submit_other_area_stops_at_area_scope(evaluate_cov):
    walk = evaluate_cov(_foreman(), Action.SUBMIT_RFI, _own_rfi(area_id=OTHER_AREA))
    _prefix_stop(walk, "area_scope")
    assert walk.steps[3].policy == "role_allows"
    assert walk.steps[3].effect == "allow"


def test_foreman_submit_other_crew_stops_at_chain_owns(evaluate_cov):
    walk = evaluate_cov(
        _foreman(),
        Action.SUBMIT_RFI,
        _own_rfi(created_by_id=OTHER, crew_foreman_id=OTHER),
    )
    _prefix_stop(walk, "chain_owns")
    assert walk.steps[3].effect == "allow"


def test_foreman_submit_answered_stops_at_status_guard(evaluate_cov):
    walk = evaluate_cov(_foreman(), Action.SUBMIT_RFI, _own_rfi(status="answered"))
    _prefix_stop(walk, "status_guard")
    assert walk.steps[3].effect == "allow"


def test_apprentice_handle_other_ticket_stops_at_assigned_only(evaluate_cov):
    walk = evaluate_cov(
        subject(role=Role.APPRENTICE, user_id=USER),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=OTHER, status="draft"),
    )
    _prefix_stop(walk, "assigned_only")
    assert walk.steps[3].policy == "role_allows"
    assert walk.steps[3].effect == "allow"
