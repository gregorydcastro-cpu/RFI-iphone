"""Strategy 5: permitless stripped set only. Production must not depend on this hit."""

from __future__ import annotations

import pytest

from abac import (
    AccessDenied,
    Action,
    Combining,
    Decision,
    Effect,
    FIELD_POLICY_SET,
    PolicySet,
    DEFAULT_DENY_REASON,
    raise_http,
    require_access,
)
from tests.conftest import evaluate, resource, subject


def _stripped() -> PolicySet:
    return PolicySet(
        name="no_permit",
        combining=Combining.DENY_OVERRIDES,
        policies=tuple(p for p in FIELD_POLICY_SET.policies if p.name != "role_allows"),
    )


def test_default_deny_on_permitless_set() -> None:
    decision, steps = evaluate(
        subject(),
        Action.CREATE_RFI_DRAFT,
        resource(),
        policy_set=_stripped(),
    )
    assert decision.policy == "default_deny"
    assert decision.allowed is False
    assert steps[-1].policy == "default_deny"
    assert steps[-1].effect == "deny"


def test_default_deny_is_403_not_500():
    from fastapi import HTTPException

    with pytest.raises(AccessDenied) as raised:
        require_access(
            subject(),
            Action.CREATE_RFI_DRAFT,
            resource(),
            policy_set=_stripped(),
        )
    assert raised.value.decision.policy == "default_deny"
    with pytest.raises(HTTPException) as http:
        raise_http(raised.value)
    assert http.value.status_code == 403
    assert http.value.status_code != 500
    assert http.value.detail["policy"] == "default_deny"
    assert http.value.detail["reason"] == DEFAULT_DENY_REASON


def test_production_field_set_coverage_skips_default_deny_hit():
    from abac import evaluate as engine
    from app.policy_coverage import PolicyCoverage as ProdBag

    walk = engine(
        subject(),
        Action.CREATE_RFI_DRAFT,
        resource(),
        policy_set=_stripped(),
    )
    bag = ProdBag()
    bag.record(walk)
    assert walk.decision.policy == "default_deny"
    assert "default_deny" not in bag.seen
    assert "default_deny" not in bag.stops
    assert "default_deny" not in bag.denies


def test_default_deny_does_not_fail_open_when_handler_is_muted(monkeypatch):
    def mute(*_args, **_kwargs):
        return None

    def leak(*_args, **_kwargs):
        return Decision(Effect.ALLOW, "no", policy="default_deny")

    monkeypatch.setattr("app.abac.default_deny", mute)
    decision, steps = evaluate(
        subject(),
        Action.CREATE_RFI_DRAFT,
        resource(),
        policy_set=_stripped(),
    )
    assert decision.allowed is False
    assert decision.policy == "default_deny"
    assert steps[-1].effect == "deny"

    monkeypatch.setattr("app.abac.default_deny", leak)
    leaked, leak_steps = evaluate(
        subject(),
        Action.CREATE_RFI_DRAFT,
        resource(),
        policy_set=_stripped(),
    )
    assert leaked.allowed is False
    assert leaked.policy == "default_deny"
    assert leak_steps[-1].effect == "deny"
