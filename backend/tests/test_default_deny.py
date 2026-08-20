"""Permitless stripped set only. The only honest default_deny hit."""

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
    Role,
    DEFAULT_DENY_REASON,
    format_audit_line,
    raise_http,
    require_access,
)
from tests.conftest import JOB, evaluate, resource, subject


def test_default_deny_on_permitless_set() -> None:
    stripped = PolicySet(
        name="no_permit",
        combining=Combining.DENY_OVERRIDES,
        policies=tuple(p for p in FIELD_POLICY_SET.policies if p.name != "role_allows"),
    )
    decision, steps = evaluate(
        subject(),
        Action.CREATE_RFI_DRAFT,
        resource(),
        policy_set=stripped,
    )
    assert decision.policy == "default_deny"
    assert decision.allowed is False
    assert steps[-1].policy == "default_deny"
    assert steps[-1].effect == "deny"


def test_default_deny_is_403_not_500_and_logs_louder(caplog):
    import logging

    from fastapi import HTTPException

    from abac import audit_logs

    stripped = PolicySet(
        name="no_permit",
        combining=Combining.DENY_OVERRIDES,
        policies=tuple(p for p in FIELD_POLICY_SET.policies if p.name != "role_allows"),
    )
    with caplog.at_level(logging.INFO, logger="abac"):
        with pytest.raises(AccessDenied):
            require_access(
                subject(role=Role.APPRENTICE),
                Action.SUBMIT_RFI,
                resource(),
            )
        with pytest.raises(AccessDenied) as raised:
            require_access(
                subject(),
                Action.CREATE_RFI_DRAFT,
                resource(),
                policy_set=stripped,
            )
    assert raised.value.decision.policy == "default_deny"
    assert raised.value.decision.reason == DEFAULT_DENY_REASON
    assert raised.value.decision.allowed is False
    with pytest.raises(HTTPException) as http:
        raise_http(raised.value)
    assert http.value.status_code == 403
    assert http.value.status_code != 500
    assert http.value.detail == {
        "policy": "default_deny",
        "reason": DEFAULT_DENY_REASON,
    }
    lane = (
        f"abac deny action=submit_rfi role=apprentice actor=human "
        f"policy=role_allows project={JOB}"
    )
    incomplete = (
        f"abac deny action=create_rfi_draft role=journeyman actor=human "
        f"policy=default_deny project={JOB}"
    )
    assert format_audit_line(audit_logs()[-1]) == incomplete
    lane_rec = next(item for item in caplog.records if item.message == lane)
    deny_rec = next(item for item in caplog.records if item.message == incomplete)
    assert lane_rec.levelno == logging.INFO
    assert deny_rec.levelno >= logging.WARNING
    assert deny_rec.levelno > lane_rec.levelno


def test_production_field_set_coverage_skips_default_deny_hit():
    from abac import evaluate as engine
    from app.policy_coverage import PolicyCoverage as ProdBag

    stripped = PolicySet(
        name="no_permit",
        combining=Combining.DENY_OVERRIDES,
        policies=tuple(p for p in FIELD_POLICY_SET.policies if p.name != "role_allows"),
    )
    walk = engine(
        subject(),
        Action.CREATE_RFI_DRAFT,
        resource(),
        policy_set=stripped,
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

    stripped = PolicySet(
        name="no_permit",
        combining=Combining.DENY_OVERRIDES,
        policies=tuple(p for p in FIELD_POLICY_SET.policies if p.name != "role_allows"),
    )
    monkeypatch.setattr("app.abac.default_deny", mute)
    decision, steps = evaluate(
        subject(),
        Action.CREATE_RFI_DRAFT,
        resource(),
        policy_set=stripped,
    )
    assert decision.allowed is False
    assert decision.policy == "default_deny"
    assert steps[-1].effect == "deny"
    assert not any(step.effect == "allow" for step in steps)

    monkeypatch.setattr("app.abac.default_deny", leak)
    leaked, leak_steps = evaluate(
        subject(),
        Action.CREATE_RFI_DRAFT,
        resource(),
        policy_set=stripped,
    )
    assert leaked.allowed is False
    assert leaked.policy == "default_deny"
    assert leak_steps[-1].effect == "deny"
