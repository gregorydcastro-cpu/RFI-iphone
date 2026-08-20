"""Coverage schema walker. Not policy-stop tests. Do not request cov."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

import pytest

from coverage_schema import (
    CURRENT_SCHEMA,
    MIGRATIONS,
    CoverageSchemaError,
    PolicyCoverageData,
    merge_coverage,
    migrate,
    migrate_v1_to_v2,
    migrate_v2_to_v3,
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


def test_normalize_does_not_add_deny_onto_existing_stop() -> None:
    raw = {
        "schema": CURRENT_SCHEMA,
        "policy_set": "field_lanes",
        "hits": {"same_project": {"deny": 3, "stop": 1}},
    }
    out = migrate(raw)
    assert out["schema"] == CURRENT_SCHEMA
    assert out["hits"]["same_project"]["stop"] == 1
    assert out["hits"]["same_project"]["deny"] == 3
    assert out["hits"]["same_project"]["skipped_after_stop"] == 0


def test_normalize_is_not_a_substitute_for_a_missing_step() -> None:
    with pytest.raises(CoverageSchemaError, match="missing migration step"):
        migrate({"schema": 0, "hits": {}})
    assert CURRENT_SCHEMA == 2
    assert 2 not in MIGRATIONS
    assert 3 not in MIGRATIONS


def test_v1_step_does_not_overwrite_existing_stop() -> None:
    raw = deepcopy(V1)
    raw["hits"]["same_project"]["stop"] = 9
    out = migrate(raw)
    assert out["hits"]["same_project"]["stop"] == 9


def test_v1_step_classic_source_gains_new_keys() -> None:
    raw = deepcopy(V1)
    assert "stop" not in raw["hits"]["same_project"]
    assert "skipped_after_stop" not in raw["hits"]["same_project"]
    nxt = migrate_v1_to_v2(raw)
    assert nxt["hits"]["same_project"]["stop"] == raw["hits"]["same_project"]["deny"] == 1
    assert nxt["hits"]["same_project"]["skipped_after_stop"] == 0
    assert nxt["hits"]["same_project"]["deny"] == 1
    assert nxt["hits"]["role_allows"]["allow"] == 1
    assert nxt["hits"]["role_allows"]["deny"] == 1


def test_v1_step_already_new_keys_keeps_counts() -> None:
    raw = deepcopy(V2)
    nxt = migrate_v1_to_v2(raw)
    assert nxt["hits"]["same_project"]["deny"] == 1
    assert nxt["hits"]["same_project"]["stop"] == 1
    assert nxt["hits"]["same_project"]["skipped_after_stop"] == 0
    assert nxt["hits"]["role_allows"]["allow"] == 1
    assert nxt["hits"]["role_allows"]["deny"] == 1
    assert nxt["hits"]["role_allows"]["stop"] == 1
    assert nxt["hits"]["role_allows"]["skipped_after_stop"] == 1


def test_v1_step_mixed_row_prefers_new_key() -> None:
    raw = {
        "schema": 1,
        "policy_set": "field_lanes",
        "hits": {"same_project": {"deny": 3, "stop": 1}},
    }
    nxt = migrate_v1_to_v2(raw)
    assert nxt["hits"]["same_project"]["stop"] == 1
    assert nxt["hits"]["same_project"]["deny"] == 3


def test_v1_step_input_identity() -> None:
    raw = deepcopy(V1)
    before = deepcopy(raw)
    migrate_v1_to_v2(raw)
    assert raw == before


def test_v1_step_result_is_not_raw() -> None:
    raw = deepcopy(V1)
    nxt = migrate_v1_to_v2(raw)
    assert nxt is not raw


def test_v1_step_schema_is_exactly_n_plus_one() -> None:
    nxt = migrate_v1_to_v2(deepcopy(V1))
    assert nxt["schema"] == 2
    again = migrate_v1_to_v2(nxt)
    assert again["schema"] == 2


def test_v2_step_lands_on_n_plus_one_and_does_not_mutate() -> None:
    raw = deepcopy(V2)
    snapshot = deepcopy(raw)
    out = migrate_v2_to_v3(raw)
    assert raw == snapshot
    assert out is not raw
    assert out["schema"] == 3 == raw["schema"] + 1
    assert out["hits"]["same_project"]["stopped"] == 1
    assert "stop" not in out["hits"]["same_project"]


def test_v2_step_on_already_v3_keeps_counts() -> None:
    raw = {
        "schema": 3,
        "policy_set": "field_lanes",
        "hits": {
            "same_project": {"deny": 1, "stopped": 1, "skipped_after_stop": 0},
            "role_allows": {"allow": 1, "stopped": 1, "skipped_after_stop": 1},
        },
    }
    snapshot = deepcopy(raw)
    out = migrate_v2_to_v3(raw)
    assert raw == snapshot
    assert out["schema"] == 3
    assert out["hits"]["same_project"]["deny"] == 1
    assert out["hits"]["same_project"]["stopped"] == 1
    assert out["hits"]["same_project"]["skipped_after_stop"] == 0
    assert out["hits"]["role_allows"]["allow"] == 1
    assert out["hits"]["role_allows"]["stopped"] == 1
    assert out["hits"]["role_allows"]["skipped_after_stop"] == 1
    assert "stop" not in out["hits"]["same_project"]
    assert "stop" not in out["hits"]["role_allows"]


def test_strategy_a_is_monotonic_int_with_every_step_from_1() -> None:
    assert type(CURRENT_SCHEMA) is int
    assert CURRENT_SCHEMA >= 1
    assert set(MIGRATIONS) == set(range(1, CURRENT_SCHEMA))
    assert MIGRATIONS[1] is migrate_v1_to_v2
    assert MIGRATIONS[1].__name__ == "migrate_v1_to_v2"
    assert 2 not in MIGRATIONS
    assert migrate_v2_to_v3 not in MIGRATIONS.values()


def test_strategy_a_refuses_semver_and_date_schema() -> None:
    with pytest.raises(CoverageSchemaError, match="invalid schema"):
        migrate({"schema": "2.0.0", "hits": {}})
    with pytest.raises(CoverageSchemaError, match="invalid schema"):
        migrate({"schema": "2026-08-20", "hits": {}})


def test_strategy_a_file_newer_than_code_refused() -> None:
    with pytest.raises(CoverageSchemaError, match="newer than code"):
        migrate({"schema": CURRENT_SCHEMA + 1, "hits": {}})


def test_strategy_a_file_older_migrates_then_merge() -> None:
    merged = merge_coverage([deepcopy(V1), deepcopy(V2)])
    assert merged.schema == CURRENT_SCHEMA
    assert merged.hits["same_project"]["deny"] == 2


def test_strategy_a_new_policy_name_is_data_not_a_bump() -> None:
    raw = deepcopy(V2)
    raw["hits"]["mystery_lane"] = {"deny": 1}
    out = migrate(raw)
    assert out["schema"] == CURRENT_SCHEMA
    assert out["hits"]["mystery_lane"]["deny"] == 1


def test_strategy_a_rename_copies_stop_and_does_not_reuse_it() -> None:
    raw = deepcopy(V2)
    out = migrate_v2_to_v3(raw)
    assert out["schema"] == 3
    assert out["hits"]["same_project"]["stopped"] == raw["hits"]["same_project"]["stop"]
    assert "stop" not in out["hits"]["same_project"]
    assert raw["hits"]["same_project"]["stop"] == 1


def test_strategy_a_schema_has_no_grafana() -> None:
    dumped = PolicyCoverageData.from_json(deepcopy(V2)).to_json()
    keys = {str(key).lower() for key in dumped}
    assert "grafana" not in keys
    assert "prometheus" not in keys


def test_stripped_set_never_written_as_field_lanes(tmp_path: Path) -> None:
    data = PolicyCoverageData(policy_set="empty")
    path = tmp_path / "gw0.json"
    with pytest.raises(CoverageSchemaError, match="policy_set"):
        write_coverage(path, data)
    assert not path.exists()
