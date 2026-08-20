"""Coverage file schema and merge. Not pytest-cov line counts."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import fields
from pathlib import Path

import pytest

from app.policy_coverage import (
    CURRENT_SCHEMA,
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
