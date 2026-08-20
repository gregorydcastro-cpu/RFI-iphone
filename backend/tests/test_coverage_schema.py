"""Coverage schema walker. Not policy-stop tests. Not pytest-cov."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.policy_coverage import (
    CURRENT_SCHEMA,
    MIGRATIONS,
    CoverageSchemaError,
    PolicyCoverageData,
    load_parts,
    merge_after_migrate,
    migrate,
    migrate_v1_to_v2,
    migrate_v2_to_v3,
    write_coverage,
)


def test_v1_gains_skipped_after_stop() -> None:
    raw = {
        "schema": 1,
        "policy_set": "field_lanes",
        "hits": {"role_allows": {"seen": 1, "applicable": 1, "allow": 1, "deny": 0}},
    }
    out = PolicyCoverageData.from_json(raw)
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


def test_one_step_per_version_no_v1_to_v3_shortcut() -> None:
    assert CURRENT_SCHEMA == 2
    assert set(MIGRATIONS) == {1}
    assert MIGRATIONS[1] is migrate_v1_to_v2
    assert 2 not in MIGRATIONS
    assert migrate_v2_to_v3 not in MIGRATIONS.values()
    out = migrate({"schema": 1, "hits": {"role_allows": {"allow": 1}}})
    assert out["schema"] == 2
    assert "stopped" not in out["hits"]["role_allows"]


def test_bool_true_is_not_seen_one() -> None:
    with pytest.raises(CoverageSchemaError, match="expected int"):
        migrate(
            {
                "schema": 1,
                "hits": {"role_allows": {"seen": True, "allow": 1, "deny": 0}},
            }
        )


def test_merge_only_after_migrate(tmp_path: Path) -> None:
    v1 = tmp_path / "gw0.json"
    v1.write_text(
        '{"schema": 1, "policy_set": "field_lanes",'
        ' "hits": {"role_allows": {"allow": 1}}}'
    )
    parts = load_parts([v1])
    assert parts[0].schema == CURRENT_SCHEMA == 2
    merged = merge_after_migrate([v1])
    assert merged.schema == 2
    assert merged.hits["role_allows"]["skipped_after_stop"] == 0
