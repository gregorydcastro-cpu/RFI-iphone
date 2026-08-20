"""Policy-walk coverage next to the gold tests. Not line coverage. Not Grafana."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from app.abac import FIELD_POLICY_SET, evaluate as _evaluate
from app.policy_coverage import FIELD_LANES, _traces

DENY_ONLY = (
    "same_project",
    "grokbot_lane",
    "on_site",
    "area_scope",
    "assigned_only",
    "chain_owns",
    "status_guard",
    "work_stop_writer",
)
ALLOW_POLICIES = ("role_allows",)
COVERED = DENY_ONLY + ALLOW_POLICIES


@dataclass
class PolicyHits:
    seen: int = 0
    applicable: int = 0
    allow: int = 0
    deny: int = 0
    stop: int = 0
    skipped_after_stop: int = 0


@dataclass
class PolicyCoverage:
    """Test-side walk bag. skipped_after_stop high on later policies is expected."""

    combining: str = "deny_overrides"
    hits: dict[str, PolicyHits] = field(
        default_factory=lambda: {name: PolicyHits() for name in COVERED}
    )
    decisions: Counter[str] = field(default_factory=Counter)
    stop_policies: Counter[str] = field(default_factory=Counter)

    def evaluate(self, *args, **kwargs):
        walk = _evaluate(*args, **kwargs)
        self.record(walk)
        return walk

    def record(self, walk):
        steps = list(_traces(walk))
        stopped_at: str | None = None
        for step in steps:
            hit = self.hits.setdefault(step.policy, PolicyHits())
            hit.seen += 1
            if step.applicable:
                hit.applicable += 1
            if step.effect == "allow":
                hit.allow += 1
            if step.effect == "deny":
                hit.deny += 1
            if step.stopped or step.effect == "deny":
                hit.stop += 1
                stopped_at = step.policy
                self.stop_policies[step.policy] += 1
        decision = getattr(walk, "decision", None)
        if decision is not None:
            self.decisions["allow" if decision.allowed else "deny"] += 1
        if stopped_at is not None:
            after = False
            for policy in FIELD_POLICY_SET.ranked():
                if policy.name == stopped_at:
                    after = True
                    continue
                if after:
                    self.hits.setdefault(policy.name, PolicyHits()).skipped_after_stop += 1
        return walk

    def never_seen(self) -> list[str]:
        # Short-circuit unread names increment skipped_after_stop, not never_seen.
        return [
            name
            for name in COVERED
            if self.hits[name].seen == 0 and self.hits[name].skipped_after_stop == 0
        ]

    def never_applicable(self) -> list[str]:
        return [name for name in COVERED if self.hits[name].applicable == 0]

    def deny_only_never_denied(self) -> list[str]:
        return [name for name in DENY_ONLY if self.hits[name].deny == 0]

    def permit_never_allowed(self) -> list[str]:
        return [name for name in ALLOW_POLICIES if self.hits[name].allow == 0]

    def permit_never_denied(self) -> list[str]:
        return [name for name in ALLOW_POLICIES if self.hits[name].deny == 0]

    def deny_only_leaked_allow(self) -> list[str]:
        return [name for name in DENY_ONLY if self.hits[name].allow > 0]

    @property
    def dead_rules(self) -> list[str]:
        return sorted(
            name
            for name, hit in self.hits.items()
            if hit.seen > 0 and hit.applicable == 0
        )

    def format(self) -> str:
        lines = [f"combining={self.combining}"]
        width = max((len(name) for name in self.hits), default=20)
        for name, hit in self.hits.items():
            lines.append(
                f"{name:<{width}}  seen={hit.seen}  applicable={hit.applicable}  "
                f"allow={hit.allow}  deny={hit.deny}  stop={hit.stop}  "
                f"skipped_after_stop={hit.skipped_after_stop}"
            )
        if self.dead_rules:
            lines.append(f"dead_rules={self.dead_rules}")
        return "\n".join(lines)


def assert_policy_coverage(c: PolicyCoverage) -> None:
    holes = []
    if c.never_seen():
        holes.append(f"never_seen: {c.never_seen()}")
    if c.never_applicable():
        holes.append(f"never_applicable: {c.never_applicable()}")
    if c.deny_only_never_denied():
        holes.append(f"deny-only never denied: {c.deny_only_never_denied()}")
    if c.permit_never_allowed():
        holes.append(f"permit never allowed: {c.permit_never_allowed()}")
    if c.permit_never_denied():
        holes.append(f"permit never denied: {c.permit_never_denied()}")
    if c.deny_only_leaked_allow():
        holes.append(f"deny-only leaked allow: {c.deny_only_leaked_allow()}")
    if holes:
        raise AssertionError("\n".join(holes) + "\n" + c.format())
    if set(COVERED) != set(FIELD_LANES):
        raise AssertionError(
            f"coverage names drifted from field lanes: {set(COVERED) ^ set(FIELD_LANES)}\n"
            + c.format()
        )
