"""Strategy 3: Role × Action at role_allows only. No attribute fails."""

from __future__ import annotations

from enum import Enum

from abac import (
    Action,
    Env,
    Evaluation,
    EvaluationTrace,
    ROLE_ACTIONS,
    Role,
    role_allows,
)
from tests.conftest import CREW, USER, resource, subject


def _role_hit(decision):
    """role_allows only. Do not walk the rest of FIELD_POLICY_SET."""
    return Evaluation(
        decision,
        (
            EvaluationTrace(
                seq=1,
                policy="role_allows",
                order=40,
                applicable=True,
                effect="allow" if decision.allowed else "deny",
                reason=decision.reason,
                stopped=not decision.allowed,
            ),
        ),
    )


def _clean_subject(role: Role):
    return subject(
        role=role,
        user_id=USER,
        project_id=subject().project_id,
        area_id=subject().area_id,
        crew_ids=frozenset({USER, CREW}),
    )


def _clean_resource(*, action: Action):
    kind = "ticket" if action in {Action.HANDLE_MATERIAL, Action.FLAG_UP} else "rfi"
    return resource(
        type=kind,
        status="draft",
        assigned_to_id=USER,
        created_by_id=USER,
        crew_foreman_id=USER,
    )


def test_role_action_matrix_at_role_allows_only(cov):
    class Extra(str, Enum):
        INSPECTOR = "inspector"

    env = Env()
    assert ROLE_ACTIONS.get(Extra.INSPECTOR, frozenset()) == frozenset()

    unknown = _clean_subject(Role.JOURNEYMAN)
    object.__setattr__(unknown, "role", Extra.INSPECTOR)
    denied = role_allows(
        unknown, Action.SUBMIT_RFI, _clean_resource(action=Action.SUBMIT_RFI), env
    )
    cov.record(_role_hit(denied))
    assert denied.allowed is False
    assert denied.policy == "role_allows"

    for role in Role:
        for action in Action:
            decision = role_allows(
                _clean_subject(role), action, _clean_resource(action=action), env
            )
            cov.record(_role_hit(decision))
            assert decision is not None
            assert decision.policy == "role_allows"
            if action in ROLE_ACTIONS.get(role, frozenset()):
                assert decision.allowed is True
            else:
                assert decision.allowed is False
