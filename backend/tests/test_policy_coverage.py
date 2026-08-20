"""Coverage file schema and merge. Not pytest-cov line counts."""

from __future__ import annotations

from dataclasses import fields
from pathlib import Path

import pytest

from app.policy_coverage import (
    REQUIRED_STOPS,
    SCHEMA,
    PolicyCoverage,
    PolicyCoverageData,
    _hits_to_dict,
    _merge_hits,
    assert_policy_coverage,
    read_coverage,
    write_coverage,
)


def test_created_at_uses_default_factory():
    created = next(item for item in fields(PolicyCoverageData) if item.name == "created_at")
    assert created.default_factory is not None
    first = PolicyCoverageData()
    second = PolicyCoverageData()
    assert first.created_at
    assert second.created_at
    assert first.schema == SCHEMA
    assert first.policy_set == "field_lanes"


def test_write_coverage_is_atomic(tmp_path: Path):
    path = tmp_path / "rfi-cov-gw0.json"
    data = PolicyCoverageData(worker="gw0", stops={"assigned_only": 1})
    write_coverage(path, data)
    assert path.exists()
    assert not path.with_suffix(".tmp").exists()
    loaded = read_coverage(path)
    assert loaded.worker == "gw0"
    assert loaded.stops == {"assigned_only": 1}
    assert loaded.schema == SCHEMA


def test_refuse_schema_mismatch(tmp_path: Path):
    raw = PolicyCoverageData().to_json()
    raw["schema"] = 99
    with pytest.raises(ValueError, match="unsupported coverage schema"):
        PolicyCoverageData.from_json(raw)


def test_refuse_policy_set_mismatch():
    raw = PolicyCoverageData().to_json()
    raw["policy_set"] = "empty"
    with pytest.raises(ValueError, match="refusing to merge"):
        PolicyCoverageData.from_json(raw)


def test_merge_hits_unions_worker_bags():
    left = PolicyCoverage()
    left.seen.add("same_project")
    left.stops.add("same_project")
    left.denies.add("same_project")
    left.effects["same_project"].add("deny")
    left.hit_counts["same_project"]["deny"] = 1
    left.stop_counts["same_project"] = 1
    left.decision_counts["deny"] = 1

    right = PolicyCoverage()
    right.seen.update({"assigned_only", "default_deny"})
    right.stops.add("assigned_only")
    right.denies.add("assigned_only")
    right.na.add("default_deny")
    right.effects["assigned_only"].add("deny")
    right.effects["default_deny"].add("n/a")
    right.hit_counts["assigned_only"]["deny"] = 2
    right.hit_counts["default_deny"]["n/a"] = 1
    right.stop_counts["assigned_only"] = 2
    right.decision_counts["deny"] = 2

    merged = _merge_hits([_hits_to_dict(left, worker="gw0"), _hits_to_dict(right, worker="gw1")])
    assert merged.stops == {"same_project", "assigned_only"}
    assert merged.hit_counts["assigned_only"]["deny"] == 2
    assert merged.na == {"default_deny"}
    assert "assigned_only" in merged.denies


def test_default_deny_stop_is_off_the_production_bag():
    assert "default_deny" not in REQUIRED_STOPS
    coverage = PolicyCoverage()
    coverage.seen.update(REQUIRED_STOPS | {"default_deny"})
    coverage.stops.update(REQUIRED_STOPS)
    coverage.na.add("default_deny")
    assert_policy_coverage(coverage)


def test_line_coverage_is_not_assigned_only_denied():
    coverage = PolicyCoverage()
    coverage.seen.update(REQUIRED_STOPS | {"default_deny"})
    coverage.stops.update(REQUIRED_STOPS - {"assigned_only"})
    coverage.na.add("default_deny")
    with pytest.raises(AssertionError, match="assigned_only"):
        assert_policy_coverage(coverage)
