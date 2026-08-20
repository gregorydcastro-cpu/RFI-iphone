"""ROLE_ACTIONS matrix. role_allows is law and never returns None."""

from __future__ import annotations

from enum import Enum

from abac import Action, Env, ROLE_ACTIONS, Role, role_allows
from app.policy_coverage import EXPECTED_ORDER
from tests.conftest import (
    USER,
    assert_stop,
    evaluate,
    first_stop,
    format_trace_table,
    names,
    resource,
    subject,
)


def test_role_allows_is_law():
    class Extra(str, Enum):
        INSPECTOR = "inspector"

    env = Env()
    res = resource()
    assert role_allows.__doc__ is not None
    assert "Never returns None" in role_allows.__doc__
    assert ROLE_ACTIONS.get(Extra.INSPECTOR, frozenset()) == frozenset()

    unknown_role = subject()
    object.__setattr__(unknown_role, "role", Extra.INSPECTOR)
    unknown = role_allows(unknown_role, Action.SUBMIT_RFI, res, env)
    assert unknown is not None
    assert unknown.allowed is False
    assert unknown.policy == "role_allows"
    assert unknown.reason == "inspector cannot submit_rfi"

    known_deny = role_allows(subject(role=Role.JOURNEYMAN), Action.SUBMIT_RFI, res, env)
    assert known_deny.allowed is False
    assert known_deny.reason == "journeyman cannot submit_rfi"

    known_allow = role_allows(
        subject(role=Role.JOURNEYMAN), Action.CREATE_RFI_DRAFT, res, env
    )
    assert known_allow.allowed is True
    assert known_allow.reason == "journeyman may create_rfi_draft"

    for role in Role:
        for action in Action:
            decision = role_allows(subject(role=role), action, res, env)
            assert decision is not None
            assert decision.policy == "role_allows"
            if action in ROLE_ACTIONS.get(role, frozenset()):
                assert decision.allowed is True
            else:
                assert decision.allowed is False


def test_apprentice_cannot_submit(cov):
    decision, steps = evaluate(subject(role=Role.APPRENTICE), Action.SUBMIT_RFI, resource())
    cov.record((decision, steps))
    assert_stop(steps, "role_allows")
    assert first_stop((decision, steps)).reason == "apprentice cannot submit_rfi"
    assert decision.allowed is False
    assert decision.policy == "role_allows"


def test_journeyman_can_draft(cov):
    decision, steps = evaluate(
        subject(role=Role.JOURNEYMAN), Action.CREATE_RFI_DRAFT, resource()
    )
    cov.record((decision, steps))
    assert decision.allowed is True
    assert decision.policy == "role_allows"
    assert decision.reason == "journeyman may create_rfi_draft"
    assert format_trace_table(steps) == (
        "seq1 same_project appl=no effect=— stopped=no\n"
        "seq2 grokbot_lane appl=no effect=— stopped=no\n"
        "seq3 on_site appl=no effect=— stopped=no\n"
        "seq4 role_allows appl=yes effect=allow stopped=no\n"
        "seq5 area_scope appl=no effect=— stopped=no\n"
        "seq6 assigned_only appl=no effect=— stopped=no\n"
        "seq7 chain_owns appl=no effect=— stopped=no\n"
        "seq8 status_guard appl=no effect=— stopped=no\n"
        "seq9 work_stop_writer appl=no effect=— stopped=no"
    )
    assert [step.effect for step in steps if step.effect == "allow"] == ["allow"]
    assert steps[3].policy == "role_allows"
    assert steps[3].stopped is False
    assert not any(step.stopped for step in steps)
    assert "default_deny" not in names((decision, steps))
    assert names((decision, steps)) == list(EXPECTED_ORDER[:9])


def test_gf_work_stop_dies_at_work_stop_writer(cov):
    decision, steps = evaluate(
        subject(role=Role.GENERAL_FOREMAN), Action.WORK_STOP, resource()
    )
    cov.record((decision, steps))
    assert_stop(steps, "work_stop_writer")
    assert first_stop((decision, steps)).reason == "use set_priority; do not flip work_stopped"
    assert decision.policy == "work_stop_writer"
    assert "default_deny" not in names((decision, steps))


def test_gf_skips_area_and_still_walks(cov):
    decision, steps = evaluate(
        subject(role=Role.GENERAL_FOREMAN, area_id=None), Action.SUBMIT_RFI, resource()
    )
    cov.record((decision, steps))
    assert names((decision, steps)) == list(EXPECTED_ORDER[:9])
    area = next(step for step in steps if step.policy == "area_scope")
    assert area.applicable is False
    assert decision.allowed is True


def test_journeyman_cannot_handle_material(cov):
    decision, steps = evaluate(
        subject(role=Role.JOURNEYMAN),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=USER),
    )
    cov.record((decision, steps))
    assert_stop(steps, "role_allows")
    assert first_stop((decision, steps)).reason == "journeyman cannot handle_material"
    assert "assigned_only" not in names((decision, steps))


def test_apprentice_handle_own_ticket_allows(cov):
    decision, steps = evaluate(
        subject(role=Role.APPRENTICE, user_id=USER),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=USER),
    )
    cov.record((decision, steps))
    assigned = next(step for step in steps if step.policy == "assigned_only")
    assert assigned.applicable is False
    assert decision.allowed is True
    assert decision.policy == "role_allows"
    assert decision.reason == "apprentice may handle_material"
