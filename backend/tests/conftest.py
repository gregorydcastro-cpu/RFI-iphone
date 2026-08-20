from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


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

    from app.seed import seed_demo

    session = dbmod.SessionLocal()
    try:
        seed_demo(session)
    finally:
        session.close()

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
