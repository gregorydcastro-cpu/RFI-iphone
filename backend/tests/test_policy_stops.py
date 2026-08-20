"""Gold traces. These lock the walk, not just allow/deny."""

from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

import pytest

from abac import (
    AUDIT_LINE_KEYS,
    DENY_LOG_FIELDS,
    FIELD_SET_NAMES,
    HUNG_WRITES,
    WALK_DUMP_DROP,
    WALK_DUMP_KEYS,
    WALK_DUMP_STEP_KEYS,
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
    LOG_FIELD_ORDER,
    Resource,
    Role,
    Subject,
    SUBJECT_FIELD_ORDER,
    TRACE_FIELD_ORDER,
    as_decision_policy,
    deny_log_fields,
    dump_walk,
    emit_audit_line,
    evaluate as _engine_evaluate,
    format_audit_line,
    grok_denied,
    raise_http,
    reject_audit_line,
    reject_env_field_order,
    reject_evaluation_log_shape,
    reject_evaluation_trace_shape,
    reject_frozen_env_now,
    reject_subject_actor_type,
    reject_subject_crew_ids,
    require_access,
)
from app.policy_coverage import EXPECTED_ORDER, FIELD_LANES, PolicyCoverage, _traces
from tests.coverage_abac import PolicyCoverage as WalkCoverage
from tests.coverage_abac import assert_policy_coverage as assert_walk_coverage

JOB = UUID("00000000-0000-4000-8000-000000000010")
OTHER_JOB = UUID("00000000-0000-4000-8000-000000000110")
AREA = UUID("00000000-0000-4000-8000-000000000401")
OTHER_AREA = UUID("00000000-0000-4000-8000-000000000402")
USER = UUID("00000000-0000-4000-8000-000000000001")
CREW = UUID("00000000-0000-4000-8000-000000000002")
OTHER = UUID("00000000-0000-4000-8000-000000000003")
COMPANY = UUID("00000000-0000-4000-8000-000000000301")


def subject(
    *,
    role: Role = Role.JOURNEYMAN,
    actor_type: ActorType = ActorType.HUMAN,
    project_id: UUID = JOB,
    area_id: UUID | None = AREA,
    user_id: UUID = USER,
    crew_ids: frozenset[UUID] | None = None,
    reports_to_id: UUID | None = None,
    company_id: UUID = COMPANY,
) -> Subject:
    return Subject(
        user_id=user_id,
        company_id=company_id,
        project_id=project_id,
        role=role,
        area_id=area_id,
        reports_to_id=reports_to_id,
        actor_type=actor_type,
        crew_ids=crew_ids if crew_ids is not None else frozenset(),
    )


def resource(
    *,
    type: str = "rfi",
    project_id: UUID = JOB,
    area_id: UUID | None = AREA,
    status: str | None = "draft",
    **kwargs,
) -> Resource:
    return Resource(
        type=type, project_id=project_id, area_id=area_id, status=status, **kwargs
    )


def names(walk) -> list[str]:
    return [step.policy for step in _traces(walk)]


def first_stop(walk) -> EvaluationTrace:
    for step in _traces(walk):
        if step.stopped:
            return step
    raise AssertionError("walk never stopped")


def gold_rows(walk) -> list[tuple]:
    """seq, policy, n/a | DENY, optional reason, STOP."""
    rows: list[tuple] = []
    for step in _traces(walk):
        if step.effect is None and step.applicable is False:
            rows.append((step.seq, step.policy, "n/a"))
            continue
        if step.effect == "allow":
            rows.append((step.seq, step.policy, "ALLOW", step.reason))
            continue
        if step.effect == "deny" and step.stopped:
            rows.append((step.seq, step.policy, "DENY", step.reason, "STOP"))
            continue
        rows.append(
            (
                step.seq,
                step.policy,
                step.effect,
                step.reason,
                "STOP" if step.stopped else None,
            )
        )
    return rows


# Server / test / REPL only. Never on the iPhone. Never a Grokbot tool result.
# Reading a deny: last applicable step is the problem.
# Before = n/a (not allowed). After = did not run.
DENY_READ = {
    "grokbot_lane": "packet bug, bot tried to submit/set_priority",
    "role_allows": "wrong role on project_assignments",
    "area_scope": "area_id on resource vs subject",
    "assigned_only": "assigned_to_id",
    "chain_owns": "crew_foreman_id",
    "status_guard": "already submitted/answered",
    "work_stop_writer": "need set_priority / allow_demote",
    "same_project": "handler loaded the wrong job",
}


TRACE_TABLE_FIELDS = ("seq", "policy", "applicable", "effect", "stopped")


def trace_table(steps: Iterable[EvaluationTrace]) -> list[tuple]:
    """Machine fields only. effect is None when n/a (printed as —)."""
    return [
        (step.seq, step.policy, step.applicable, step.effect, step.stopped)
        for step in steps
    ]


def format_trace_table(steps: Iterable[EvaluationTrace]) -> str:
    """Server/test/REPL table. Not HTTP. Not the phone. Not a Grok tool result."""
    lines: list[str] = []
    for step in steps:
        appl = "yes" if step.applicable else "no"
        effect = "—" if step.effect is None else step.effect
        stopped = "yes" if step.stopped else "no"
        lines.append(
            f"seq{step.seq} {step.policy} appl={appl} effect={effect} stopped={stopped}"
        )
    return "\n".join(lines)


def reject_stopped_only_on_halt_deny(steps: Iterable[EvaluationTrace]) -> None:
    """stopped is True only on the deny that halted. An allow is never stopped."""
    for step in steps:
        if step.effect == "allow" and step.stopped:
            raise TypeError("an allow is never stopped")
        if step.stopped and step.effect != "deny":
            raise TypeError("stopped is True only on the deny that halted")
        if step.effect == "deny" and not step.stopped:
            raise TypeError("the deny that halted must set stopped")


def format_trace(steps: Iterable[EvaluationTrace], *, decision: Decision | None = None) -> str:
    """Server/test/REPL receipt. Not HTTP. Not the phone. Not a Grok tool result."""
    lines: list[str] = []
    for i, step in enumerate(steps, start=1):
        if not step.applicable:
            mark = "n/a"
        elif step.effect == "deny":
            mark = f"DENY  {step.reason}"
        else:
            mark = f"ALLOW {step.reason}"
        stop = "  STOP" if step.stopped else ""
        lines.append(f"{i:2}  {step.policy:<20} {mark}{stop}")
    if decision is not None:
        lines.append(f"→ {decision.effect.value.upper()}  {decision.policy}: {decision.reason}")
    return "\n".join(lines)


PREFIX_DENY = {
    1: "same_project",
    2: "grokbot_lane",
    3: "on_site",
    4: "role_allows",
}


def stop_policy(steps: list[EvaluationTrace]) -> str | None:
    """Use stopped=True. Never steps[-1]."""
    for step in steps:
        if step.stopped:
            return step.policy
    return None


def assert_walk_invariants(
    decision: Decision,
    steps: Iterable[EvaluationTrace],
    *,
    policy_set=FIELD_POLICY_SET,
) -> None:
    """Sanity. Evaluator/logger drifted — do not tune a role."""
    rows = list(steps)
    seqs = [step.seq for step in rows]
    assert seqs == list(range(1, len(rows) + 1)), f"seq not contiguous from 1: {seqs}"
    names = [step.policy for step in rows]
    ranked = tuple(policy.name for policy in policy_set.ranked())
    space = EXPECTED_ORDER if policy_set is FIELD_POLICY_SET else ranked
    assert names == list(space[: len(names)]), (
        f"names are a prefix of the ranked set, never a reshuffle: {names}"
    )
    stopped = [step for step in rows if step.stopped]
    assert len(stopped) <= 1, f"at most one stopped=True: {stopped}"
    allows = [step for step in rows if step.effect == "allow"]
    assert len(allows) <= 1, f"at most one effect=allow: {allows}"
    if allows:
        assert allows[0].policy == "role_allows"
        assert allows[0].stopped is False
    if stopped:
        assert decision.allowed is False
        if as_decision_policy(decision) != "default_deny":
            assert decision.policy == stopped[0].policy
    if not stopped and decision.allowed:
        assert names == list(ranked)
    first = next((step for step in rows if step.applicable), None)
    if (
        policy_set is FIELD_POLICY_SET
        and first is not None
        and first.effect == "deny"
        and first.seq in PREFIX_DENY
    ):
        assert first.policy == PREFIX_DENY[first.seq]


def evaluate(*args, **kwargs):
    walk = _engine_evaluate(*args, **kwargs)
    assert_walk_invariants(
        walk.decision,
        walk.steps,
        policy_set=kwargs.get("policy_set", FIELD_POLICY_SET),
    )
    reject_stopped_only_on_halt_deny(walk.steps)
    return walk


def assert_stop(steps: list[EvaluationTrace], name: str) -> None:
    actual = stop_policy(steps)
    if actual != name:
        raise AssertionError(
            f"expected stop at {name}, got {actual}\n{format_trace(steps)}"
        )


def gold_evaluates():
    yield evaluate(
        subject(project_id=JOB),
        Action.SUBMIT_RFI,
        resource(project_id=OTHER_JOB),
    )
    yield evaluate(
        subject(role=Role.GENERAL_FOREMAN, actor_type=ActorType.GROKBOT),
        Action.SUBMIT_RFI,
        resource(),
    )
    yield evaluate(subject(role=Role.APPRENTICE), Action.SUBMIT_RFI, resource())
    yield evaluate(subject(role=Role.JOURNEYMAN), Action.CREATE_RFI_DRAFT, resource())
    yield evaluate(
        subject(role=Role.AREA_FOREMAN, area_id=AREA),
        Action.SET_PRIORITY,
        resource(area_id=OTHER_AREA),
    )
    yield evaluate(
        subject(role=Role.GENERAL_FOREMAN, area_id=None),
        Action.SUBMIT_RFI,
        resource(),
    )
    yield evaluate(
        subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
        Action.SUBMIT_RFI,
        resource(created_by_id=OTHER, crew_foreman_id=OTHER),
    )
    yield evaluate(
        subject(role=Role.GENERAL_FOREMAN),
        Action.SUBMIT_RFI,
        resource(status="answered"),
    )
    yield evaluate(
        subject(role=Role.GENERAL_FOREMAN),
        Action.SET_PRIORITY,
        resource(priority="work_stopped", work_stopped=True, status="ball_in_court"),
        ctx={"priority": "standard", "allow_demote": False},
    )
    yield evaluate(subject(role=Role.GENERAL_FOREMAN), Action.WORK_STOP, resource())
    yield evaluate(
        subject(role=Role.JOURNEYMAN),
        Action.PIN_DRAFT,
        resource(type="sheet"),
        env=Env(on_site=False),
    )
    yield evaluate(
        subject(role=Role.JOURNEYMAN, area_id=AREA),
        Action.CREATE_RFI_DRAFT,
        resource(area_id=OTHER_AREA),
    )
    yield evaluate(
        subject(role=Role.APPRENTICE),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=None),
    )
    yield evaluate(
        subject(role=Role.APPRENTICE, actor_type=ActorType.GROKBOT),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=USER),
    )
    yield evaluate(
        subject(role=Role.JOURNEYMAN),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=USER),
    )
    yield evaluate(
        subject(role=Role.APPRENTICE, user_id=USER),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=USER),
    )
    from abac import Policy, PolicySet, default_deny, same_project

    empty = PolicySet(
        name="empty",
        combining=Combining.DENY_OVERRIDES,
        policies=(
            Policy(name="same_project", rule=same_project, order=10),
            Policy(name="default_deny", rule=default_deny, order=99),
        ),
    )
    yield evaluate(
        subject(project_id=JOB),
        Action.VIEW_PRINT,
        resource(project_id=JOB),
        policy_set=empty,
    )


def test_policy_set_rank_is_fixed():
    assert tuple(policy.name for policy in FIELD_POLICY_SET.ranked()) == FIELD_LANES
    assert EXPECTED_ORDER == FIELD_LANES + ("default_deny",)
    assert "default_deny" not in FIELD_SET_NAMES


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
    env = Env()
    assert env.timezone_name == "America/New_York"
    assert env.sla_unit == "business_days"
    assert env.work_stopped_queue is False

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
    from uuid import UUID

    crew = next(item for item in fields(Subject) if item.name == "crew_ids")
    assert crew.default is MISSING
    assert crew.default_factory is frozenset
    assert Subject.__dataclass_params__.frozen is True
    reject_subject_crew_ids(Subject)

    @dataclass(frozen=True)
    class SharedCrew:
        crew_ids: frozenset[UUID] = frozenset()

    with pytest.raises(TypeError, match="class-body"):
        reject_subject_crew_ids(SharedCrew)

    @dataclass(frozen=True)
    class MutableCrew:
        crew_ids: set[UUID] = field(default_factory=set)

    with pytest.raises(TypeError, match="mutable"):
        reject_subject_crew_ids(MutableCrew)

    @dataclass
    class Thawed:
        crew_ids: frozenset[UUID] = field(default_factory=frozenset)

    with pytest.raises(TypeError, match="frozen"):
        reject_subject_crew_ids(Thawed)


def test_subject_actor_type_is_required():
    from dataclasses import MISSING, dataclass, field, fields

    actor = next(item for item in fields(Subject) if item.name == "actor_type")
    assert actor.default is MISSING
    assert actor.default_factory is MISSING
    assert tuple(item.name for item in fields(Subject)) == SUBJECT_FIELD_ORDER
    reject_subject_actor_type(Subject)
    with pytest.raises(TypeError):
        Subject(
            user_id=USER,
            company_id=COMPANY,
            project_id=JOB,
            role=Role.JOURNEYMAN,
        )
    grok = Subject(
        user_id=USER,
        company_id=COMPANY,
        project_id=JOB,
        role=Role.GENERAL_FOREMAN,
        actor_type=ActorType.GROKBOT,
    )
    assert grok.actor_type is ActorType.GROKBOT

    @dataclass(frozen=True, kw_only=True)
    class SoftHuman:
        user_id: UUID
        company_id: UUID
        project_id: UUID
        role: Role
        actor_type: ActorType = ActorType.HUMAN
        area_id: UUID | None = None
        reports_to_id: UUID | None = None
        crew_ids: frozenset[UUID] = field(default_factory=frozenset)

    with pytest.raises(TypeError, match="required"):
        reject_subject_actor_type(SoftHuman)


def test_evaluation_trace_shape_is_law():
    from dataclasses import fields

    reject_evaluation_trace_shape(EvaluationTrace)
    assert tuple(item.name for item in fields(EvaluationTrace)) == TRACE_FIELD_ORDER
    log = evaluate(
        subject(project_id=JOB),
        Action.SUBMIT_RFI,
        resource(project_id=OTHER_JOB),
    )
    decision, steps = log
    assert_stop(steps, "same_project")
    step = first_stop(log)
    assert step.seq == 1
    assert step.policy == "same_project"
    assert step.order == 10
    assert step.applicable is True
    assert step.effect == "deny"
    assert step.reason == "not on this job"
    assert step.stopped is True


def test_evaluation_log_is_server_audit_envelope():
    from dataclasses import MISSING, fields
    from datetime import datetime

    stamped = next(item for item in fields(EvaluationLog) if item.name == "evaluated_at")
    assert stamped.default is MISSING
    assert stamped.default_factory is MISSING
    assert tuple(item.name for item in fields(EvaluationLog)) == LOG_FIELD_ORDER
    reject_evaluation_log_shape(EvaluationLog)
    from abac import audit_logs

    with pytest.raises(AccessDenied):
        require_access(
            subject(project_id=JOB),
            Action.SUBMIT_RFI,
            resource(project_id=OTHER_JOB),
        )
    log = audit_logs()[-1]
    assert isinstance(log.evaluated_at, datetime)
    assert log.combining == "deny_overrides"
    assert log.subject_id == USER
    assert log.actor_type == "human"
    assert log.role == "journeyman"
    assert log.action == "submit_rfi"
    assert log.resource_type == "rfi"
    assert log.resource_project_id == OTHER_JOB
    assert log.resource_id is None
    assert log.area_id == AREA
    assert log.steps[0].policy == "same_project"


def test_deny_audit_line_is_law(caplog):
    import logging

    from abac import audit_logs

    other = resource(created_by_id=OTHER, crew_foreman_id=OTHER)
    with caplog.at_level(logging.INFO, logger="abac"):
        with pytest.raises(AccessDenied):
            require_access(
                subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
                Action.SUBMIT_RFI,
                other,
            )
    log = audit_logs()[-1]
    line = (
        f"abac deny action=submit_rfi role=foreman actor=human "
        f"policy=chain_owns project={JOB}"
    )
    assert format_audit_line(log) == line
    reject_audit_line(line)
    assert AUDIT_LINE_KEYS == ("action", "role", "actor", "policy", "project")
    assert DENY_LOG_FIELDS == ("policy", "action", "role", "actor_type", "project_id", "seq")
    assert deny_log_fields(log) == {
        "policy": "chain_owns",
        "action": "submit_rfi",
        "role": "foreman",
        "actor_type": "human",
        "project_id": str(JOB),
        "seq": 7,
    }
    recorded = next(item for item in caplog.records if item.message == line)
    assert recorded.seq == 7
    assert recorded.actor_type == "human"
    assert recorded.project_id == str(JOB)
    assert line in caplog.messages
    assert "user" not in line
    assert "phone" not in line
    assert "question" not in line
    assert "pdf" not in line
    with pytest.raises(TypeError, match="must not include"):
        reject_audit_line(line + " question=why the beam")
    with pytest.raises(TypeError, match="keys are law"):
        reject_audit_line(line + " extra=1")


def test_allow_audit_line_for_submit_and_set_priority(caplog):
    import logging

    from abac import audit_logs

    with caplog.at_level(logging.INFO, logger="abac"):
        require_access(subject(role=Role.GENERAL_FOREMAN), Action.SUBMIT_RFI, resource())
        require_access(
            subject(role=Role.GENERAL_FOREMAN),
            Action.SET_PRIORITY,
            resource(),
            ctx={"priority": "urgent"},
        )
        require_access(subject(role=Role.JOURNEYMAN), Action.CREATE_RFI_DRAFT, resource())
    submit = (
        f"abac allow action=submit_rfi role=general_foreman actor=human "
        f"policy=role_allows project={JOB}"
    )
    priority = (
        f"abac allow action=set_priority role=general_foreman actor=human "
        f"policy=role_allows project={JOB}"
    )
    draft = (
        f"abac allow action=create_rfi_draft role=journeyman actor=human "
        f"policy=role_allows project={JOB}"
    )
    logs = audit_logs()
    assert format_audit_line(logs[-3]) == submit
    assert format_audit_line(logs[-2]) == priority
    assert format_audit_line(logs[-1]) == draft
    reject_audit_line(submit)
    reject_audit_line(priority)
    assert submit in caplog.messages
    assert priority in caplog.messages
    assert draft not in caplog.messages
    assert emit_audit_line(logs[-1]) == draft


def test_wrong_job_stops_at_same_project(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(project_id=JOB),
        Action.SUBMIT_RFI,
        resource(project_id=OTHER_JOB),
    ))
    decision, steps = log
    assert names(log) == ["same_project"]
    assert_stop(steps, "same_project")
    assert decision.policy == "same_project"
    assert decision.allowed is False


def test_grokbot_submit_never_reaches_role(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.GENERAL_FOREMAN, actor_type=ActorType.GROKBOT),
        Action.SUBMIT_RFI,
        resource(),
    ))
    decision, steps = log
    assert TRACE_TABLE_FIELDS == ("seq", "policy", "applicable", "effect", "stopped")
    assert trace_table(steps) == [
        (1, "same_project", False, None, False),
        (2, "grokbot_lane", True, "deny", True),
    ]
    assert format_trace_table(steps) == (
        "seq1 same_project appl=no effect=— stopped=no\n"
        "seq2 grokbot_lane appl=yes effect=deny stopped=yes"
    )
    reject_stopped_only_on_halt_deny(steps)
    assert gold_rows(log) == [
        (1, "same_project", "n/a"),
        (2, "grokbot_lane", "DENY", "Grokbot may only create_rfi_draft", "STOP"),
    ]
    assert_stop(steps, "grokbot_lane")
    assert decision.policy == "grokbot_lane"
    assert "role_allows" not in names(log)


def test_apprentice_submit_stops_at_role(cov: PolicyCoverage):
    log = cov.record(evaluate(subject(role=Role.APPRENTICE), Action.SUBMIT_RFI, resource()))
    decision, steps = log
    assert gold_rows(log) == [
        (1, "same_project", "n/a"),
        (2, "grokbot_lane", "n/a"),
        (3, "on_site", "n/a"),
        (4, "role_allows", "DENY", "apprentice cannot submit_rfi", "STOP"),
    ]
    assert_stop(steps, "role_allows")
    assert decision.policy == "role_allows"


def test_journeyman_draft_allow_walks_full_set(cov: PolicyCoverage):
    log = cov.record(evaluate(subject(role=Role.JOURNEYMAN), Action.CREATE_RFI_DRAFT, resource()))
    decision, steps = log
    assert TRACE_TABLE_FIELDS == ("seq", "policy", "applicable", "effect", "stopped")
    assert trace_table(steps) == [
        (1, "same_project", False, None, False),
        (2, "grokbot_lane", False, None, False),
        (3, "on_site", False, None, False),
        (4, "role_allows", True, "allow", False),
        (5, "area_scope", False, None, False),
        (6, "assigned_only", False, None, False),
        (7, "chain_owns", False, None, False),
        (8, "status_guard", False, None, False),
        (9, "work_stop_writer", False, None, False),
    ]
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
    reject_stopped_only_on_halt_deny(steps)
    assert gold_rows(log) == [
        (1, "same_project", "n/a"),
        (2, "grokbot_lane", "n/a"),
        (3, "on_site", "n/a"),
        (4, "role_allows", "ALLOW", "journeyman may create_rfi_draft"),
        (5, "area_scope", "n/a"),
        (6, "assigned_only", "n/a"),
        (7, "chain_owns", "n/a"),
        (8, "status_guard", "n/a"),
        (9, "work_stop_writer", "n/a"),
    ]
    assert decision.allowed is True
    assert decision.policy == "role_allows"
    assert steps[3].effect == "allow"
    assert steps[3].stopped is False
    assert not any(step.stopped for step in steps)


def test_area_foreman_other_area_stops_after_role(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.AREA_FOREMAN, area_id=AREA),
        Action.SET_PRIORITY,
        resource(area_id=OTHER_AREA),
    ))
    decision, steps = log
    assert names(log) == list(EXPECTED_ORDER[:5])
    assert_stop(steps, "area_scope")
    assert steps[3].policy == "role_allows"
    assert steps[3].effect == "allow"
    assert decision.policy == "area_scope"


def test_gf_skips_area_and_still_walks(cov: PolicyCoverage):
    log = cov.record(evaluate(subject(role=Role.GENERAL_FOREMAN, area_id=None), Action.SUBMIT_RFI, resource()))
    assert names(log) == list(EXPECTED_ORDER[:9])
    area = next(step for step in log.steps if step.policy == "area_scope")
    assert area.applicable is False
    assert log.decision.allowed is True


def test_foreman_other_crew_stops_at_chain_owns(cov: PolicyCoverage):
    from fastapi import HTTPException

    other = resource(created_by_id=OTHER, crew_foreman_id=OTHER)
    log = cov.record(evaluate(
        subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
        Action.SUBMIT_RFI,
        other,
    ))
    decision, steps = log
    assert gold_rows(log) == [
        (1, "same_project", "n/a"),
        (2, "grokbot_lane", "n/a"),
        (3, "on_site", "n/a"),
        (4, "role_allows", "ALLOW", "foreman may submit_rfi"),
        (5, "area_scope", "n/a"),
        (6, "assigned_only", "n/a"),
        (7, "chain_owns", "DENY", "not your crew's ticket", "STOP"),
    ]
    assert_stop(steps, "chain_owns")
    assert first_stop(log).reason == "not your crew's ticket"
    assert decision.policy == "chain_owns"
    assert decision.reason == "not your crew's ticket"
    assigned = cov.record(evaluate(
        subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
        Action.ASSIGN_MATERIAL,
        resource(type="ticket", created_by_id=OTHER, crew_foreman_id=OTHER),
    ))
    _, assigned_steps = assigned
    assert_stop(assigned_steps, "chain_owns")
    assert first_stop(assigned).reason == "not your crew's ticket"
    with pytest.raises(AccessDenied) as raised:
        require_access(
            subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
            Action.SUBMIT_RFI,
            other,
        )
    cov.record(raised.value)
    with pytest.raises(HTTPException) as http:
        raise_http(raised.value)
    assert http.value.status_code == 403
    assert http.value.detail == {
        "policy": "chain_owns",
        "reason": "not your crew's ticket",
    }
    assert "abac" not in str(http.value.detail)
    assert "actor" not in http.value.detail
    assert "project" not in http.value.detail


def test_submit_from_answered_stops_at_status(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.GENERAL_FOREMAN),
        Action.SUBMIT_RFI,
        resource(status="answered"),
    ))
    decision, steps = log
    assert names(log) == list(EXPECTED_ORDER[:8])
    assert_stop(steps, "status_guard")
    assert decision.policy == "status_guard"


def test_work_stopped_demote_without_flag(cov: PolicyCoverage):
    from fastapi import HTTPException

    stopped = resource(
        priority="work_stopped", work_stopped=True, status="ball_in_court"
    )
    log = cov.record(evaluate(
        subject(role=Role.GENERAL_FOREMAN),
        Action.SET_PRIORITY,
        stopped,
        ctx={"priority": "standard", "allow_demote": False},
    ))
    rows = gold_rows(log)
    assert (4, "role_allows", "ALLOW", "general_foreman may set_priority") in rows
    assert rows[-1] == (
        9,
        "work_stop_writer",
        "DENY",
        "demote of work_stopped requires allow_demote",
        "STOP",
    )
    decision, steps = log
    assert_stop(steps, "work_stop_writer")
    assert decision.policy == "work_stop_writer"
    with pytest.raises(AccessDenied) as raised:
        require_access(
            subject(role=Role.GENERAL_FOREMAN),
            Action.SET_PRIORITY,
            stopped,
            ctx={"priority": "standard", "allow_demote": False},
        )
    cov.record(raised.value)
    with pytest.raises(HTTPException) as http:
        raise_http(raised.value)
    assert http.value.status_code == 403
    assert http.value.detail["policy"] == "work_stop_writer"
    assert http.value.detail == {
        "policy": "work_stop_writer",
        "reason": "demote of work_stopped requires allow_demote",
    }


def test_work_stop_action_always_denied_at_writer(cov: PolicyCoverage):
    log = cov.record(evaluate(subject(role=Role.GENERAL_FOREMAN), Action.WORK_STOP, resource()))
    decision, steps = log
    assert names(log) == list(EXPECTED_ORDER[:9])
    assert_stop(steps, "work_stop_writer")
    assert first_stop(log).reason == "use set_priority; do not flip work_stopped"
    assert decision.policy == "work_stop_writer"
    assert "default_deny" not in names(log)


def test_require_access_raises_with_trace_stop(cov: PolicyCoverage):
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
    assert gold_rows(raised.value) == [
        (1, "same_project", "n/a"),
        (2, "grokbot_lane", "n/a"),
        (3, "on_site", "n/a"),
        (4, "role_allows", "DENY", "apprentice cannot submit_rfi", "STOP"),
    ]
    assert_stop(steps, "role_allows")
    assert raised.value.decision.policy == "role_allows"
    assert raised.value.trace == tuple(audit)
    assert first_stop(raised.value).effect == "deny"
    assert first_stop(raised.value).stopped is True
    with pytest.raises(HTTPException) as http:
        raise_http(raised.value)
    assert http.value.status_code == 403
    assert http.value.detail == {
        "policy": "role_allows",
        "reason": "apprentice cannot submit_rfi",
    }
    assert http.value.detail["policy"] == first_stop(raised.value).policy
    assert "trace" not in http.value.detail
    assert "seq" not in http.value.detail


def test_off_site_pin_stops_before_role(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.JOURNEYMAN),
        Action.PIN_DRAFT,
        resource(type="sheet"),
        env=Env(on_site=False),
    ))
    decision, steps = log
    assert names(log) == list(EXPECTED_ORDER[:3])
    assert_stop(steps, "on_site")
    assert decision.policy == "on_site"
    assert "role_allows" not in names(log)


def test_no_later_allow_overrides_earlier_deny(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.JOURNEYMAN, project_id=JOB),
        Action.CREATE_RFI_DRAFT,
        resource(project_id=OTHER_JOB),
    ))
    decision, steps = log
    assert names(log) == ["same_project"]
    assert_stop(steps, "same_project")
    assert "role_allows" not in names(log)
    assert decision.allowed is False


def test_journeyman_create_other_area_later_deny_wins(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.JOURNEYMAN, area_id=AREA),
        Action.CREATE_RFI_DRAFT,
        resource(area_id=OTHER_AREA),
    ))
    decision, steps = log
    assert names(log) == list(EXPECTED_ORDER[:5])
    assert_stop(steps, "area_scope")
    assert "assigned_only" not in names(log)
    assert steps[3].policy == "role_allows"
    assert steps[3].effect == "allow"
    assert steps[3].reason == "journeyman may create_rfi_draft"
    assert first_stop(log).reason == "outside your area"
    assert decision.policy == "area_scope"


def test_apprentice_handle_unassigned_stops_at_assigned_only(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.APPRENTICE),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=None),
    ))
    decision, steps = log
    assert names(log) == list(EXPECTED_ORDER[:6])
    assert_stop(steps, "assigned_only")
    assert first_stop(log).reason == "not your ticket"
    assert steps[3].policy == "role_allows"
    assert steps[3].effect == "allow"
    assert steps[3].reason == "apprentice may handle_material"
    assert decision.policy == "assigned_only"


def test_apprentice_handle_other_ticket_stops_at_assigned_only(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.APPRENTICE, user_id=USER),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=OTHER),
    ))
    decision, steps = log
    assert names(log) == list(EXPECTED_ORDER[:6])
    assert_stop(steps, "assigned_only")
    assert first_stop(log).reason == "not your ticket"
    assert decision.policy == "assigned_only"
    assert "chain_owns" not in names(log)


def test_grokbot_handle_stops_at_lane(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.APPRENTICE, actor_type=ActorType.GROKBOT),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=USER),
    ))
    decision, steps = log
    assert names(log) == list(EXPECTED_ORDER[:2])
    assert_stop(steps, "grokbot_lane")
    assert decision.policy == "grokbot_lane"
    assert "role_allows" not in names(log)
    assert "assigned_only" not in names(log)


def test_journeyman_handle_stops_at_role(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.JOURNEYMAN),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=USER),
    ))
    decision, steps = log
    assert names(log) == list(EXPECTED_ORDER[:4])
    assert_stop(steps, "role_allows")
    assert first_stop(log).reason == "journeyman cannot handle_material"
    assert decision.policy == "role_allows"
    assert "assigned_only" not in names(log)


def test_apprentice_handle_own_ticket_allows(cov: PolicyCoverage):
    log = cov.record(evaluate(
        subject(role=Role.APPRENTICE, user_id=USER),
        Action.HANDLE_MATERIAL,
        resource(type="ticket", assigned_to_id=USER),
    ))
    assert names(log) == list(EXPECTED_ORDER[:9])
    assigned = next(step for step in log.steps if step.policy == "assigned_only")
    assert assigned.applicable is False
    assert assigned.effect is None
    assert assigned.reason is None
    assert assigned.stopped is False
    assert log.decision.allowed is True
    assert log.decision.policy == "role_allows"
    assert log.decision.reason == "apprentice may handle_material"


def test_default_deny_is_deny_only_when_nothing_permitted():
    from abac import Combining, Policy, PolicySet, default_deny, same_project

    empty = PolicySet(
        name="empty",
        combining=Combining.DENY_OVERRIDES,
        policies=(
            Policy(name="same_project", rule=same_project, order=10),
            Policy(name="default_deny", rule=default_deny, order=99),
        ),
    )
    log = evaluate(
        subject(project_id=JOB),
        Action.VIEW_PRINT,
        resource(project_id=JOB),
        policy_set=empty,
    )
    decision, steps = log
    assert names(log) == ["same_project", "default_deny"]
    assert_stop(steps, "default_deny")
    assert decision.allowed is False
    assert default_deny(subject(), Action.VIEW_PRINT, resource(), Env()).effect is Effect.DENY


def test_default_deny_hole_when_role_allows_returns_none(caplog):
    import logging

    from abac import Policy, PolicySet, audit_logs, default_deny

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
    assert [step.policy for step in steps] == list(FIELD_LANES)
    assert all(step.applicable is False for step in steps)
    assert all(step.effect is None for step in steps)
    assert not any(step.stopped for step in steps)
    assert decision.allowed is False
    assert as_decision_policy(decision) == "default_deny"
    assert decision.policy not in FIELD_SET_NAMES
    assert default_deny(subject(), Action.CREATE_RFI_DRAFT, resource(), Env()).effect is Effect.DENY
    line = (
        f"abac deny action=create_rfi_draft role=journeyman actor=human "
        f"policy=default_deny project={JOB}"
    )
    assert format_audit_line(audit_logs()[-1]) == line
    assert line in caplog.messages
    from abac import Evaluation

    bag = WalkCoverage()
    bag.record(Evaluation(decision, tuple(steps)))
    with pytest.raises(AssertionError, match="never_applicable") as raised:
        assert_walk_coverage(bag)
    assert "role_allows" in str(raised.value)


def test_walk_dump_keeps_machine_fields_only():
    decision, steps = evaluate(
        subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
        Action.SUBMIT_RFI,
        resource(created_by_id=OTHER, crew_foreman_id=OTHER),
    )
    dumped = dump_walk(
        decision,
        steps,
        action=Action.SUBMIT_RFI,
        role=Role.FOREMAN,
        actor_type=ActorType.HUMAN,
    )
    assert dumped["decision.policy"] == "chain_owns"
    assert dumped["action"] == "submit_rfi"
    assert dumped["role"] == "foreman"
    assert dumped["actor_type"] == "human"
    assert set(dumped["steps"][0]) == set(WALK_DUMP_STEP_KEYS)
    blob = str(dumped)
    for dropped in WALK_DUMP_DROP:
        assert dropped not in blob
    assert "not your crew's ticket" not in blob
    assert WALK_DUMP_KEYS[-1] == "actor_type"


def test_chain_owns_denies_differ_by_resource_id_and_area():
    from abac import audit_logs

    left_id = UUID("00000000-0000-4000-8000-000000000701")
    right_id = UUID("00000000-0000-4000-8000-000000000702")
    left = resource(
        id=left_id,
        area_id=AREA,
        created_by_id=OTHER,
        crew_foreman_id=OTHER,
    )
    right = resource(
        id=right_id,
        area_id=OTHER_AREA,
        created_by_id=OTHER,
        crew_foreman_id=OTHER,
    )
    with pytest.raises(AccessDenied):
        require_access(
            subject(role=Role.FOREMAN, area_id=AREA, crew_ids=frozenset({CREW})),
            Action.SUBMIT_RFI,
            left,
        )
    with pytest.raises(AccessDenied):
        require_access(
            subject(
                role=Role.FOREMAN, area_id=OTHER_AREA, crew_ids=frozenset({CREW})
            ),
            Action.SUBMIT_RFI,
            right,
        )
    first, second = audit_logs()[-2:]
    assert first.decision.policy == second.decision.policy == "chain_owns"
    assert first.resource_id == left_id
    assert second.resource_id == right_id
    assert first.area_id == AREA
    assert second.area_id == OTHER_AREA
    assert (first.resource_id, first.area_id) != (second.resource_id, second.area_id)


def test_debug_on_fail() -> None:
    decision, steps = evaluate(subject(role=Role.APPRENTICE), Action.SUBMIT_RFI, resource())
    if decision.policy != "role_allows":
        raise AssertionError(format_trace(steps, decision=decision))


def test_assert_stop_prints_receipt_on_mismatch() -> None:
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


def test_later_allow_does_not_cancel_a_deny():
    assert FIELD_POLICY_SET.combining is Combining.DENY_OVERRIDES
    decision, steps = evaluate(
        subject(role=Role.JOURNEYMAN, area_id=AREA),
        Action.CREATE_RFI_DRAFT,
        resource(area_id=OTHER_AREA),
    )
    assert_stop(steps, "area_scope")
    assert steps[3].effect == "allow"
    assert decision.allowed is False
    assert decision.policy == "area_scope"


def test_reading_a_deny_last_applicable_is_the_problem():
    cases = (
        (
            evaluate(
                subject(role=Role.GENERAL_FOREMAN, actor_type=ActorType.GROKBOT),
                Action.SUBMIT_RFI,
                resource(),
            ),
            "grokbot_lane",
        ),
        (
            evaluate(subject(role=Role.APPRENTICE), Action.SUBMIT_RFI, resource()),
            "role_allows",
        ),
        (
            evaluate(
                subject(role=Role.JOURNEYMAN, area_id=AREA),
                Action.CREATE_RFI_DRAFT,
                resource(area_id=OTHER_AREA),
            ),
            "area_scope",
        ),
        (
            evaluate(
                subject(role=Role.APPRENTICE),
                Action.HANDLE_MATERIAL,
                resource(type="ticket", assigned_to_id=None),
            ),
            "assigned_only",
        ),
        (
            evaluate(
                subject(role=Role.FOREMAN, crew_ids=frozenset({CREW})),
                Action.SUBMIT_RFI,
                resource(created_by_id=OTHER, crew_foreman_id=OTHER),
            ),
            "chain_owns",
        ),
        (
            evaluate(
                subject(role=Role.GENERAL_FOREMAN),
                Action.SUBMIT_RFI,
                resource(status="answered"),
            ),
            "status_guard",
        ),
        (
            evaluate(
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
            evaluate(
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


def test_coverage_report_gold_walks_have_no_dead_rules():
    bag = WalkCoverage()
    for walk in gold_evaluates():
        bag.record(walk)
    assert_walk_coverage(bag)
    assert bag.dead_rules == []
    assert bag.hits["chain_owns"].stop >= 1
    assert bag.hits["status_guard"].skipped_after_stop >= 1
    assert bag.hits["work_stop_writer"].skipped_after_stop >= 1


def test_grok_sees_denied_and_policy_only():
    decision, steps = evaluate(
        subject(role=Role.GENERAL_FOREMAN, actor_type=ActorType.GROKBOT),
        Action.SUBMIT_RFI,
        resource(),
    )
    assert_stop(steps, "grokbot_lane")
    body = grok_denied(decision)
    assert body == {"denied": True, "policy": "grokbot_lane"}
    assert set(body) == {"denied", "policy"}
    assert format_trace(steps) not in str(body)
    assert "reason" not in body
    assert "steps" not in body


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
