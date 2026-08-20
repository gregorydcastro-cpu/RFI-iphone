"""Coverage schema walker. Not policy-stop tests. Do not request cov."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

import pytest

from coverage_schema import (
    CURRENT_SCHEMA,
    CoverageSchemaError,
    PolicyCoverageData,
    merge_coverage,
    migrate,
    read_coverage,
    write_coverage,
)

V1 = {
    "schema": 1,
    "policy_set": "field_lanes",
    "hits": {
        "same_project": {"seen": 1, "applicable": 1, "allow": 0, "deny": 1},
        "role_allows": {"seen": 2, "applicable": 2, "allow": 1, "deny": 1},
    },
}

V2 = {
    "schema": 2,
    "policy_set": "field_lanes",
    "combining": "deny_overrides",
    "hits": {
        "same_project": {
            "seen": 1,
            "applicable": 1,
            "allow": 0,
            "deny": 1,
            "stop": 1,
            "skipped_after_stop": 0,
        },
        "role_allows": {
            "seen": 2,
            "applicable": 2,
            "allow": 1,
            "deny": 1,
            "stop": 1,
            "skipped_after_stop": 1,
        },
    },
    "decisions": {},
    "stops": {},
}


def test_v1_loads_as_current() -> None:
    out = PolicyCoverageData.from_json(V1)
    assert out.schema == CURRENT_SCHEMA
    assert out.hits["same_project"]["stop"] == 1
    assert out.hits["same_project"]["skipped_after_stop"] == 0
    assert out.hits["role_allows"]["stop"] == 1
    assert out.hits["role_allows"]["skipped_after_stop"] == 0
    assert out.decisions == {}
    assert out.stops == {}


def test_v1_counts_not_inflated() -> None:
    out = migrate(V1)
    assert out["hits"]["same_project"]["seen"] == 1
    assert out["hits"]["same_project"]["applicable"] == 1
    assert out["hits"]["same_project"]["allow"] == 0
    assert out["hits"]["same_project"]["deny"] == 1
    assert out["hits"]["role_allows"]["seen"] == 2
    assert out["hits"]["role_allows"]["applicable"] == 2
    assert out["hits"]["role_allows"]["allow"] == 1
    assert out["hits"]["role_allows"]["deny"] == 1


def test_v1_input_not_mutated() -> None:
    raw = deepcopy(V1)
    snapshot = deepcopy(raw)
    migrate(raw)
    assert raw == snapshot


def test_v2_round_trip_identity(tmp_path: Path) -> None:
    path = tmp_path / "gw0.json"
    data = PolicyCoverageData.from_json(deepcopy(V2))
    write_coverage(path, data)
    loaded = read_coverage(path)
    assert loaded.to_json() == data.to_json()


def test_migrate_current_is_idempotent() -> None:
    assert migrate(V2) == migrate(migrate(V2))


def test_v1_then_normalize_is_stable() -> None:
    assert migrate(migrate(V1)) == migrate(V1)


def test_merge_v1_worker_with_v2_worker() -> None:
    merged = merge_coverage([deepcopy(V1), deepcopy(V2)])
    assert merged.hits["same_project"]["deny"] == 2
    assert merged.hits["role_allows"]["allow"] == 2
    assert merged.hits["role_allows"]["skipped_after_stop"] == 1


def test_read_v1_file(tmp_path: Path) -> None:
    path = tmp_path / "gw0.json"
    path.write_text(json.dumps(V1))
    loaded = read_coverage(path)
    assert loaded.schema == CURRENT_SCHEMA
    assert loaded.hits["same_project"]["stop"] == 1
    assert loaded.hits["same_project"]["skipped_after_stop"] == 0


def test_future_schema_file_rejected(tmp_path: Path) -> None:
    path = tmp_path / "gw0.json"
    path.write_text(json.dumps({"schema": CURRENT_SCHEMA + 1, "hits": {}}))
    with pytest.raises(CoverageSchemaError, match="newer than code"):
        read_coverage(path)


def test_unknown_policy_set_rejected() -> None:
    raw = deepcopy(V1)
    raw["policy_set"] = "empty"
    with pytest.raises(ValueError, match="policy_set"):
        PolicyCoverageData.from_json(raw)


def test_missing_schema_rejected() -> None:
    with pytest.raises(CoverageSchemaError, match="invalid schema"):
        migrate({"hits": {}})


def test_write_refuses_old_schema() -> None:
    data = PolicyCoverageData(schema=1)
    with pytest.raises(CoverageSchemaError, match="non-current"):
        write_coverage(Path("/tmp/rfi-cov-old.json"), data)


def test_v1_step_does_not_overwrite_existing_stop() -> None:
    raw = deepcopy(V1)
    raw["hits"]["same_project"]["stop"] = 9
    out = migrate(raw)
    assert out["hits"]["same_project"]["stop"] == 9


def test_stripped_set_never_written_as_field_lanes(tmp_path: Path) -> None:
    data = PolicyCoverageData(policy_set="empty")
    path = tmp_path / "gw0.json"
    with pytest.raises(CoverageSchemaError, match="policy_set"):
        write_coverage(path, data)
    assert not path.exists()
