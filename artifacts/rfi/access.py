"""Field ABAC for the runnable package. Deny-overrides. One combining."""

from __future__ import annotations

import inspect
from dataclasses import MISSING, dataclass, field, fields
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Literal, NamedTuple
from uuid import UUID

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
    DRAFT_CHANGE_ORDER = "draft_change_order"
    DRAFT_MATERIAL_ORDER = "draft_material_order"
    ENTER_IMPACT_REVIEW = "enter_impact_review"
    CLOSE_RFI = "close_rfi"
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
    {
        Action.SUBMIT_RFI,
        Action.ASSIGN_MATERIAL,
        Action.ENTER_IMPACT_REVIEW,
        Action.DRAFT_CHANGE_ORDER,
        Action.DRAFT_MATERIAL_ORDER,
    }
)
_AREA_FOREMAN_ACTIONS = _FOREMAN_ACTIONS | frozenset(
    {
        Action.SET_PRIORITY,
        Action.WORK_STOP,
        Action.APPROVE_MATERIAL,
        Action.CLOSE_RFI,
    }
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


@dataclass(frozen=True, kw_only=True)
class Subject:
    user_id: UUID
    company_id: UUID
    project_id: UUID
    role: Role
    actor_type: ActorType
    area_id: UUID | None = None
    reports_to_id: UUID | None = None
    crew_ids: frozenset[UUID] = field(default_factory=frozenset)


def _reject_subject(cls: type) -> None:
    params = getattr(cls, "__dataclass_params__", None)
    if params is None or not params.frozen or not params.kw_only:
        raise TypeError("Subject must be frozen kw_only")
    actor = next(item for item in fields(cls) if item.name == "actor_type")
    if actor.default is not MISSING or actor.default_factory is not MISSING:
        raise TypeError("Subject.actor_type must be required")
    crew = next(item for item in fields(cls) if item.name == "crew_ids")
    if crew.default is not MISSING or crew.default_factory is set:
        raise TypeError("Subject.crew_ids must use field(default_factory=frozenset)")


_reject_subject(Subject)


@dataclass(frozen=True)
class Resource:
    type: str
    project_id: UUID
    area_id: UUID | None = None
    status: str | None = None
    priority: str | None = None
    work_stopped: bool = False
    created_by_id: UUID | None = None
    assigned_to_id: UUID | None = None
    crew_foreman_id: UUID | None = None
    requires_internal_review: bool = False
    id: UUID | None = None


@dataclass(frozen=True, kw_only=True)
class Env:
    now: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    on_site: bool = True
    timezone_name: str = "America/New_York"
    sla_unit: str = "business_days"
    work_stopped_queue: bool = False
    project_id: UUID | None = None
    area_id: UUID | None = None


@dataclass(frozen=True)
class PolicyContext:
    allow_demote: bool = False
    priority: str | None = None


@dataclass(frozen=True)
class Decision:
    effect: Effect
    reason: str
    policy: str

    @property
    def allowed(self) -> bool:
        return self.effect is Effect.ALLOW


@dataclass(frozen=True)
class EvaluationTrace:
    seq: int
    policy: str
    order: int
    applicable: bool
    effect: TraceEffect | None
    reason: str | None
    stopped: bool


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


GROK_TOOLS = frozenset(
    {
        Action.CREATE_RFI_DRAFT,
        Action.DRAFT_CHANGE_ORDER,
        Action.DRAFT_MATERIAL_ORDER,
    }
)


def grokbot_lane(s: Subject, action: Action) -> Decision | None:
    if s.actor_type is ActorType.GROKBOT and action not in GROK_TOOLS:
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
) -> Decision:
    if action not in ROLE_ACTIONS.get(s.role, frozenset()):
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
    if action not in {
        Action.SUBMIT_RFI,
        Action.ASSIGN_MATERIAL,
        Action.ENTER_IMPACT_REVIEW,
        Action.DRAFT_CHANGE_ORDER,
        Action.DRAFT_MATERIAL_ORDER,
    }:
        return None
    if r.created_by_id is None and r.crew_foreman_id is None:
        return None
    if _crew_owns(s, r):
        return None
    return _deny("chain_owns", "not your crew's ticket")


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
    if action is Action.ENTER_IMPACT_REVIEW and r.status != "answered":
        return _deny("status_guard", "enter_impact_review is for answered RFIs only")
    if action in {Action.DRAFT_CHANGE_ORDER, Action.DRAFT_MATERIAL_ORDER} and r.status not in {
        "answered",
        "impact_review",
    }:
        return _deny(
            "status_guard",
            "draft_change_order / draft_material_order only while impact_review",
        )
    if action is Action.CLOSE_RFI and r.status != "impact_review":
        return _deny("status_guard", "close_rfi is for impact_review only")
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


DEFAULT_DENY_REASON = "set incomplete, not a field overstep"


def default_deny(
    s: Subject, action: Action, r: Resource, env: Env, ctx: Any = None
) -> Decision:
    return _deny("default_deny", DEFAULT_DENY_REASON)


class Combining(str, Enum):
    DENY_OVERRIDES = "deny_overrides"


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
    ),
)
FIELD_LANES = tuple(p.name for p in FIELD_POLICY_SET.ranked())
EXPECTED_ORDER = FIELD_LANES + ("default_deny",)
FIELD_SET_NAMES = frozenset(FIELD_LANES)
if FIELD_POLICY_SET.combining is not Combining.DENY_OVERRIDES:
    raise TypeError("FIELD_POLICY_SET combining is deny_overrides")
if "default_deny" in FIELD_SET_NAMES:
    raise TypeError("default_deny is not a FIELD_POLICY_SET member")


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


class Evaluation(NamedTuple):
    decision: Decision
    steps: tuple[EvaluationTrace, ...]


def evaluate(
    subject: Subject,
    action: Action,
    resource: Resource,
    env: Env | None = None,
    ctx: Any = None,
    *,
    policy_set: PolicySet = FIELD_POLICY_SET,
) -> Evaluation:
    """walk ranked policies; DENY returns; ALLOW is remembered; else default_deny."""
    env = env or Env()
    traces: list[EvaluationTrace] = []
    allow: Decision | None = None
    for seq, policy in enumerate(policy_set.ranked(), start=1):
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
            return Evaluation(result, tuple(traces))
        if allow is not None:
            raise TypeError("evaluate does not invent a second allow")
        allow = result
        traces.append(
            _step(seq, policy, applicable=True, decision=result, stopped=False)
        )
    if allow is not None:
        traces.append(
            _step(
                len(traces) + 1,
                Policy(name="default_deny", rule=default_deny, order=99),
                applicable=False,
                decision=None,
                stopped=False,
            )
        )
        return Evaluation(allow, tuple(traces))
    result = invoke_rule(default_deny, subject, action, resource, env, ctx)
    if result is None or result.effect is not Effect.DENY:
        result = _deny("default_deny", DEFAULT_DENY_REASON)
    traces.append(
        _step(
            len(traces) + 1,
            Policy(name="default_deny", rule=default_deny, order=99),
            applicable=True,
            decision=result,
            stopped=True,
        )
    )
    return Evaluation(result, tuple(traces))


def require_access(
    subject: Subject,
    action: Action,
    resource: Resource,
    env: Env | None = None,
    ctx: PolicyContext | dict | None = None,
    *,
    policy_set: PolicySet = FIELD_POLICY_SET,
) -> Decision:
    """Wraps the three writes. First deny wins."""
    decision, steps = evaluate(
        subject, action, resource, env=env, ctx=ctx, policy_set=policy_set
    )
    if not decision.allowed:
        raise AccessDenied(decision=decision, trace=steps)
    return decision
