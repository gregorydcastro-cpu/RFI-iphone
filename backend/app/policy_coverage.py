"""Policy-walk coverage bag. Schema + atomic write. Not pytest-cov line merge."""

from __future__ import annotations

import json
from collections import defaultdict
from copy import deepcopy
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from app.abac import AccessDenied, EvaluationLog, EvaluationTrace

CURRENT_SCHEMA = 2
SCHEMA = CURRENT_SCHEMA

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

# default_deny deny/stop is off this bag — tested with bare evaluate.
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


@dataclass
class PolicyCoverageData:
    schema: int = SCHEMA
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    worker: str | None = None
    policy_set: str = "field_lanes"
    combining: str = "deny_overrides"
    hits: dict[str, dict[str, int]] = field(default_factory=dict)
    decisions: dict[str, int] = field(default_factory=dict)
    stops: dict[str, int] = field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_json(cls, raw: dict[str, Any]) -> PolicyCoverageData:
        if raw.get("schema") != SCHEMA:
            raise ValueError(f"unsupported coverage schema {raw.get('schema')}")
        if raw.get("policy_set") != "field_lanes":
            raise ValueError(f"refusing to merge {raw.get('policy_set')}")
        return cls(**{k: raw[k] for k in cls.__dataclass_fields__})


def migrate_v2_to_v3(raw: dict) -> dict:
    out = deepcopy(raw)
    hits = {}
    for name, row in out["hits"].items():
        nxt = dict(row)
        if "stopped" not in nxt and "stop" in nxt:
            nxt["stopped"] = nxt["stop"]
        nxt.setdefault("stopped", 0)
        nxt.pop("stop", None)  # only after copy
        hits[name] = nxt
    out["hits"] = hits
    out["schema"] = 3
    return out


# stay on 2 — v2→v3 (stop→stopped) is not registered yet
MIGRATIONS: dict[int, Callable[[dict], dict]] = {}


def write_coverage(path: Path, data: PolicyCoverageData) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data.to_json(), indent=2, sort_keys=True))
    tmp.replace(path)


def read_coverage(path: Path) -> PolicyCoverageData:
    return PolicyCoverageData.from_json(json.loads(path.read_text()))


def _traces(walk) -> tuple[EvaluationTrace, ...]:
    if isinstance(walk, EvaluationLog):
        return walk.steps
    if isinstance(walk, AccessDenied):
        return walk.trace
    if hasattr(walk, "steps"):
        return walk.steps
    if hasattr(walk, "traces"):
        return walk.traces
    if hasattr(walk, "trace"):
        return walk.trace
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

    def record(self, walk):
        for step in _traces(walk):
            self.seen.add(step.policy)
            if step.stopped:
                self.stops.add(step.policy)
                self.stop_counts[step.policy] += 1
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
        decision = getattr(walk, "decision", None)
        if decision is not None:
            self.decision_counts["allow" if decision.allowed else "deny"] += 1
        return walk


def _hits_to_dict(coverage: PolicyCoverage, worker: str | None = None) -> dict[str, Any]:
    return PolicyCoverageData(
        worker=worker,
        hits={name: dict(counts) for name, counts in coverage.hit_counts.items()},
        decisions=dict(coverage.decision_counts),
        stops=dict(coverage.stop_counts),
    ).to_json()


def _merge_hits(bags: list[dict[str, Any]]) -> PolicyCoverage:
    merged = PolicyCoverage()
    for raw in bags:
        data = PolicyCoverageData.from_json(raw)
        for policy, effects in data.hits.items():
            merged.seen.add(policy)
            for effect, count in effects.items():
                if not count:
                    continue
                merged.hit_counts[policy][effect] += int(count)
                merged.effects[policy].add(effect)
                if effect == "allow":
                    merged.allows.add(policy)
                elif effect == "deny":
                    merged.denies.add(policy)
                else:
                    merged.na.add(policy)
        for policy, count in data.stops.items():
            if count:
                merged.stops.add(policy)
                merged.stop_counts[policy] += int(count)
        for key, count in data.decisions.items():
            merged.decision_counts[key] += int(count)
    return merged


def assert_policy_coverage(coverage: PolicyCoverage) -> None:
    missing = [name for name in FIELD_LANES if name not in coverage.seen]
    assert missing == [], f"policies never walked: {missing}"
    missing_stops = sorted(REQUIRED_STOPS - coverage.stops)
    assert missing_stops == [], f"policies never stopped: {missing_stops}"
    assert "default_deny" not in coverage.allows
    # default_deny deny is off this bag. Line coverage is not assigned_only denied.
