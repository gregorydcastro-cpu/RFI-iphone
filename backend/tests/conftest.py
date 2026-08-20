from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pytest
from fastapi.testclient import TestClient

from app.policy_coverage import (
    PolicyCoverage,
    PolicyCoverageData,
    _hits_to_dict,
    _merge_hits,
    assert_policy_coverage,
    read_coverage,
    write_coverage,
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


def _cov_dump_path(config, worker_id: str) -> Path:
    return Path(config.rootpath) / f"rfi-cov-{worker_id}.json"


def pytest_configure(config):
    config._rfi_cov_bags = []
    config._rfi_cov_merged = []


@pytest.fixture(scope="module")
def cov(request: pytest.FixtureRequest) -> PolicyCoverage:
    coverage = PolicyCoverage()
    failed_before = request.session.testsfailed
    yield coverage
    bag = _hits_to_dict(coverage, worker=_worker_id(request.config))
    bags = getattr(request.config, "_rfi_cov_bags", None)
    if bags is None:
        request.config._rfi_cov_bags = []
        bags = request.config._rfi_cov_bags
    bags.append(bag)
    failed_here = request.session.testsfailed - failed_before
    if failed_here:
        return
    if _is_xdist_worker(request.config):
        return
    assert_policy_coverage(coverage)


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
            return
        worker = _worker_id(config) or "gw?"
        write_coverage(
            _cov_dump_path(config, worker),
            PolicyCoverageData.from_json(
                bags[0] if len(bags) == 1 else _hits_to_dict(_merge_hits(bags), worker=worker)
            )
            if bags
            else PolicyCoverageData(worker=worker),
        )
        return
    if exitstatus != 0:
        return
    if _is_subset_run(config):
        return
    bags = list(getattr(config, "_rfi_cov_merged", []) or [])
    if not bags:
        dumps = sorted(Path(config.rootpath).glob("rfi-cov-gw*.json"))
        if dumps:
            bags = [read_coverage(path).to_json() for path in dumps]
        else:
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
