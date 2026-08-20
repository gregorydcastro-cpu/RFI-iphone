from __future__ import annotations

import sys
import tempfile
from collections.abc import Iterable
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pytest
from fastapi.testclient import TestClient

from abac import (
    AccessDenied,
    ActorType,
    Decision,
    EvaluationTrace,
    FIELD_POLICY_SET,
    Resource,
    Role,
    Subject,
    as_decision_policy,
    evaluate as _engine_evaluate,
)
from app.policy_coverage import (
    EXPECTED_ORDER,
    PolicyCoverage,
    PolicyCoverageData,
    REQUIRED_STOPS,
    _hits_to_dict,
    _merge_hits,
    _traces,
    absorb_hits,
    assert_policy_coverage,
    write_coverage,
)

JOB = UUID("00000000-0000-4000-8000-000000000010")
OTHER_JOB = UUID("00000000-0000-4000-8000-000000000110")
AREA = UUID("00000000-0000-4000-8000-000000000401")
OTHER_AREA = UUID("00000000-0000-4000-8000-000000000402")
USER = UUID("00000000-0000-4000-8000-000000000001")
CREW = UUID("00000000-0000-4000-8000-000000000002")
OTHER = UUID("00000000-0000-4000-8000-000000000003")
COMPANY = UUID("00000000-0000-4000-8000-000000000301")

PREFIX_DENY = {
    1: "same_project",
    2: "grokbot_lane",
    3: "on_site",
    4: "role_allows",
}

DENY_READ = {
    "grokbot_lane": "packet bug, bot tried to submit/set_priority",
    "role_allows": "wrong role on project_assignments",
    "area_scope": "area_id on resource vs subject",
    "assigned_only": "assigned_to_id",
    "chain_owns": "crew_foreman_id",
    "status_guard": "already submitted/answered",
    "work_stop_writer": "need set_priority / allow_demote",
    "same_project": "handler loaded the wrong job",
}

TRACE_TABLE_FIELDS = ("seq", "policy", "applicable", "effect", "stopped")


def subject(
    *,
    role: Role = Role.JOURNEYMAN,
    actor_type: ActorType = ActorType.HUMAN,
    project_id: UUID = JOB,
    area_id: UUID | None = AREA,
    user_id: UUID = USER,
    crew_ids: frozenset[UUID] | None = None,
    reports_to_id: UUID | None = None,
    company_id: UUID = COMPANY,
) -> Subject:
    return Subject(
        user_id=user_id,
        company_id=company_id,
        project_id=project_id,
        role=role,
        area_id=area_id,
        reports_to_id=reports_to_id,
        actor_type=actor_type,
        crew_ids=crew_ids if crew_ids is not None else frozenset(),
    )


def resource(
    *,
    type: str = "rfi",
    project_id: UUID = JOB,
    area_id: UUID | None = AREA,
    status: str | None = "draft",
    **kwargs,
) -> Resource:
    return Resource(
        type=type, project_id=project_id, area_id=area_id, status=status, **kwargs
    )


def names(walk) -> list[str]:
    return [step.policy for step in _traces(walk)]


def first_stop(walk) -> EvaluationTrace:
    for step in _traces(walk):
        if step.stopped:
            return step
    raise AssertionError("walk never stopped")


def gold_rows(walk) -> list[tuple]:
    rows: list[tuple] = []
    for step in _traces(walk):
        if step.effect is None and step.applicable is False:
            rows.append((step.seq, step.policy, "n/a"))
            continue
        if step.effect == "allow":
            rows.append((step.seq, step.policy, "ALLOW", step.reason))
            continue
        if step.effect == "deny" and step.stopped:
            rows.append((step.seq, step.policy, "DENY", step.reason, "STOP"))
            continue
        rows.append(
            (
                step.seq,
                step.policy,
                step.effect,
                step.reason,
                "STOP" if step.stopped else None,
            )
        )
    return rows


def trace_table(steps: Iterable[EvaluationTrace]) -> list[tuple]:
    return [
        (step.seq, step.policy, step.applicable, step.effect, step.stopped)
        for step in steps
    ]


def format_trace_table(steps: Iterable[EvaluationTrace]) -> str:
    lines: list[str] = []
    for step in steps:
        appl = "yes" if step.applicable else "no"
        effect = "—" if step.effect is None else step.effect
        stopped = "yes" if step.stopped else "no"
        lines.append(
            f"seq{step.seq} {step.policy} appl={appl} effect={effect} stopped={stopped}"
        )
    return "\n".join(lines)


def reject_stopped_only_on_halt_deny(steps: Iterable[EvaluationTrace]) -> None:
    for step in steps:
        if step.effect == "allow" and step.stopped:
            raise TypeError("an allow is never stopped")
        if step.stopped and step.effect != "deny":
            raise TypeError("stopped is True only on the deny that halted")
        if step.effect == "deny" and not step.stopped:
            raise TypeError("the deny that halted must set stopped")


def format_trace(steps: Iterable[EvaluationTrace], *, decision: Decision | None = None) -> str:
    """Server/test/REPL receipt. Not HTTP. Not the phone. Not a Grokbot tool result."""
    lines: list[str] = []
    for i, step in enumerate(steps, start=1):
        if not step.applicable:
            mark = "n/a"
        elif step.effect == "deny":
            mark = f"DENY  {step.reason}"
        else:
            mark = f"ALLOW {step.reason}"
        stop = "  STOP" if step.stopped else ""
        lines.append(f"{i:2}  {step.policy:<20} {mark}{stop}")
    if decision is not None:
        lines.append(f"→ {decision.effect.value.upper()}  {decision.policy}: {decision.reason}")
    return "\n".join(lines)


def stop_policy(steps: list[EvaluationTrace]) -> str | None:
    """Use stopped=True. Never steps[-1]."""
    for step in steps:
        if step.stopped:
            return step.policy
    return None


def assert_walk_invariants(
    decision: Decision,
    steps: Iterable[EvaluationTrace],
    *,
    policy_set=FIELD_POLICY_SET,
) -> None:
    rows = list(steps)
    seqs = [step.seq for step in rows]
    assert seqs == list(range(1, len(rows) + 1)), f"seq not contiguous from 1: {seqs}"
    walked = [step.policy for step in rows]
    ranked = tuple(policy.name for policy in policy_set.ranked())
    if policy_set is FIELD_POLICY_SET:
        space = EXPECTED_ORDER
    elif "default_deny" in ranked:
        space = ranked
    else:
        space = ranked + ("default_deny",)
    assert walked == list(space[: len(walked)]), (
        f"names are a prefix of the ranked set, never a reshuffle: {walked}"
    )
    stopped = [step for step in rows if step.stopped]
    assert len(stopped) <= 1, f"at most one stopped=True: {stopped}"
    allows = [step for step in rows if step.effect == "allow"]
    assert len(allows) <= 1, f"at most one effect=allow: {allows}"
    if allows:
        assert allows[0].policy == "role_allows"
        assert allows[0].stopped is False
    if stopped:
        assert decision.allowed is False
        if as_decision_policy(decision) != "default_deny":
            assert decision.policy == stopped[0].policy
    if not stopped and decision.allowed:
        if walked and walked[-1] == "default_deny":
            body = list(ranked)
            if body and body[-1] == "default_deny":
                assert walked == body
            else:
                assert walked[:-1] == body
            assert rows[-1].applicable is False
            assert rows[-1].order == 99
        else:
            assert walked == list(ranked)
    first = next((step for step in rows if step.applicable), None)
    if (
        policy_set is FIELD_POLICY_SET
        and first is not None
        and first.effect == "deny"
        and first.seq in PREFIX_DENY
    ):
        assert first.policy == PREFIX_DENY[first.seq]


def evaluate(*args, **kwargs):
    walk = _engine_evaluate(*args, **kwargs)
    assert_walk_invariants(
        walk.decision,
        walk.steps,
        policy_set=kwargs.get("policy_set", FIELD_POLICY_SET),
    )
    reject_stopped_only_on_halt_deny(walk.steps)
    return walk


def require_access_cov(cov: PolicyCoverage, *args, **kwargs):
    """Coverage + raise. Production require_access still builds EvaluationLog."""
    decision, steps = cov.evaluate(*args, **kwargs)
    if not decision.allowed:
        raise AccessDenied(decision=decision, trace=tuple(steps))
    return decision


def assert_stop(steps: list[EvaluationTrace], name: str) -> None:
    actual = stop_policy(steps)
    if actual != name:
        raise AssertionError(
            f"expected stop at {name}, got {actual}\n{format_trace(steps)}"
        )


def _worker_id(config) -> str | None:
    workerinput = getattr(config, "workerinput", None)
    if workerinput is None:
        return None
    return workerinput.get("workerid")


def _is_xdist_worker(config) -> bool:
    return getattr(config, "workerinput", None) is not None


def _is_subset_run(config) -> bool:
    keyword = getattr(config.option, "keyword", "") or ""
    return bool(keyword.strip())


def _cov_dump_path(worker_id: str) -> Path:
    return Path(tempfile.gettempdir()) / f"rfi-cov-{worker_id}.json"


def pytest_configure(config):
    config._rfi_cov_bags = []
    config._rfi_cov_merged = []


def pytest_xdist_make_scheduler(config, log):
    """Keep each test file on one worker so a module coverage bag stays whole."""
    from xdist.scheduler import LoadFileScheduling

    return LoadFileScheduling(config, log)


@pytest.hookimpl(hookwrapper=True, tryfirst=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    setattr(item, f"rep_{report.when}", report)


def _module_items(request: pytest.FixtureRequest):
    module = request.module
    for item in getattr(request.session, "items", ()):
        if getattr(item, "module", None) is module:
            yield item


def _item_was_skipped(item) -> bool:
    for when in ("setup", "call", "teardown"):
        report = getattr(item, f"rep_{when}", None)
        if report is not None and report.skipped:
            return True
    return False


def _module_had_skips(request: pytest.FixtureRequest) -> bool:
    """Skipped outcomes on this module’s items only. Not the whole session."""
    return any(_item_was_skipped(item) for item in _module_items(request))


def _session_had_skips(request: pytest.FixtureRequest) -> bool:
    """Skipped outcomes anywhere in this session. Used by session-scoped cov."""
    return any(
        _item_was_skipped(item) for item in getattr(request.session, "items", ())
    )


def _module_was_subset(request: pytest.FixtureRequest) -> bool:
    """-k / nodeid collected fewer tests than this module defines."""
    defined = [
        name
        for name, obj in vars(request.module).items()
        if name.startswith("test_") and callable(obj)
    ]
    collected = list(_module_items(request))
    return len(collected) < len(defined)


def _is_stops_module(request: pytest.FixtureRequest) -> bool:
    path = getattr(request.module, "__file__", "") or ""
    return Path(path).name == "test_policy_stops.py"


@pytest.fixture(scope="session")
def cov_summary() -> PolicyCoverage:
    """Print rollup only. Not the completeness gate."""
    coverage = PolicyCoverage()
    yield coverage
    coverage.seal()
    print("\n" + coverage.format())


@pytest.fixture(scope="module")
def cov(request: pytest.FixtureRequest, cov_summary: PolicyCoverage) -> PolicyCoverage:
    coverage = PolicyCoverage()
    failed_before = request.session.testsfailed
    yield coverage
    coverage.seal()
    absorb_hits(cov_summary, coverage)
    bags = getattr(request.config, "_rfi_cov_bags", None)
    if bags is None:
        request.config._rfi_cov_bags = []
        bags = request.config._rfi_cov_bags
    bags.append(_hits_to_dict(coverage, worker=_worker_id(request.config)))
    failed_here = request.session.testsfailed - failed_before
    if failed_here:
        return
    if not _is_stops_module(request):
        return
    if coverage.report().never_applicable() and _module_had_skips(request):
        pytest.skip("coverage incomplete because tests were skipped")
    assert_policy_coverage(coverage)


@pytest.fixture
def evaluate_cov(cov: PolicyCoverage):
    """Drop-in for evaluate(); same return, recorded for coverage."""
    return cov.evaluate


def pytest_testnodedown(node, error):
    workerout = getattr(node, "workeroutput", None) or {}
    bags = workerout.get("rfi_cov_bags") or []
    merged = getattr(node.config, "_rfi_cov_merged", None)
    if merged is None:
        node.config._rfi_cov_merged = []
        merged = node.config._rfi_cov_merged
    merged.extend(bags)


def pytest_sessionfinish(session, exitstatus):
    config = session.config
    if _is_xdist_worker(config):
        bags = getattr(config, "_rfi_cov_bags", [])
        workeroutput = getattr(config, "workeroutput", None)
        if workeroutput is not None:
            workeroutput["rfi_cov_bags"] = bags
        worker = _worker_id(config) or "gw?"
        if bags:
            write_coverage(
                _cov_dump_path(worker),
                PolicyCoverageData.from_json(
                    bags[0]
                    if len(bags) == 1
                    else _hits_to_dict(_merge_hits(bags), worker=worker)
                ),
            )
        return
    if exitstatus != 0:
        return
    bags = list(getattr(config, "_rfi_cov_merged", []) or [])
    if not bags:
        return
    assert_policy_coverage(_merge_hits(bags))


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    monkeypatch.setenv("RFI_DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("RFI_DATA_DIR", str(data_dir))

    import app.db as dbmod

    dbmod.DATA_DIR = data_dir
    dbmod.ATTACHMENTS_DIR = data_dir / "attachments"
    dbmod.configure(f"sqlite:///{db_path}")
    dbmod.init_db()

    from app.holiday_cache import holiday_cache
    from app.seed import seed_demo

    holiday_cache.clear()

    session = dbmod.SessionLocal()
    try:
        seed_demo(session)
    finally:
        session.close()

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
