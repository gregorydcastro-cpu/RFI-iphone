"""Coverage file schema walker. Strategy A only. Not Grafana.

Monotonic integer. migrate_vN_to_vN+1. Writer dumps CURRENT_SCHEMA only.
No semver, date schemas, dual-write, or down-migrations.
Additive field → bump + setdefault. Rename → bump, copy old→new.
Counter meaning change → bump, do not reuse stop.
New policy name under hits is data, not a bump.
New policy_set value is reject on read, not a bump.
Keep every step from 1. file>code refuse. file<code migrate then merge.
Every step: n→n+1; already-n+1→n+1 same counts; no input mutation;
result schema is exactly n+1. Walker rejects in-place and landing != src+1.
migrate = normalize ∘ step_k ∘ … ∘ step_1. Do not use normalize as a missing step.
Planned ladder, NOT shipped: v2 stop; v3 stopped (copy if missing);
v4 stop removed from dataclass (already popped in v3). CURRENT_SCHEMA stays 2.
"""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

CURRENT_SCHEMA = 2
SCHEMA = CURRENT_SCHEMA
COVERAGE_FILE_FORBIDDEN = frozenset(
    {
        "subject",
        "subject_id",
        "user_id",
        "rfi",
        "rfi_id",
        "question",
        "trace",
        "traces",
        "steps",
    }
)


class CoverageSchemaError(ValueError):
    """Schema walker failed. Not an ABAC deny."""


def _copy(raw: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise CoverageSchemaError("coverage file must be an object")
    return deepcopy(raw)


def _as_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    if isinstance(value, bool) or not isinstance(value, int):
        raise CoverageSchemaError(f"expected int, got {type(value).__name__}")
    return value


def _require(raw: dict[str, Any], key: str) -> dict[str, Any]:
    value = raw.get(key)
    if not isinstance(value, dict):
        raise CoverageSchemaError(f"{key} required object")
    return value


def _ensure_hit_row(row: Any) -> dict[str, int]:
    """Current v2. Do not add deny onto an existing stop."""
    if not isinstance(row, dict):
        raise CoverageSchemaError("hit row must be an object")
    out = dict(row)
    for key in ("seen", "applicable", "allow", "deny"):
        out[key] = _as_int(out[key], default=0) if key in out else 0
    if "stop" not in row:
        out["stop"] = out.get("deny", 0)
    else:
        out["stop"] = _as_int(out["stop"], default=0)
    out.setdefault("skipped_after_stop", 0)
    out["skipped_after_stop"] = _as_int(out["skipped_after_stop"], default=0)
    return out


def _normalize_current(raw: dict[str, Any]) -> dict[str, Any]:
    """Fill missing current-schema keys. Never bump. Never a missing step."""
    out = _copy(raw)
    if out.get("schema") != CURRENT_SCHEMA:
        raise CoverageSchemaError("normalize is current-schema only")
    out.setdefault("combining", "deny_overrides")
    out.setdefault("policy_set", "field_lanes")
    out.setdefault("worker", None)
    out.setdefault("decisions", {})
    out.setdefault("stops", {})
    hits = _require(out, "hits")
    out["hits"] = {name: _ensure_hit_row(row) for name, row in hits.items()}
    return out


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
        raw = migrate(raw)
        if raw.get("policy_set") != "field_lanes":
            raise ValueError(f"refusing to merge policy_set {raw.get('policy_set')}")
        leaked = COVERAGE_FILE_FORBIDDEN & raw.keys()
        if leaked:
            raise ValueError(f"coverage file must not include {sorted(leaked)}")
        return cls(**{k: raw[k] for k in cls.__dataclass_fields__ if k in raw})


def migrate_v1_to_v2(raw: dict) -> dict:
    """Fill-holes. schema is exactly 2. Never schema += 1. Never += counts."""
    out = _copy(raw)
    out["schema"] = 2
    out.setdefault("combining", "deny_overrides")
    out.setdefault("policy_set", "field_lanes")
    out.setdefault("worker", None)
    out.setdefault("decisions", {})
    out.setdefault("stops", {})
    hits = _require(out, "hits")
    out["hits"] = {name: _ensure_hit_row(row) for name, row in hits.items()}
    return out


def migrate_v2_to_v3(raw: dict) -> dict:
    """Planned later. Not shipped. Fill-holes rename stop→stopped."""
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


# Planned ladder, NOT shipped. CURRENT_SCHEMA stays 2.
# v2: stop (fill from deny if missing; do not add deny onto existing stop)
# v3: stopped (copy stop→stopped if missing; pop stop) — migrate_v2_to_v3 exists, unregistered
# v4: stop removed from dataclass (already popped in v3)
MIGRATIONS: dict[int, Callable[[dict], dict]] = {
    1: migrate_v1_to_v2,
}

if type(CURRENT_SCHEMA) is not int or CURRENT_SCHEMA < 1:
    raise TypeError("CURRENT_SCHEMA is a monotonic integer")
if set(MIGRATIONS) != set(range(1, CURRENT_SCHEMA)):
    raise TypeError("keep every migrate_vN_to_vN+1 step from 1")
for _n, _step in MIGRATIONS.items():
    if getattr(_step, "__name__", "") != f"migrate_v{_n}_to_v{_n + 1}":
        raise TypeError("steps are migrate_vN_to_vN+1")


def migrate(raw: Any) -> dict[str, Any]:
    """normalize ∘ step_k ∘ … ∘ step_1. Do not use normalize as a missing step."""
    out = _copy(raw)
    schema = out.get("schema", None)
    if schema is None or type(schema) is not int:
        raise CoverageSchemaError("invalid schema")
    if schema > CURRENT_SCHEMA:
        raise CoverageSchemaError("newer than code; upgrade the test runner")
    while schema < CURRENT_SCHEMA:
        step = MIGRATIONS.get(schema)
        if step is None:
            raise CoverageSchemaError(f"missing migration step {schema}")
        before = deepcopy(out)
        nxt = step(out)
        if nxt is out or out != before:
            raise CoverageSchemaError("migration step must not mutate input in place")
        if not isinstance(nxt, dict) or nxt.get("schema") != schema + 1:
            raise CoverageSchemaError(f"migration step {schema} must land on schema+1")
        out = nxt
        schema = out["schema"]
    return _normalize_current(out)


def write_coverage(path: Path, data: PolicyCoverageData) -> None:
    if data.schema != CURRENT_SCHEMA:
        raise CoverageSchemaError(
            f"refusing to write non-current schema {data.schema}, "
            f"current is {CURRENT_SCHEMA}"
        )
    if data.policy_set != "field_lanes":
        raise CoverageSchemaError(
            f"refusing to write policy_set {data.policy_set} as field_lanes"
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data.to_json(), indent=2, sort_keys=True))
    tmp.replace(path)


def read_coverage(path: Path) -> PolicyCoverageData:
    return PolicyCoverageData.from_json(json.loads(path.read_text()))


def load_parts(paths: list[Path]) -> list[PolicyCoverageData]:
    return [read_coverage(p) for p in paths]  # each is schema 2


def merge_coverage(
    bags: list[PolicyCoverageData] | list[dict[str, Any]],
) -> PolicyCoverageData:
    """Add ints only. Never average or max. Empty hits merge as zeros."""
    if not bags:
        return PolicyCoverageData(hits={}, decisions={}, stops={})
    raws = [
        bag.to_json() if isinstance(bag, PolicyCoverageData) else bag for bag in bags
    ]
    loaded = [migrate(bag) for bag in raws]
    policy_set = loaded[0].get("policy_set", "field_lanes")
    combining = loaded[0].get("combining", "deny_overrides")
    for bag in loaded[1:]:
        if bag.get("policy_set", "field_lanes") != policy_set:
            raise ValueError(f"incompatible policy_set: {bag.get('policy_set')}")
        if bag.get("combining", "deny_overrides") != combining:
            raise ValueError(f"incompatible combining: {bag.get('combining')}")
    hits: dict[str, dict[str, int]] = {}
    decisions: dict[str, int] = {}
    stops: dict[str, int] = {}
    for bag in loaded:
        for name, row in (bag.get("hits") or {}).items():
            dest = hits.setdefault(name, {})
            for key, value in (row or {}).items():
                dest[key] = dest.get(key, 0) + int(value)
        for key, value in (bag.get("decisions") or {}).items():
            decisions[key] = decisions.get(key, 0) + int(value)
        for key, value in (bag.get("stops") or {}).items():
            stops[key] = stops.get(key, 0) + int(value)
    return PolicyCoverageData(
        policy_set=policy_set,
        combining=combining,
        hits=hits,
        decisions=decisions,
        stops=stops,
    )


def merge_after_migrate(paths: list[Path]) -> PolicyCoverageData:
    return merge_coverage(load_parts(paths))
