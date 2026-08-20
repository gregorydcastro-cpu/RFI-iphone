"""Coverage schema walker. Not policy-stop tests. Not pytest-cov."""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path

import pytest

from coverage_schema import (
    CURRENT_SCHEMA,
    CoverageSchemaError,
    PolicyCoverageData,
    merge_coverage,
    migrate,
    migrate_v1_to_v2,
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


def test_v1_gains_skipped_after_stop() -> None:
    out = PolicyCoverageData.from_json(V1)
    assert out.schema == 2
    assert out.hits["role_allows"]["skipped_after_stop"] == 0
    assert out.combining == "deny_overrides"


def test_future_schema_rejected() -> None:
    with pytest.raises(CoverageSchemaError, match="newer than code"):
        migrate({"schema": CURRENT_SCHEMA + 1, "hits": {}})


def test_write_refuses_old_schema() -> None:
    data = PolicyCoverageData(schema=1)
    with pytest.raises(CoverageSchemaError):
        write_coverage(Path("/tmp/rfi-cov-old.json"), data)


def test_migrate_v1_twice_via_current_is_stable() -> None:
    once = migrate(V1)
    assert once["schema"] == CURRENT_SCHEMA
    twice = migrate(once)
    assert once == twice
    assert migrate(migrate(V1)) == migrate(V1)


def test_step_does_not_double_stop() -> None:
    raw = {
        "schema": 1,
        "hits": {
            "same_project": {
                "seen": 1,
                "applicable": 1,
                "allow": 0,
                "deny": 1,
                "stop": 1,
                "skipped_after_stop": 4,
            }
        },
    }
    out = migrate(raw)
    assert out["hits"]["same_project"]["stop"] == 1
    assert out["hits"]["same_project"]["skipped_after_stop"] == 4
    again = migrate(out)
    assert again["hits"]["same_project"]["stop"] == 1
    assert again["hits"]["same_project"]["skipped_after_stop"] == 4


def test_migrate_does_not_touch_input() -> None:
    raw = deepcopy(V1)
    snapshot = deepcopy(raw)
    migrate(raw)
    assert raw == snapshot


def test_current_normalize_does_not_bump() -> None:
    raw = {
        "schema": CURRENT_SCHEMA,
        "policy_set": "field_lanes",
        "hits": {"same_project": {"deny": 3}},
    }
    out = migrate(raw)
    assert out["schema"] == CURRENT_SCHEMA
    assert out["hits"]["same_project"]["stop"] == 3
    assert out["hits"]["same_project"]["deny"] == 3
    again = migrate(out)
    assert again["hits"]["same_project"]["stop"] == 3
    assert again["hits"]["same_project"]["deny"] == 3


def test_walker_imports_are_not_from_coverage_abac() -> None:
    assert migrate.__module__ == "app.coverage_schema"
    assert read_coverage.__module__ == "app.coverage_schema"
    assert write_coverage.__module__ == "app.coverage_schema"
    assert merge_coverage.__module__ == "app.coverage_schema"
    assert migrate_v1_to_v2.__module__ == "app.coverage_schema"
    assert PolicyCoverageData.__module__ == "app.coverage_schema"
