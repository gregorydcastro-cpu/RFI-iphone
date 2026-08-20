"""Field ABAC. This module is the access layer. Decision, not a bare bool."""

from __future__ import annotations

import inspect
from dataclasses import MISSING, dataclass, field, fields
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Literal
from uuid import UUID

SlaUnit = Literal["business_days", "calendar_days"]
TraceEffect = Literal["allow", "deny"]


class Role(str, Enum):
    GENERAL_FOREMAN = "general_foreman"
    AREA_FOREMAN = "area_foreman"
    FOREMAN = "foreman"
    JOURNEYMAN = "journeyman"
    APPRENTICE = "apprentice"


class ActorType(str, Enum):
    HUMAN = "human"
    GROKBOT = "grokbot"


class Action(str, Enum):
    VIEW_PRINT = "view_print"
    PIN_DRAFT = "pin_draft"
    CREATE_RFI_DRAFT = "create_rfi_draft"
    SUBMIT_RFI = "submit_rfi"
    SET_PRIORITY = "set_priority"
    WORK_STOP = "work_stop"
    VOID_RFI = "void_rfi"
    ALLOW_DEMOTE = "allow_demote"
    DRAFT_MATERIAL = "draft_material"
    APPROVE_MATERIAL = "approve_material"
    ASSIGN_MATERIAL = "assign_material"
    HANDLE_MATERIAL = "handle_material"
    FLAG_UP = "flag_up"


class Effect(str, Enum):
    ALLOW = "allow"
    DENY = "deny"


DESIGN_OPEN = frozenset({"submitted", "ball_in_court"})
DRAFTISH = frozenset({"draft", "internal_review", "needs_clarification"})

_JOURNEYMAN_ACTIONS = frozenset(
    {
        Action.VIEW_PRINT,
        Action.PIN_DRAFT,
        Action.CREATE_RFI_DRAFT,
        Action.DRAFT_MATERIAL,
        Action.FLAG_UP,
    }
)
_FOREMAN_ACTIONS = _JOURNEYMAN_ACTIONS | frozenset(
    {Action.SUBMIT_RFI, Action.ASSIGN_MATERIAL}
)
_AREA_FOREMAN_ACTIONS = _FOREMAN_ACTIONS | frozenset(
    {Action.SET_PRIORITY, Action.WORK_STOP, Action.APPROVE_MATERIAL}
)

ROLE_ACTIONS: dict[Role, frozenset[Action]] = {
    Role.APPRENTICE: frozenset(
        {Action.VIEW_PRINT, Action.HANDLE_MATERIAL, Action.FLAG_UP}
    ),
    Role.JOURNEYMAN: _JOURNEYMAN_ACTIONS,
    Role.FOREMAN: _FOREMAN_ACTIONS,
    Role.AREA_FOREMAN: _AREA_FOREMAN_ACTIONS,
    Role.GENERAL_FOREMAN: frozenset(Action),
}


SUBJECT_FIELD_ORDER = (
    "user_id",
    "company_id",
    "project_id",
    "role",
    "actor_type",
    "area_id",
    "reports_to_id",
    "crew_ids",
)


@dataclass(frozen=True, kw_only=True)
class Subject:
    user_id: UUID
    company_id: UUID
    project_id: UUID
    role: Role
    actor_type: ActorType  # required — default HUMAN makes Grokbot a person by omission
    area_id: UUID | None = None
    reports_to_id: UUID | None = None
    crew_ids: frozenset[UUID] = field(default_factory=frozenset)


def reject_subject_crew_ids(cls: type) -> None:
    """crew_ids is a per-instance frozenset factory. Frozen Subject only."""
    params = getattr(cls, "__dataclass_params__", None)
    if params is None or not params.frozen:
        raise TypeError("Subject must be frozen")
    crew = next(item for item in fields(cls) if item.name == "crew_ids")
    if crew.default is not MISSING:
        raise TypeError("Subject.crew_ids must not share a class-body frozenset")
    if crew.default_factory is MISSING:
        raise TypeError("Subject.crew_ids must use field(default_factory=frozenset)")
    if crew.default_factory is set:
        raise TypeError("Subject.crew_ids must not be a mutable default")
    sample = crew.default_factory()
    if type(sample) is not frozenset:
        raise TypeError("Subject.crew_ids factory must produce a frozenset")


def reject_subject_actor_type(cls: type) -> None:
    """actor_type is required. Default HUMAN makes Grokbot a person by omission."""
    params = getattr(cls, "__dataclass_params__", None)
    if params is None or not params.frozen:
        raise TypeError("Subject must be frozen")
    if not params.kw_only:
        raise TypeError("Subject must be kw_only")
    names = tuple(item.name for item in fields(cls))
    if names != SUBJECT_FIELD_ORDER:
        raise TypeError(f"Subject field order is law: {SUBJECT_FIELD_ORDER}")
    actor = next(item for item in fields(cls) if item.name == "actor_type")
    if actor.default is not MISSING or actor.default_factory is not MISSING:
        raise TypeError(
            "Subject.actor_type must be required; default HUMAN makes Grokbot a person by omission"
        )
    reject_subject_crew_ids(cls)


reject_subject_actor_type(Subject)


@dataclass(frozen=True)
class Resource:
    type: str  # rfi | material_order | sheet | ticket
    project_id: UUID
    area_id: UUID | None = None
    status: str | None = None
    priority: str | None = None
    work_stopped: bool = False
    created_by_id: UUID | None = None
    assigned_to_id: UUID | None = None
    crew_foreman_id: UUID | None = None
    requires_internal_review: bool = False


ENV_FIELD_ORDER = (
    "now",
    "on_site",
    "timezone_name",
    "sla_unit",
    "work_stopped_queue",
    "project_id",
    "area_id",
)


@dataclass(frozen=True, kw_only=True)
class Env:
    now: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    on_site: bool = True
    timezone_name: str = "America/New_York"
    sla_unit: SlaUnit = "business_days"
    work_stopped_queue: bool = False
    project_id: UUID | None = None
    area_id: UUID | None = None


def reject_frozen_env_now(cls: type) -> None:
    """Env.now is a factory. A class-body datetime.now() is a process-lifetime stamp."""
    now_field = next(item for item in fields(cls) if item.name == "now")
    if now_field.default is not MISSING:
        raise TypeError("Env.now must not freeze now at class-body time")
    if now_field.default_factory is MISSING:
        raise TypeError("Env.now must use field(default_factory=...)")


def reject_env_field_order(cls: type) -> None:
    """kw_only so a defaulted on_site cannot sit in front of a required now."""
    params = getattr(cls, "__dataclass_params__", None)
    if params is None or not params.frozen:
        raise TypeError("Env must be frozen")
    if not params.kw_only:
        raise TypeError("Env must be kw_only so field order cannot break")
    names = tuple(item.name for item in fields(cls))
    if names != ENV_FIELD_ORDER:
        raise TypeError(f"Env field order is law: {ENV_FIELD_ORDER}")
    reject_frozen_env_now(cls)


reject_env_field_order(Env)


@dataclass(frozen=True)
class PolicyContext:
    allow_demote: bool = False
    priority: str | None = None


AccessContext = PolicyContext


@dataclass(frozen=True)
class Decision:
    effect: Effect
    reason: str
    policy: str

    @property
    def allowed(self) -> bool:
        return self.effect is Effect.ALLOW


TRACE_FIELD_ORDER = (
    "seq",
    "policy",
    "order",
    "applicable",
    "effect",
    "reason",
    "stopped",
)


@dataclass(frozen=True)
class EvaluationTrace:
    seq: int
    policy: str
    order: int
    applicable: bool
    effect: TraceEffect | None
    reason: str | None
    stopped: bool


def reject_evaluation_trace_shape(cls: type) -> None:
    names = tuple(item.name for item in fields(cls))
    if names != TRACE_FIELD_ORDER:
        raise TypeError(f"EvaluationTrace field order is law: {TRACE_FIELD_ORDER}")
    params = getattr(cls, "__dataclass_params__", None)
    if params is None or not params.frozen:
        raise TypeError("EvaluationTrace must be frozen")


reject_evaluation_trace_shape(EvaluationTrace)


@dataclass(frozen=True)
class EvaluationLog:
    subject_user_id: UUID
    role: Role
    actor_type: ActorType
    project_id: UUID
    action: Action
    resource_type: str
    traces: tuple[EvaluationTrace, ...]
    decision: Decision


@dataclass(frozen=True)
class AccessDenied(PermissionError):
    decision: Decision
    trace: tuple[EvaluationTrace, ...] = ()

    def __str__(self) -> str:
        return f"{self.decision.policy}: {self.decision.reason}"


def _deny(policy: str, reason: str) -> Decision:
    return Decision(Effect.DENY, reason, policy=policy)


def _allow(policy: str, reason: str) -> Decision:
    return Decision(Effect.ALLOW, reason, policy=policy)


def same_project(s: Subject, r: Resource) -> Decision | None:
    if s.project_id != r.project_id:
        return _deny("same_project", "not on this job")
    return None


def grokbot_lane(s: Subject, action: Action) -> Decision | None:
    if s.actor_type is ActorType.GROKBOT and action is not Action.CREATE_RFI_DRAFT:
        return _deny("grokbot_lane", "Grokbot may only create_rfi_draft")
    return None


def on_site(
    s: Subject, action: Action, r: Resource, env: Env, ctx: Any = None
) -> Decision | None:
    if action in {Action.HANDLE_MATERIAL, Action.PIN_DRAFT} and not env.on_site:
        return _deny("on_site", "must be on site")
    return None


def role_allows(
    s: Subject, action: Action, r: Resource, env: Env, ctx: Any = None
) -> Decision | None:
    allowed = ROLE_ACTIONS.get(s.role)
    if allowed is None:
        return _deny("role_allows", "unknown role")
    if action not in allowed:
        return _deny("role_allows", f"{s.role.value} cannot {action.value}")
    return _allow("role_allows", f"{s.role.value} may {action.value}")


def area_scope(s: Subject, r: Resource) -> Decision | None:
    if s.role is Role.GENERAL_FOREMAN:
        return None
    if r.area_id is not None and s.area_id != r.area_id:
        return _deny("area_scope", "outside your area")
    return None


def assigned_only(
    s: Subject, action: Action, r: Resource, env: Env, ctx: Any = None
) -> Decision | None:
    if s.role is not Role.APPRENTICE:
        return None
    if action not in {Action.HANDLE_MATERIAL, Action.FLAG_UP}:
        return None
    if r.assigned_to_id is None or r.assigned_to_id != s.user_id:
        return _deny("assigned_only", "not your ticket")
    return None


def _crew_owns(s: Subject, r: Resource) -> bool:
    if r.crew_foreman_id is not None and r.crew_foreman_id == s.user_id:
        return True
    if r.created_by_id is not None and r.created_by_id == s.user_id:
        return True
    if r.created_by_id is not None and r.created_by_id in s.crew_ids:
        return True
    return False


def chain_owns(
    s: Subject, action: Action, r: Resource, env: Env, ctx: Any = None
) -> Decision | None:
    if s.role is not Role.FOREMAN:
        return None
    if action not in {Action.SUBMIT_RFI, Action.ASSIGN_MATERIAL}:
        return None
    if r.created_by_id is None and r.crew_foreman_id is None:
        return None
    if _crew_owns(s, r):
        return None
    return _deny("chain_owns", "not your crew's draft")


def status_guard(
    s: Subject, action: Action, r: Resource, env: Env, ctx: Any = None
) -> Decision | None:
    if r.status is None:
        return None
    if action is Action.PIN_DRAFT and r.status not in DRAFTISH:
        return _deny("status_guard", "pin_draft is for draftish RFIs only")
    if action is Action.SUBMIT_RFI and r.status not in DRAFTISH:
        return _deny("status_guard", "submit_rfi is for draftish RFIs only")
    if action is Action.VOID_RFI and r.status in {"void", "closed"}:
        return _deny("status_guard", "already closed or void")
    return None


def _as_ctx(ctx: PolicyContext | dict | None) -> PolicyContext:
    if ctx is None:
        return PolicyContext()
    if isinstance(ctx, PolicyContext):
        return ctx
    if isinstance(ctx, dict):
        return PolicyContext(
            allow_demote=bool(ctx.get("allow_demote")),
            priority=ctx.get("priority") or ctx.get("target_priority"),
        )
    return PolicyContext()


def work_stop_writer(
    s: Subject, action: Action, r: Resource, env: Env, ctx: Any = None
) -> Decision | None:
    if action is Action.WORK_STOP:
        return _deny("work_stop_writer", "use set_priority; do not flip work_stopped")
    if action is Action.SET_PRIORITY:
        context = _as_ctx(ctx)
        current_stop = r.work_stopped or r.priority == "work_stopped"
        target = (context.priority or "").strip().lower()
        if current_stop and target and target != "work_stopped" and not context.allow_demote:
            return _deny(
                "work_stop_writer", "demote of work_stopped requires allow_demote"
            )
    return None


def default_deny(
    s: Subject, action: Action, r: Resource, env: Env, ctx: Any = None
) -> Decision | None:
    """Deny-only. Applies only when nothing permitted."""
    return _deny("default_deny", "denied")


class Combining(str, Enum):
    DENY_OVERRIDES = "deny_overrides"
    PERMIT_OVERRIDES = "permit_overrides"
    FIRST_APPLICABLE = "first_applicable"


RuleFn = Callable[..., Decision | None]


@dataclass(frozen=True)
class Policy:
    name: str
    rule: RuleFn
    order: int


@dataclass(frozen=True)
class PolicySet:
    name: str
    combining: Combining
    policies: tuple[Policy, ...]

    def ranked(self) -> tuple[Policy, ...]:
        return tuple(sorted(self.policies, key=lambda p: (p.order, p.name)))


FIELD_POLICY_SET = PolicySet(
    name="field_chain",
    combining=Combining.DENY_OVERRIDES,
    policies=(
        Policy(name="same_project", rule=same_project, order=10),
        Policy(name="grokbot_lane", rule=grokbot_lane, order=20),
        Policy(name="on_site", rule=on_site, order=30),
        Policy(name="role_allows", rule=role_allows, order=40),
        Policy(name="area_scope", rule=area_scope, order=50),
        Policy(name="assigned_only", rule=assigned_only, order=60),
        Policy(name="chain_owns", rule=chain_owns, order=70),
        Policy(name="status_guard", rule=status_guard, order=80),
        Policy(name="work_stop_writer", rule=work_stop_writer, order=90),
        Policy(name="default_deny", rule=default_deny, order=99),
    ),
)
FIELD_CHAIN = FIELD_POLICY_SET


def invoke_rule(
    rule: RuleFn,
    subject: Subject,
    action: Action,
    resource: Resource,
    env: Env,
    ctx: Any = None,
) -> Decision | None:
    params = inspect.signature(rule).parameters
    available = {
        "s": subject,
        "subject": subject,
        "action": action,
        "a": action,
        "r": resource,
        "resource": resource,
        "env": env,
        "e": env,
        "ctx": ctx,
        "c": ctx,
    }
    kwargs = {name: available[name] for name in params if name in available}
    return rule(**kwargs)


def _log(
    subject: Subject,
    action: Action,
    resource: Resource,
    traces: list[EvaluationTrace],
    decision: Decision,
) -> EvaluationLog:
    return EvaluationLog(
        subject_user_id=subject.user_id,
        role=subject.role,
        actor_type=subject.actor_type,
        project_id=subject.project_id,
        action=action,
        resource_type=resource.type,
        traces=tuple(traces),
        decision=decision,
    )


def _trace_effect(decision: Decision | None) -> TraceEffect | None:
    if decision is None:
        return None
    return "allow" if decision.allowed else "deny"


def _step(
    seq: int,
    policy: Policy,
    *,
    applicable: bool,
    decision: Decision | None,
    stopped: bool,
) -> EvaluationTrace:
    return EvaluationTrace(
        seq=seq,
        policy=policy.name,
        order=policy.order,
        applicable=applicable,
        effect=_trace_effect(decision),
        reason=None if decision is None else decision.reason,
        stopped=stopped,
    )


def evaluate(
    subject: Subject,
    action: Action,
    resource: Resource,
    env: Env | None = None,
    ctx: Any = None,
    *,
    policy_set: PolicySet = FIELD_POLICY_SET,
) -> EvaluationLog:
    """DENY_OVERRIDES. Trace is the receipt. Unused steps are n/a, not missing."""
    env = env or Env()
    traces: list[EvaluationTrace] = []
    allow: Decision | None = None
    seq = 0
    for policy in policy_set.ranked():
        seq += 1
        if policy.name == "default_deny" and allow is not None:
            traces.append(
                _step(seq, policy, applicable=False, decision=None, stopped=False)
            )
            continue
        result = invoke_rule(policy.rule, subject, action, resource, env, ctx)
        if result is None:
            traces.append(
                _step(seq, policy, applicable=False, decision=None, stopped=False)
            )
            continue
        if result.effect is Effect.DENY:
            traces.append(
                _step(seq, policy, applicable=True, decision=result, stopped=True)
            )
            return _log(subject, action, resource, traces, result)
        allow = result
        traces.append(
            _step(seq, policy, applicable=True, decision=result, stopped=False)
        )
    if allow is None:
        decision = _deny("default_deny", "denied")
        seq += 1
        traces.append(
            EvaluationTrace(
                seq=seq,
                policy="default_deny",
                order=99,
                applicable=True,
                effect="deny",
                reason="denied",
                stopped=True,
            )
        )
        return _log(subject, action, resource, traces, decision)
    return _log(subject, action, resource, traces, allow)


rfi_abac_deny_total: dict[str, int] = {}
rfi_abac_allow_total: dict[str, int] = {}
_AUDIT: list[EvaluationLog] = []


def _count_deny(policy: str) -> None:
    rfi_abac_deny_total[policy] = rfi_abac_deny_total.get(policy, 0) + 1


def _count_allow(action: Action) -> None:
    rfi_abac_allow_total[action.value] = rfi_abac_allow_total.get(action.value, 0) + 1


def record_audit(log: EvaluationLog) -> None:
    _AUDIT.append(log)


def audit_logs() -> tuple[EvaluationLog, ...]:
    return tuple(_AUDIT)


def check_access(
    subject: Subject,
    action: Action,
    resource: Resource,
    env: Env | None = None,
    ctx: PolicyContext | dict | None = None,
    *,
    policy_set: PolicySet = FIELD_POLICY_SET,
    audit: list[EvaluationTrace] | None = None,
) -> Decision:
    log = evaluate(subject, action, resource, env=env, ctx=ctx, policy_set=policy_set)
    if audit is not None:
        audit.extend(log.traces)
    return log.decision


def require_access(
    subject: Subject,
    action: Action,
    resource: Resource,
    env: Env | None = None,
    ctx: PolicyContext | dict | None = None,
    *,
    policy_set: PolicySet = FIELD_POLICY_SET,
    audit: list[EvaluationTrace] | None = None,
) -> Decision:
    """Fail closed. First deny wins. No implicit allow from a missing role."""
    log = evaluate(subject, action, resource, env=env, ctx=ctx, policy_set=policy_set)
    if audit is not None:
        audit.extend(log.traces)
    if not log.decision.allowed:
        _count_deny(log.decision.policy)
        record_audit(log)
        raise AccessDenied(decision=log.decision, trace=log.traces)
    _count_allow(action)
    if action in {Action.SUBMIT_RFI, Action.SET_PRIORITY}:
        record_audit(log)
    return log.decision


def raise_http(exc: AccessDenied) -> None:
    from fastapi import HTTPException

    raise HTTPException(
        status_code=403,
        detail={"policy": exc.decision.policy, "reason": exc.decision.reason},
    )
