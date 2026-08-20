"""Coverage file schema and merge. Not pytest-cov line counts."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import fields
from pathlib import Path

import pytest

from app.policy_coverage import (
    CURRENT_SCHEMA,
    MIGRATIONS,
    REQUIRED_STOPS,
    SCHEMA,
    PolicyCoverage,
    PolicyCoverageData,
    _hits_to_dict,
    _merge_hits,
    assert_policy_coverage,
    migrate_v2_to_v3,
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
    assert first.schema == CURRENT_SCHEMA == 2
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


def test_migrate_v2_to_v3_is_not_registered():
    assert CURRENT_SCHEMA == 2
    assert 2 not in MIGRATIONS
    assert migrate_v2_to_v3 not in MIGRATIONS.values()


def test_migrate_v2_to_v3_is_n_to_n_plus_one_and_does_not_mutate():
    raw = {
        "schema": 2,
        "hits": {
            "same_project": {"deny": 2, "stop": 2},
            "role_allows": {"allow": 1},
        },
        "decisions": {"deny": 2},
        "stops": {"same_project": 2},
    }
    snapshot = deepcopy(raw)
    out = migrate_v2_to_v3(raw)
    assert raw == snapshot
    assert out["schema"] == raw["schema"] + 1 == 3
    assert out["hits"]["same_project"]["stopped"] == 2
    assert out["hits"]["same_project"]["deny"] == 2
    assert "stop" not in out["hits"]["same_project"]
    assert out["hits"]["role_allows"]["stopped"] == 0
    assert out["hits"]["role_allows"]["allow"] == 1
    assert "stop" not in out["hits"]["role_allows"]
    assert raw["hits"]["same_project"]["stop"] == 2


def test_migrate_v2_to_v3_already_v3_keeps_counts():
    raw = {
        "schema": 3,
        "hits": {"same_project": {"deny": 4, "stopped": 4, "n/a": 1}},
        "decisions": {"deny": 4},
        "stops": {"same_project": 4},
    }
    snapshot = deepcopy(raw)
    out = migrate_v2_to_v3(raw)
    assert raw == snapshot
    assert out["schema"] == 3
    assert out["hits"]["same_project"]["stopped"] == 4
    assert out["hits"]["same_project"]["deny"] == 4
    assert out["hits"]["same_project"]["n/a"] == 1
    assert "stop" not in out["hits"]["same_project"]
