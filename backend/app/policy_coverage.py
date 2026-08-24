"""Policy-walk coverage bag. Schema lives in coverage_schema. Not pytest-cov."""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Any

from app.abac import FIELD_POLICY_SET, AccessDenied, EvaluationLog, EvaluationTrace
from app.coverage_schema import (
    COVERAGE_FILE_FORBIDDEN,
    CURRENT_SCHEMA,
    SCHEMA,
    CoverageSchemaError,
    MIGRATIONS,
    PolicyCoverageData,
    load_parts,
    merge_after_migrate,
    merge_coverage,
    migrate,
    migrate_v1_to_v2,
    migrate_v2_to_v3,
    read_coverage,
    write_coverage,
)

COV_DIR = Path(__file__).resolve().parents[2] / ".rfi-cov"

FIELD_LANES = (
    "same_project",
    "grokbot_lane",
    "on_site",
    "role_allows",
    "area_scope",
    "assigned_only",
    "chain_owns",
    "status_guard",
    "work_stop_writer",
)
EXPECTED_ORDER = FIELD_LANES + ("default_deny",)

# default_deny deny/stop is off this bag. The only honest hit is
# test_default_deny_on_permitless_set. Do not require a default_deny hit.
REQUIRED_STOPS = {
    "same_project",
    "grokbot_lane",
    "on_site",
    "role_allows",
    "area_scope",
    "assigned_only",
    "chain_owns",
    "status_guard",
    "work_stop_writer",
}
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


def dump_from_bag(
    coverage: PolicyCoverage, path: Path, worker: str | None = None
) -> None:
    write_coverage(path, PolicyCoverageData.from_json(_hits_to_dict(coverage, worker=worker)))


def coverage_from_data(data: PolicyCoverageData) -> PolicyCoverage:
    coverage = PolicyCoverage()
    for policy, effects in data.hits.items():
        coverage.seen.add(policy)
        for effect, count in effects.items():
            coverage.hit_counts[policy][effect] += int(count)
            if effect == "allow":
                coverage.allows.add(policy)
                coverage.effects[policy].add("allow")
            elif effect == "deny":
                coverage.denies.add(policy)
                coverage.effects[policy].add("deny")
            elif effect == "n/a":
                coverage.na.add(policy)
                coverage.effects[policy].add("n/a")
    for policy, count in data.stops.items():
        if count:
            coverage.stops.add(policy)
            coverage.stop_counts[policy] += int(count)
    for key, count in data.decisions.items():
        coverage.decision_counts[key] += int(count)
    return coverage


def _traces(walk) -> tuple[EvaluationTrace, ...]:
    if isinstance(walk, EvaluationLog):
        return walk.steps
    if isinstance(walk, AccessDenied):
        return walk.trace
    steps = getattr(walk, "steps", None)
    if steps is not None and not callable(steps):
        return tuple(steps)
    if hasattr(walk, "traces"):
        return walk.traces
    if hasattr(walk, "trace") and not isinstance(walk, tuple):
        return walk.trace
    if isinstance(walk, tuple) and len(walk) == 2:
        maybe = walk[1]
        if isinstance(maybe, (list, tuple)) and (
            len(maybe) == 0 or hasattr(maybe[0], "policy")
        ):
            return tuple(maybe)
    return tuple(walk)


class PolicyCoverage:
    """Receipt of which policies this module actually walked."""

    def __init__(self) -> None:
        self.seen: set[str] = set()
        self.stops: set[str] = set()
        self.allows: set[str] = set()
        self.denies: set[str] = set()
        self.na: set[str] = set()
        self.effects: dict[str, set[str]] = defaultdict(set)
        self.hit_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self.stop_counts: dict[str, int] = defaultdict(int)
        self.decision_counts: dict[str, int] = defaultdict(int)
        self._sealed = False

    def seal(self) -> None:
        """Teardown may format/assert. It must not record or evaluate."""
        self._sealed = True

    def record(self, walk):
        if self._sealed:
            raise RuntimeError("do not record after yield")
        stopped_at: str | None = None
        for step in _traces(walk):
            if step.policy == "default_deny":
                continue
            self.seen.add(step.policy)
            if step.stopped:
                self.stops.add(step.policy)
                self.stop_counts[step.policy] += 1
                stopped_at = step.policy
            if not step.applicable or step.effect is None:
                self.na.add(step.policy)
                self.effects[step.policy].add("n/a")
                self.hit_counts[step.policy]["n/a"] += 1
                continue
            if step.effect == "allow":
                self.allows.add(step.policy)
                self.effects[step.policy].add("allow")
                self.hit_counts[step.policy]["allow"] += 1
            else:
                self.denies.add(step.policy)
                self.effects[step.policy].add("deny")
                self.hit_counts[step.policy]["deny"] += 1
        if stopped_at is not None:
            after = False
            for policy in FIELD_POLICY_SET.ranked():
                if policy.name == stopped_at:
                    after = True
                    continue
                if after:
                    self.hit_counts[policy.name]["skipped_after_stop"] += 1
        decision = getattr(walk, "decision", None)
        if decision is not None:
            self.decision_counts["allow" if decision.allowed else "deny"] += 1
        return walk

    def evaluate(self, *args, **kwargs):
        """Drop-in for evaluate(); same return, recorded for coverage."""
        if self._sealed:
            raise RuntimeError("do not evaluate after yield")
        from tests.conftest import evaluate as walk_evaluate

        return self.record(walk_evaluate(*args, **kwargs))

    def report(self) -> "PolicyCoverageReport":
        return PolicyCoverageReport(self)

    def format(self) -> str:
        lines = ["combining=deny_overrides"]
        width = max((len(name) for name in FIELD_LANES), default=20)
        for name in FIELD_LANES:
            counts = self.hit_counts[name]
            lines.append(
                f"{name:<{width}}  allow={counts.get('allow', 0)}  "
                f"deny={counts.get('deny', 0)}  n/a={counts.get('n/a', 0)}  "
                f"skipped_after_stop={counts.get('skipped_after_stop', 0)}"
            )
        return "\n".join(lines)


class PolicyCoverageReport:
    """Read-only view used by module teardown. Not the JSON dump."""

    def __init__(self, coverage: PolicyCoverage) -> None:
        self._coverage = coverage

    def never_applicable(self) -> list[str]:
        return [
            name
            for name in FIELD_LANES
            if self._coverage.hit_counts[name].get("allow", 0)
            + self._coverage.hit_counts[name].get("deny", 0)
            == 0
        ]


def _hits_to_dict(coverage: PolicyCoverage, worker: str | None = None) -> dict[str, Any]:
    return PolicyCoverageData(
        worker=worker,
        hits={name: dict(counts) for name, counts in coverage.hit_counts.items()},
        decisions=dict(coverage.decision_counts),
        stops=dict(coverage.stop_counts),
    ).to_json()


def _merge_hits(bags: list[dict[str, Any]]) -> PolicyCoverage:
    return coverage_from_data(merge_coverage(bags))


def absorb_hits(dst: PolicyCoverage, src: PolicyCoverage) -> None:
    """Merge src counts into dst. Not evaluate. Not a walk."""
    merged = _merge_hits([_hits_to_dict(dst), _hits_to_dict(src)])
    dst.seen = set(merged.seen)
    dst.stops = set(merged.stops)
    dst.allows = set(merged.allows)
    dst.denies = set(merged.denies)
    dst.na = set(merged.na)
    dst.effects = merged.effects
    dst.hit_counts = merged.hit_counts
    dst.stop_counts = merged.stop_counts
    dst.decision_counts = merged.decision_counts


def assert_policy_coverage(coverage: PolicyCoverage) -> None:
    receipt = coverage.format()
    leaked = [
        name for name in DENY_ONLY if coverage.hit_counts[name].get("allow", 0) > 0
    ]
    assert leaked == [], f"DENY_ONLY leaked allow: {leaked}\n{receipt}"
    assert "default_deny" not in REQUIRED_STOPS
    assert "default_deny" not in FIELD_LANES
    assert "default_deny" not in coverage.allows
    if not coverage.seen:
        raise AssertionError(f"never_applicable: {list(FIELD_LANES)}\n{receipt}")
    if not set(FIELD_LANES) <= coverage.seen:
        return
    never_applied = [
        name
        for name in coverage.seen
        if name in FIELD_LANES
        and coverage.hit_counts[name].get("allow", 0)
        + coverage.hit_counts[name].get("deny", 0)
        == 0
    ]
    assert never_applied == [], f"never applied: {never_applied}\n{receipt}"
    missing_stops = sorted(REQUIRED_STOPS - coverage.stops)
    assert missing_stops == [], f"policies never stopped: {missing_stops}\n{receipt}"
    never_app = [
        name
        for name in FIELD_LANES
        if coverage.hit_counts[name].get("allow", 0)
        + coverage.hit_counts[name].get("deny", 0)
        == 0
    ]
    assert never_app == [], f"never_applicable: {never_app}\n{receipt}"
    deny_zero = [
        name for name in DENY_ONLY if coverage.hit_counts[name].get("deny", 0) == 0
    ]
    assert deny_zero == [], f"DENY_ONLY deny==0: {deny_zero}\n{receipt}"
    if coverage.hit_counts["role_allows"].get("allow", 0) == 0:
        raise AssertionError(f"role_allows allow==0\n{receipt}")
    if coverage.hit_counts["role_allows"].get("deny", 0) == 0:
        raise AssertionError(f"role_allows deny==0\n{receipt}")
    # skipped_after_stop is expected. Do not require a default_deny hit.
