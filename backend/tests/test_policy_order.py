"""Ranked names and prefix after deny. Never a reshuffle."""

from __future__ import annotations

from uuid import UUID

import pytest

from abac import (
    AccessDenied,
    Action,
    ActorType,
    Combining,
    Decision,
    Effect,
    Env,
    ENV_FIELD_ORDER,
    EvaluationLog,
    EvaluationTrace,
    FIELD_POLICY_SET,
    FIELD_SET_NAMES,
    LOG_FIELD_ORDER,
    Policy,
    PolicySet,
    Role,
    SUBJECT_FIELD_ORDER,
    Subject,
    TRACE_FIELD_ORDER,
    default_deny,
    reject_env_field_order,
    reject_evaluation_log_shape,
    reject_evaluation_trace_shape,
    reject_frozen_env_now,
    reject_subject_actor_type,
    reject_subject_crew_ids,
    require_access,
    role_allows,
    same_project,
)
from app.policy_coverage import EXPECTED_ORDER, FIELD_LANES
from tests.conftest import (
    AREA,
    COMPANY,
    CREW,
    DENY_READ,
    JOB,
    OTHER,
    OTHER_AREA,
    OTHER_JOB,
    PREFIX_DENY,
    USER,
    format_trace_table,
    assert_stop,
    evaluate,
    names,
    resource,
    stop_policy,
    subject,
)


def test_policy_set_rank_is_fixed():
    assert tuple(policy.name for policy in FIELD_POLICY_SET.ranked()) == FIELD_LANES
    assert EXPECTED_ORDER == FIELD_LANES + ("default_deny",)
    assert "default_deny" not in FIELD_SET_NAMES


def test_names_are_a_prefix_of_expected_order(evaluate_cov):
    decision, steps = evaluate_cov(
        subject(project_id=JOB),
        Action.SUBMIT_RFI,
        resource(project_id=OTHER_JOB),
    )
    walked = [step.policy for step in steps]
    assert walked == list(EXPECTED_ORDER[: len(walked)])
    assert walked == ["same_project"]
    after = [name for name in EXPECTED_ORDER if name not in walked]
    assert after == list(EXPECTED_ORDER[1:])
    assert "role_allows" in after


def test_policies_after_deny_are_absent(evaluate_cov):
    cases = (
        (
            evaluate_cov(
                subject(project_id=JOB),
                Action.SUBMIT_RFI,
                resource(project_id=OTHER_JOB),
            ),
            1,
            "same_project",
        ),
        (
            evaluate_cov(
                subject(role=Role.GENERAL_FOREMAN, actor_type=ActorType.GROKBOT),
                Action.SUBMIT_RFI,
                resource(),
            ),
            2,
            "grokbot_lane",
        ),
        (
            evaluate_cov(
                subject(role=Role.JOURNEYMAN),
                Action.PIN_DRAFT,
                resource(type="sheet"),
                env=Env(on_site=False),
            ),
            3,
            "on_site",
        ),
        (
            evaluate_cov(subject(role=Role.APPRENTICE), Action.SUBMIT_RFI, resource()),
            4,
            "role_allows",
        ),
    )
    for walk, seq, name in cases:
        decision, steps = walk
        assert_stop(steps, name)
        assert steps[seq - 1].policy == PREFIX_DENY[seq] == name
        after = [step.policy for step in steps if step.seq > seq]
        assert after == []
        assert names(walk) == list(EXPECTED_ORDER[:seq])
        assert decision.allowed is False
        if name == "grokbot_lane":
            assert format_trace_table(steps) == (
                "seq1 same_project appl=no effect=— stopped=no\n"
                "seq2 grokbot_lane appl=yes effect=deny stopped=yes"
            )


def test_evaluate_algorithm_is_law():
    from abac import evaluate as engine

    doc = engine.__doc__ or ""
    assert "None  → n/a, continue" in doc
    assert "DENY  → return immediately" in doc
    assert "ALLOW → remember it, continue" in doc
    assert "if an ALLOW was remembered → return that ALLOW" in doc
    assert "else → DENY policy=default_deny" in doc

    def na(*_args, **_kwargs):
        return None

    def halt(*_args, **_kwargs):
        return Decision(Effect.DENY, "stop", policy="early")

    def permit(*_args, **_kwargs):
        return Decision(Effect.ALLOW, "ok", policy="role_allows")

    def extra(*_args, **_kwargs):
        return Decision(Effect.ALLOW, "second", policy="other")

    denied = PolicySet(
        name="law",
        combining=Combining.DENY_OVERRIDES,
        policies=(
            Policy(name="same_project", rule=na, order=10),
            Policy(name="early", rule=halt, order=20),
            Policy(name="role_allows", rule=permit, order=40),
        ),
    )
    decision, steps = evaluate(subject(), Action.SUBMIT_RFI, resource(), policy_set=denied)
    assert [step.policy for step in steps] == ["same_project", "early"]
    assert decision.allowed is False
    assert decision.policy == "early"
    assert steps[-1].stopped is True
    assert "role_allows" not in [step.policy for step in steps]

    remembered = PolicySet(
        name="law",
        combining=Combining.DENY_OVERRIDES,
        policies=(
            Policy(name="same_project", rule=na, order=10),
            Policy(name="role_allows", rule=permit, order=40),
            Policy(name="area_scope", rule=na, order=50),
        ),
    )
    decision, steps = evaluate(
        subject(), Action.CREATE_RFI_DRAFT, resource(), policy_set=remembered
    )
    assert decision.allowed is True
    assert decision.policy == "role_allows"
    assert [step.effect for step in steps] == [None, "allow", None, None]
    assert steps[-1].policy == "default_deny"
    assert steps[-1].applicable is False
    assert steps[-1].order == 99
    assert not any(step.stopped for step in steps)

    empty = PolicySet(
        name="law",
        combining=Combining.DENY_OVERRIDES,
        policies=(Policy(name="same_project", rule=na, order=10),),
    )
    decision, steps = evaluate(subject(), Action.VIEW_PRINT, resource(), policy_set=empty)
    assert decision.allowed is False
    assert decision.policy == "default_deny"
    assert [step.effect for step in steps] == [None, "deny"]
    assert steps[-1].policy == "default_deny"
    assert steps[-1].effect == "deny"
    assert steps[-1].stopped is True

    two = PolicySet(
        name="law",
        combining=Combining.DENY_OVERRIDES,
        policies=(
            Policy(name="role_allows", rule=permit, order=40),
            Policy(name="other", rule=extra, order=50),
        ),
    )
    with pytest.raises(TypeError, match="second allow"):
        evaluate(subject(), Action.CREATE_RFI_DRAFT, resource(), policy_set=two)


def test_no_later_allow_overrides_earlier_deny(evaluate_cov):
    log = evaluate_cov(
        subject(role=Role.JOURNEYMAN, project_id=JOB),
        Action.CREATE_RFI_DRAFT,
        resource(project_id=OTHER_JOB),
    )
    decision, steps = log
    assert names(log) == ["same_project"]
    assert_stop(steps, "same_project")
    assert "role_allows" not in names(log)
    assert decision.allowed is False


def test_later_allow_does_not_cancel_a_deny(evaluate_cov):
    assert FIELD_POLICY_SET.combining is Combining.DENY_OVERRIDES
    decision, steps = evaluate_cov(
        subject(role=Role.JOURNEYMAN, area_id=AREA),
        Action.CREATE_RFI_DRAFT,
        resource(area_id=OTHER_AREA),
    )
    assert_stop(steps, "area_scope")
    assert steps[3].effect == "allow"
    assert decision.allowed is False
    assert decision.policy == "area_scope"
    assert names((decision, steps)) == list(EXPECTED_ORDER[:5])
    assert "assigned_only" not in names((decision, steps))


def test_reading_a_deny_last_applicable_is_the_problem(evaluate_cov):
    cases = (
        (
            evaluate_cov(
                subject(role=Role.GENERAL_FOREMAN, actor_type=ActorType.GROKBOT),
                Action.SUBMIT_RFI,
                resource(),
            ),
            "grokbot_lane",
        ),
        (
            evaluate_cov(subject(role=Role.APPRENTICE), Action.SUBMIT_RFI, resource()),
            "role_allows",
        ),
        (
            evaluate_cov(
                subject(role=Role.JOURNEYMAN, area_id=AREA),
                Action.CREATE_RFI_DRAFT,
                resource(area_id=OTHER_AREA),
            ),
            "area_scope",
        ),
        (
            evaluate_cov(
                subject(role=Role.APPRENTICE),
                Action.HANDLE_MATERIAL,
                resource(type="ticket", assigned_to_id=None),
            ),
            "assigned_only",
        ),
        (
            evaluate_cov(
                subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
                Action.SUBMIT_RFI,
                resource(created_by_id=OTHER, crew_foreman_id=OTHER),
            ),
            "chain_owns",
        ),
        (
            evaluate_cov(
                subject(role=Role.GENERAL_FOREMAN),
                Action.SUBMIT_RFI,
                resource(status="answered"),
            ),
            "status_guard",
        ),
        (
            evaluate_cov(
                subject(role=Role.GENERAL_FOREMAN),
                Action.SET_PRIORITY,
                resource(
                    priority="work_stopped", work_stopped=True, status="ball_in_court"
                ),
                ctx={"priority": "standard", "allow_demote": False},
            ),
            "work_stop_writer",
        ),
        (
            evaluate_cov(
                subject(project_id=JOB),
                Action.SUBMIT_RFI,
                resource(project_id=OTHER_JOB),
            ),
            "same_project",
        ),
    )
    for walk, name in cases:
        decision, steps = walk
        assert_stop(steps, name)
        last = [step for step in steps if step.applicable][-1]
        assert last.policy == name
        assert last.effect == "deny"
        after = [step.policy for step in steps if step.seq > last.seq]
        assert after == []
        assert name in DENY_READ
        if name == "area_scope":
            assert steps[3].policy == "role_allows"
            assert steps[3].effect == "allow"


def test_default_deny_does_not_fire_after_remembered_allow():
    both = PolicySet(
        name="permit_then_default",
        combining=Combining.DENY_OVERRIDES,
        policies=(
            Policy(name="same_project", rule=same_project, order=10),
            Policy(name="role_allows", rule=role_allows, order=40),
            Policy(name="default_deny", rule=default_deny, order=99),
        ),
    )
    decision, steps = evaluate(
        subject(),
        Action.CREATE_RFI_DRAFT,
        resource(),
        policy_set=both,
    )
    assert decision.allowed is True
    assert decision.policy == "role_allows"
    skipped = next(step for step in steps if step.policy == "default_deny")
    assert skipped.applicable is False
    assert skipped.effect is None
    assert skipped.stopped is False


def test_default_deny_hole_when_role_allows_returns_none(caplog):
    import logging

    from abac import audit_logs, default_deny as deny_handler

    def mute_role(*_args, **_kwargs):
        return None

    hole = PolicySet(
        name="field_chain",
        combining=Combining.DENY_OVERRIDES,
        policies=tuple(
            Policy(
                name=policy.name,
                rule=mute_role if policy.name == "role_allows" else policy.rule,
                order=policy.order,
            )
            for policy in FIELD_POLICY_SET.ranked()
        ),
    )
    with caplog.at_level(logging.INFO, logger="abac"):
        decision, steps = evaluate(
            subject(role=Role.JOURNEYMAN),
            Action.CREATE_RFI_DRAFT,
            resource(),
            policy_set=hole,
        )
        with pytest.raises(AccessDenied):
            require_access(
                subject(role=Role.JOURNEYMAN),
                Action.CREATE_RFI_DRAFT,
                resource(),
                policy_set=hole,
            )
    assert [step.policy for step in steps] == [*FIELD_LANES, "default_deny"]
    assert all(step.applicable is False for step in steps[:-1])
    assert all(step.effect is None for step in steps[:-1])
    assert not any(step.stopped for step in steps[:-1])
    assert steps[-1].policy == "default_deny"
    assert steps[-1].effect == "deny"
    assert steps[-1].stopped is True
    assert decision.allowed is False
    assert decision.policy not in FIELD_SET_NAMES
    assert deny_handler(subject(), Action.CREATE_RFI_DRAFT, resource(), Env()).effect is Effect.DENY
    line = (
        f"abac deny action=create_rfi_draft role=journeyman actor=human "
        f"policy=default_deny project={JOB}"
    )
    assert line in caplog.messages
    assert audit_logs()[-1].decision.policy == "default_deny"


def test_env_now_is_factory_not_import_stamp():
    from dataclasses import MISSING, dataclass, fields
    from datetime import datetime, timezone

    now_field = next(item for item in fields(Env) if item.name == "now")
    assert now_field.default is MISSING
    assert now_field.default_factory is not MISSING
    assert isinstance(now_field.default_factory(), datetime)
    reject_frozen_env_now(Env)

    @dataclass(frozen=True)
    class FrozenNow:
        now: datetime = datetime.now(timezone.utc)
        on_site: bool = True

    with pytest.raises(TypeError, match="class-body"):
        reject_frozen_env_now(FrozenNow)


def test_env_field_order_is_kw_only_law():
    from dataclasses import dataclass, field, fields
    from datetime import datetime, timezone

    params = Env.__dataclass_params__
    assert params.frozen is True
    assert params.kw_only is True
    assert tuple(item.name for item in fields(Env)) == ENV_FIELD_ORDER
    reject_env_field_order(Env)

    @dataclass(frozen=True)
    class PositionalEnv:
        now: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
        on_site: bool = True
        timezone_name: str = "America/New_York"
        sla_unit: str = "business_days"
        work_stopped_queue: bool = False
        project_id: UUID | None = None
        area_id: UUID | None = None

    with pytest.raises(TypeError, match="kw_only"):
        reject_env_field_order(PositionalEnv)


def test_subject_crew_ids_is_per_instance_frozenset():
    from dataclasses import MISSING, dataclass, field, fields

    crew = next(item for item in fields(Subject) if item.name == "crew_ids")
    assert crew.default is MISSING
    assert crew.default_factory is frozenset
    reject_subject_crew_ids(Subject)

    @dataclass(frozen=True)
    class SharedCrew:
        crew_ids: frozenset = frozenset()

    with pytest.raises(TypeError, match="class-body"):
        reject_subject_crew_ids(SharedCrew)

    @dataclass(frozen=True)
    class MutableCrew:
        crew_ids: set = field(default_factory=set)

    with pytest.raises(TypeError, match="mutable"):
        reject_subject_crew_ids(MutableCrew)


def test_subject_actor_type_is_required():
    from dataclasses import MISSING, dataclass, field, fields

    actor = next(item for item in fields(Subject) if item.name == "actor_type")
    assert actor.default is MISSING
    assert tuple(item.name for item in fields(Subject)) == SUBJECT_FIELD_ORDER
    reject_subject_actor_type(Subject)
    with pytest.raises(TypeError):
        Subject(
            user_id=USER,
            company_id=COMPANY,
            project_id=JOB,
            role=Role.JOURNEYMAN,
        )

    @dataclass(frozen=True, kw_only=True)
    class SoftHuman:
        user_id: object
        company_id: object
        project_id: object
        role: object
        actor_type: ActorType = ActorType.HUMAN
        area_id: object = None
        reports_to_id: object = None
        crew_ids: frozenset = field(default_factory=frozenset)

    with pytest.raises(TypeError, match="required"):
        reject_subject_actor_type(SoftHuman)


def test_evaluation_trace_and_log_field_order():
    from dataclasses import MISSING, fields
    from datetime import datetime

    from abac import audit_logs

    reject_evaluation_trace_shape(EvaluationTrace)
    reject_evaluation_log_shape(EvaluationLog)
    assert tuple(item.name for item in fields(EvaluationTrace)) == TRACE_FIELD_ORDER
    stamped = next(item for item in fields(EvaluationLog) if item.name == "evaluated_at")
    assert stamped.default is MISSING
    assert tuple(item.name for item in fields(EvaluationLog)) == LOG_FIELD_ORDER
    with pytest.raises(AccessDenied):
        require_access(
            subject(project_id=JOB),
            Action.SUBMIT_RFI,
            resource(project_id=OTHER_JOB),
        )
    log = audit_logs()[-1]
    assert isinstance(log.evaluated_at, datetime)
    assert log.combining == "deny_overrides"
    assert log.steps[0].policy == "same_project"


def test_walk_helpers_stay_off_phone_and_grok():
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    forbidden = ("format_trace", "format_trace_table", "stop_policy", "assert_stop")
    swift = list((root / "ios").rglob("*.swift")) if (root / "ios").exists() else []
    for path in swift + [
        root / "backend" / "app" / "main.py",
        root / "backend" / "app" / "grokbot.py",
        root / "backend" / "app" / "field_chain.py",
    ]:
        text = path.read_text()
        for name in forbidden:
            assert name not in text, f"{name} leaked into {path}"


def test_mutation_swap_area_scope_and_role_allows_changes_stop(evaluate_cov):
    hopper = subject(role=Role.APPRENTICE, area_id=AREA)
    other = resource(area_id=OTHER_AREA)
    current = evaluate_cov(hopper, Action.CREATE_RFI_DRAFT, other)
    assert_stop(current.steps, "role_allows")
    swapped = PolicySet(
        name="swapped",
        combining=Combining.DENY_OVERRIDES,
        policies=tuple(
            Policy(
                name=policy.name,
                rule=policy.rule,
                order=(
                    35
                    if policy.name == "area_scope"
                    else 50
                    if policy.name == "role_allows"
                    else policy.order
                ),
            )
            for policy in FIELD_POLICY_SET.policies
        ),
    )
    mutated = evaluate(hopper, Action.CREATE_RFI_DRAFT, other, policy_set=swapped)
    assert_stop(mutated.steps, "area_scope")
    assert stop_policy(current.steps) != stop_policy(mutated.steps)


def test_mutation_role_allows_none_hits_default_deny_not_fail_open():
    hole = PolicySet(
        name="muted_role",
        combining=Combining.DENY_OVERRIDES,
        policies=tuple(
            Policy(
                name=policy.name,
                rule=(lambda *_a, **_k: None)
                if policy.name == "role_allows"
                else policy.rule,
                order=policy.order,
            )
            for policy in FIELD_POLICY_SET.ranked()
        ),
    )
    decision, steps = evaluate(
        subject(role=Role.JOURNEYMAN),
        Action.CREATE_RFI_DRAFT,
        resource(),
        policy_set=hole,
    )
    assert decision.allowed is False
    assert decision.policy == "default_deny"
    assert steps[-1].policy == "default_deny"
    assert steps[-1].effect == "deny"


def test_mutation_area_scope_second_allow_fails_leaked_allow():
    from app.policy_coverage import DENY_ONLY, PolicyCoverage, assert_policy_coverage

    def leak(*_args, **_kwargs):
        return Decision(Effect.ALLOW, "leaked", policy="area_scope")

    two = PolicySet(
        name="leaked",
        combining=Combining.DENY_OVERRIDES,
        policies=(
            Policy(name="role_allows", rule=role_allows, order=40),
            Policy(name="area_scope", rule=leak, order=50),
        ),
    )
    with pytest.raises(TypeError, match="second allow"):
        evaluate(
            subject(role=Role.JOURNEYMAN),
            Action.CREATE_RFI_DRAFT,
            resource(),
            policy_set=two,
        )

    bag = PolicyCoverage()
    for name in DENY_ONLY:
        bag.seen.add(name)
        bag.stops.add(name)
        bag.hit_counts[name]["deny"] = 1
    bag.seen.add("role_allows")
    bag.stops.add("role_allows")
    bag.hit_counts["role_allows"]["allow"] = 1
    bag.hit_counts["role_allows"]["deny"] = 1
    bag.hit_counts["area_scope"]["allow"] = 1
    with pytest.raises(AssertionError, match="leaked"):
        assert_policy_coverage(bag)
