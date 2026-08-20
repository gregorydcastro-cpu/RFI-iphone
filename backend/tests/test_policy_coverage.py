"""Coverage file schema and merge. Not pytest-cov line counts."""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import fields
from pathlib import Path

import pytest

from app.policy_coverage import (
    COVERAGE_FILE_FORBIDDEN,
    CURRENT_SCHEMA,
    CoverageSchemaError,
    DENY_ONLY,
    FIELD_LANES,
    MIGRATIONS,
    REQUIRED_STOPS,
    SCHEMA,
    PolicyCoverage,
    PolicyCoverageData,
    _hits_to_dict,
    _merge_hits,
    absorb_hits,
    assert_policy_coverage,
    dump_from_bag,
    load_parts,
    merge_after_migrate,
    merge_coverage,
    migrate,
    migrate_v1_to_v2,
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


def test_write_coverage_refuses_non_current_schema(tmp_path: Path):
    path = tmp_path / "future.json"
    data = PolicyCoverageData()
    data.schema = CURRENT_SCHEMA + 1
    with pytest.raises(ValueError, match="refusing to write schema"):
        write_coverage(path, data)
    assert not path.exists()
    assert not path.with_suffix(".tmp").exists()
    future = PolicyCoverageData(schema=3)
    with pytest.raises(ValueError, match="refusing to write schema"):
        write_coverage(path, future)


def test_from_json_migrates_then_refuses_policy_set():
    """migrate(raw) first — schema 1 with empty set is upgraded, then refused."""
    with pytest.raises(ValueError, match="refusing to merge"):
        PolicyCoverageData.from_json(
            {"schema": 1, "policy_set": "empty", "hits": {}}
        )
    raw = PolicyCoverageData().to_json()
    raw["policy_set"] = "empty"
    with pytest.raises(ValueError, match="refusing to merge"):
        PolicyCoverageData.from_json(raw)


def test_refuse_missing_schema():
    with pytest.raises(ValueError, match="missing coverage schema"):
        PolicyCoverageData.from_json({"policy_set": "field_lanes", "hits": {}})


def test_refuse_schema_mismatch(tmp_path: Path):
    raw = PolicyCoverageData().to_json()
    raw["schema"] = 99
    with pytest.raises(ValueError, match="upgrade the test runner"):
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


def _green_bag() -> PolicyCoverage:
    coverage = PolicyCoverage()
    for name in DENY_ONLY:
        coverage.seen.add(name)
        coverage.stops.add(name)
        coverage.hit_counts[name]["deny"] = 1
    coverage.seen.add("role_allows")
    coverage.stops.add("role_allows")
    coverage.hit_counts["role_allows"]["allow"] = 1
    coverage.hit_counts["role_allows"]["deny"] = 1
    return coverage


def test_default_deny_stop_is_off_the_production_bag():
    assert "default_deny" not in REQUIRED_STOPS
    assert "default_deny" not in FIELD_LANES
    coverage = _green_bag()
    assert_policy_coverage(coverage)
    assert "default_deny" not in coverage.seen
    assert "default_deny" not in coverage.stops
    stray = _green_bag()
    stray.seen.add("default_deny")
    stray.na.add("default_deny")
    assert_policy_coverage(stray)


def test_report_never_applicable_lists_unapplied_lanes():
    empty = PolicyCoverage()
    assert set(empty.report().never_applicable()) == set(FIELD_LANES)
    coverage = _green_bag()
    assert coverage.report().never_applicable() == []
    coverage.hit_counts["assigned_only"]["deny"] = 0
    assert "assigned_only" in coverage.report().never_applicable()


def test_session_had_skips_looks_at_whole_session():
    from types import SimpleNamespace

    from tests.conftest import _session_had_skips

    this = object()
    other = object()
    request = SimpleNamespace(
        session=SimpleNamespace(
            items=[
                SimpleNamespace(module=this, rep_call=SimpleNamespace(skipped=False)),
                SimpleNamespace(module=other, rep_call=SimpleNamespace(skipped=True)),
            ]
        )
    )
    assert _session_had_skips(request) is True


def test_default_deny_and_submit_access_do_not_request_cov():
    import ast
    from pathlib import Path

    root = Path(__file__).resolve().parent
    for name in ("test_default_deny.py", "test_submit_rfi_access.py"):
        tree = ast.parse((root / name).read_text())
        for node in ast.walk(tree):
            if not isinstance(node, ast.FunctionDef):
                continue
            args = [arg.arg for arg in node.args.args]
            assert "cov" not in args, f"{name} {node.name} requests cov"
            assert "evaluate_cov" not in args, f"{name} {node.name} requests evaluate_cov"
            assert node.name != "cov", f"{name} must not define cov"


def test_module_had_skips_looks_at_this_module_only():
    from types import SimpleNamespace

    from tests.conftest import _module_had_skips

    this = object()
    other = object()
    other_skip = SimpleNamespace(module=other, rep_call=SimpleNamespace(skipped=True))
    here_pass = SimpleNamespace(module=this, rep_call=SimpleNamespace(skipped=False))
    request = SimpleNamespace(
        module=this,
        session=SimpleNamespace(items=[other_skip, here_pass]),
    )
    assert _module_had_skips(request) is False
    here_skip = SimpleNamespace(module=this, rep_call=SimpleNamespace(skipped=True))
    request.session.items.append(here_skip)
    assert _module_had_skips(request) is True


def test_module_was_subset_compares_collected_to_defined():
    from types import SimpleNamespace

    from tests.conftest import _module_was_subset

    def test_same_project():
        return None

    def test_assigned_only():
        return None

    module = SimpleNamespace(
        test_same_project=test_same_project,
        test_assigned_only=test_assigned_only,
    )
    request = SimpleNamespace(
        module=module,
        session=SimpleNamespace(
            items=[SimpleNamespace(module=module, name="test_same_project")]
        ),
    )
    assert _module_was_subset(request) is True
    request.session.items.append(
        SimpleNamespace(module=module, name="test_assigned_only")
    )
    assert _module_was_subset(request) is False


def test_absorb_hits_unions_without_evaluate():
    left = PolicyCoverage()
    left.seen.add("same_project")
    left.denies.add("same_project")
    left.hit_counts["same_project"]["deny"] = 1
    left.stop_counts["same_project"] = 1
    right = PolicyCoverage()
    right.seen.add("assigned_only")
    right.denies.add("assigned_only")
    right.hit_counts["assigned_only"]["deny"] = 2
    right.stop_counts["assigned_only"] = 2
    absorb_hits(left, right)
    assert left.hit_counts["same_project"]["deny"] == 1
    assert left.hit_counts["assigned_only"]["deny"] == 2
    assert left.stops == {"same_project", "assigned_only"}


def test_is_stops_module_only_policy_stops():
    from types import SimpleNamespace

    from tests.conftest import _is_stops_module

    assert _is_stops_module(
        SimpleNamespace(module=SimpleNamespace(__file__="/x/test_policy_stops.py"))
    )
    assert not _is_stops_module(
        SimpleNamespace(module=SimpleNamespace(__file__="/x/test_role_matrix.py"))
    )


def test_empty_bag_fails_completeness_and_includes_format():
    coverage = PolicyCoverage()
    with pytest.raises(AssertionError, match="never_applicable") as raised:
        assert_policy_coverage(coverage)
    assert coverage.format() in str(raised.value)
    assert "assigned_only" in str(raised.value)


def test_deleted_assigned_only_stop_fails_completeness_with_format():
    coverage = _green_bag()
    coverage.stops.discard("assigned_only")
    coverage.hit_counts["assigned_only"]["deny"] = 0
    with pytest.raises(AssertionError, match="assigned_only") as raised:
        assert_policy_coverage(coverage)
    assert coverage.format() in str(raised.value)


def test_seal_blocks_record_and_evaluate():
    coverage = PolicyCoverage()
    coverage.seal()
    with pytest.raises(RuntimeError, match="do not record after yield"):
        coverage.record([])
    with pytest.raises(RuntimeError, match="do not evaluate after yield"):
        coverage.evaluate()


def test_line_coverage_is_not_assigned_only_denied():
    coverage = _green_bag()
    coverage.stops.discard("assigned_only")
    coverage.hit_counts["assigned_only"]["deny"] = 0
    with pytest.raises(AssertionError, match="assigned_only"):
        assert_policy_coverage(coverage)


def test_coverage_file_has_no_subject_rfi_or_traces():
    raw = PolicyCoverageData(
        hits={"same_project": {"deny": 1, "skipped_after_stop": 0}},
        decisions={"deny": 1},
        stops={"same_project": 1},
    ).to_json()
    assert COVERAGE_FILE_FORBIDDEN.isdisjoint(raw)
    for row in raw["hits"].values():
        assert COVERAGE_FILE_FORBIDDEN.isdisjoint(row)


def test_dump_from_bag_writes_schema_2(tmp_path: Path):
    coverage = _green_bag()
    path = tmp_path / ".rfi-cov" / "gw0.json"
    dump_from_bag(coverage, path, worker="gw0")
    loaded = read_coverage(path)
    assert loaded.schema == CURRENT_SCHEMA == 2
    assert loaded.worker == "gw0"
    assert loaded.policy_set == "field_lanes"
    assert loaded.combining == "deny_overrides"
    assert COVERAGE_FILE_FORBIDDEN.isdisjoint(loaded.to_json())


def test_truncated_json_fails_the_merge(tmp_path: Path):
    good = tmp_path / "gw0.json"
    write_coverage(good, PolicyCoverageData())
    bad = tmp_path / "gw1.json"
    bad.write_text('{"schema": 2, "policy_set": "field_lanes"')
    with pytest.raises((ValueError, json.JSONDecodeError)):
        merge_after_migrate(sorted(tmp_path.glob("gw*.json")))


def test_load_parts_each_is_schema_2(tmp_path: Path):
    v1 = tmp_path / "gw0.json"
    v1.write_text(json.dumps({"schema": 1, "hits": {"same_project": {"deny": 1}}}))
    current = tmp_path / "gw1.json"
    write_coverage(current, PolicyCoverageData())
    parts = load_parts(sorted(tmp_path.glob("gw*.json")))
    assert [part.schema for part in parts] == [CURRENT_SCHEMA, CURRENT_SCHEMA]
    assert all(part.policy_set == "field_lanes" for part in parts)


def test_one_unmigratable_file_fails_merge_after_migrate(tmp_path: Path):
    write_coverage(tmp_path / "gw0.json", PolicyCoverageData())
    (tmp_path / "gw1.json").write_text(json.dumps({"schema": 0, "hits": {}}))
    with pytest.raises(ValueError, match="missing migration step"):
        merge_after_migrate(sorted(tmp_path.glob("gw*.json")))
    (tmp_path / "gw1.json").write_text(json.dumps({"schema": 99, "hits": {}}))
    with pytest.raises(ValueError, match="upgrade the test runner"):
        merge_after_migrate(sorted(tmp_path.glob("gw*.json")))


def test_controller_uses_merge_after_migrate():
    source = Path(__file__).resolve().parents[0] / "conftest.py"
    assert 'merge_after_migrate(sorted(COV_DIR.glob("gw*.json")))' in source.read_text()


def test_migrate_deepcopy_rejects_non_object_and_bad_schema():
    raw = {"schema": 2, "policy_set": "field_lanes", "hits": {}}
    snapshot = deepcopy(raw)
    assert migrate(raw)["schema"] == 2
    assert raw == snapshot
    with pytest.raises(ValueError, match="object"):
        migrate(["not", "an", "object"])
    with pytest.raises(ValueError, match="missing coverage schema"):
        migrate({"policy_set": "field_lanes", "hits": {}})
    with pytest.raises(ValueError, match="invalid coverage schema"):
        migrate({"schema": "2", "hits": {}})
    with pytest.raises(ValueError, match="upgrade the test runner"):
        migrate({"schema": 99, "hits": {}})
    with pytest.raises(ValueError, match="missing migration step"):
        migrate({"schema": 0, "hits": {}})


def test_migrate_rejects_step_that_does_not_land_on_schema_plus_one(monkeypatch):
    def bad_step(raw):
        nxt = dict(raw)
        nxt["schema"] = 99
        return nxt

    monkeypatch.setitem(MIGRATIONS, 1, bad_step)
    with pytest.raises(ValueError, match="schema\\+1"):
        migrate({"schema": 1, "hits": {}})


def test_migrate_v1_to_v2_setdefaults_stop_defaults_to_deny():
    raw = {
        "schema": 1,
        "hits": {"same_project": {"deny": 2}},
    }
    snapshot = deepcopy(raw)
    out = migrate(raw)
    assert raw == snapshot
    assert out["schema"] == 2
    assert out["combining"] == "deny_overrides"
    assert out["policy_set"] == "field_lanes"
    assert out["worker"] is None
    assert out["decisions"] == {}
    assert out["stops"] == {}
    row = out["hits"]["same_project"]
    assert row["seen"] == 0
    assert row["applicable"] == 0
    assert row["allow"] == 0
    assert row["deny"] == 2
    assert row["stop"] == 2
    assert row["skipped_after_stop"] == 0
    loaded = PolicyCoverageData.from_json(raw)
    assert loaded.schema == 2
    assert loaded.combining == "deny_overrides"
    assert loaded.hits["same_project"]["stop"] == 2


def test_read_coverage_migrates_then_validates_policy_set(tmp_path: Path):
    path = tmp_path / "gw0.json"
    path.write_text(json.dumps({"schema": 1, "hits": {"same_project": {"deny": 1}}}))
    loaded = read_coverage(path)
    assert loaded.schema == 2
    assert loaded.policy_set == "field_lanes"
    assert loaded.hits["same_project"]["stop"] == 1
    bad = tmp_path / "gw1.json"
    bad.write_text(
        json.dumps({"schema": 1, "policy_set": "empty", "hits": {}})
    )
    with pytest.raises(ValueError, match="refusing to merge"):
        read_coverage(bad)


def test_migrate_v1_to_v2_hits_required_object():
    with pytest.raises(ValueError, match="hits required object"):
        migrate({"schema": 1})
    with pytest.raises(ValueError, match="hits required object"):
        migrate({"schema": 1, "hits": []})
    with pytest.raises(CoverageSchemaError, match="hit row must be an object"):
        migrate({"schema": 1, "hits": {"same_project": 2}})


def test_migrate_v1_is_registered_v2_to_v3_is_not():
    assert CURRENT_SCHEMA == 2
    assert MIGRATIONS[1] is migrate_v1_to_v2
    assert 2 not in MIGRATIONS
    assert migrate_v2_to_v3 not in MIGRATIONS.values()


def test_merge_coverage_adds_ints_never_average_or_max():
    left = {
        "schema": 2,
        "policy_set": "field_lanes",
        "combining": "deny_overrides",
        "hits": {"same_project": {"deny": 2, "skipped_after_stop": 1}},
        "decisions": {"deny": 2},
        "stops": {"same_project": 2},
    }
    right = {
        "schema": 2,
        "policy_set": "field_lanes",
        "combining": "deny_overrides",
        "hits": {
            "same_project": {"deny": 3, "skipped_after_stop": 4},
            "mystery_lane": {"deny": 1},
        },
        "decisions": {"deny": 3},
        "stops": {"same_project": 3},
    }
    merged = merge_coverage([left, right])
    assert merged.hits["same_project"]["deny"] == 5
    assert merged.hits["same_project"]["skipped_after_stop"] == 5
    assert merged.decisions["deny"] == 5
    assert merged.stops["same_project"] == 5
    assert merged.hits["mystery_lane"]["deny"] == 1


def test_merge_coverage_empty_hits_are_zeros():
    empty = {
        "schema": 2,
        "policy_set": "field_lanes",
        "combining": "deny_overrides",
        "hits": {},
        "decisions": {},
        "stops": {},
    }
    merged = merge_coverage([empty, empty])
    assert merged.hits == {}
    assert merged.decisions == {}
    assert merged.stops == {}
    assert merge_coverage([]).hits == {}


def test_merge_coverage_incompatible_combining_raises():
    left = PolicyCoverageData().to_json()
    right = PolicyCoverageData().to_json()
    right["combining"] = "permit_overrides"
    with pytest.raises(ValueError, match="incompatible combining"):
        merge_coverage([left, right])


def test_merge_coverage_incompatible_policy_set_raises():
    left = PolicyCoverageData().to_json()
    right = PolicyCoverageData().to_json()
    right["policy_set"] = "empty"
    with pytest.raises(ValueError, match="incompatible policy_set|refusing to merge"):
        merge_coverage([left, right])


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
