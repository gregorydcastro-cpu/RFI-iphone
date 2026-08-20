"""Handler tests. Real require_access. No coverage bag."""

from __future__ import annotations

import inspect

import pytest

from abac import AccessDenied, Action, HUNG_WRITES, Role, require_access
from app.ids import COMPANY_SAMPLE_AE_ID, PROJECT_ID, REV_S301_C_ID, USER_SAMPLE_AE_ID
from app.rfi import WRITES, age_rfis, set_priority, submit_rfi
from app.rfi import RFI as RfiModel
from tests.actors import actor_payload, field_headers
from tests.conftest import resource, subject

evaluate = None

PE_HEADERS = {"X-Field-Actor": "pe", "X-PE-Token": "pe-demo"}


def _envelope(note: str) -> dict:
    return {
        "task": "preflight_rfi",
        "project": {"id": str(PROJECT_ID), "name": "Harbor Yard Warehouse"},
        "sheet_revision": {
            "id": str(REV_S301_C_ID),
            "sheet_number": "S301",
            "revision": "C",
            "discipline": "Structural",
        },
        "pin": {"x_norm": 0.41, "y_norm": 0.70, "label": "B-4"},
        "photos": [],
        "open_rfis_same_sheet": [],
        "user_note": note,
        "actor": actor_payload("journeyman"),
    }


def test_rfi_module_is_one_package():
    assert WRITES == ("create_rfi_draft", "submit_rfi", "set_priority")
    assert RfiModel.__tablename__ == "rfis"
    assert callable(submit_rfi)
    assert callable(set_priority)
    assert callable(require_access)
    assert callable(age_rfis)


def test_submit_rfi_require_access_policy_only():
    with pytest.raises(AccessDenied) as raised:
        require_access(subject(role=Role.APPRENTICE), Action.SUBMIT_RFI, resource())
    assert raised.value.decision.policy == "role_allows"


def test_three_writes_hang_require_access():
    from app import main

    assert HUNG_WRITES == frozenset(
        {"create_rfi_draft", "submit_rfi", "set_priority"}
    )
    sources = (
        inspect.getsource(main.create_rfi_draft),
        inspect.getsource(main.submit_rfi),
        inspect.getsource(main.pe_submit_rfi),
        inspect.getsource(main.pe_set_priority),
    )
    for src in sources:
        assert "require_access(" in src
        assert src.index("require_access(") < src.index("except AccessDenied")


def test_draft_pin_named_403s_and_pe_assigns_number(client):
    created = client.post(
        "/create_rfi_draft",
        json=_envelope("Confirm beam clearance at grid B-4 on S301 Rev C."),
    )
    assert created.status_code == 200
    body = created.json()
    assert body["status"] == "draft"
    assert body["rfi_display"] is None
    rfi_id = body["rfi_id"]

    detail = client.get(f"/rfis/{rfi_id}").json()
    assert detail["rfi_number"] is None
    assert detail["pins"][0]["sheet_revision_id"] == str(REV_S301_C_ID)

    grok = client.post("/submit_rfi", json={"rfi_id": rfi_id})
    assert grok.status_code == 403
    grok_body = grok.json()["detail"]
    assert grok_body == {
        "policy": "grokbot_lane",
        "reason": grok_body["reason"],
    }
    assert set(grok_body) == {"policy", "reason"}

    apprentice = client.post(
        "/submit_rfi",
        json={"rfi_id": rfi_id},
        headers=field_headers("apprentice"),
    )
    assert apprentice.status_code == 403
    ap_body = apprentice.json()["detail"]
    assert ap_body["policy"] == "role_allows"
    assert set(ap_body) == {"policy", "reason"}

    client.post(
        f"/pe/rfis/{rfi_id}/approve_internal_review", json={}, headers=PE_HEADERS
    )
    submitted = client.post(
        f"/pe/rfis/{rfi_id}/submit",
        json={
            "priority": "standard",
            "work_stopped": False,
            "require_internal_review": True,
            "assigned_to_user_id": str(USER_SAMPLE_AE_ID),
            "assigned_to_company_id": str(COMPANY_SAMPLE_AE_ID),
        },
        headers=PE_HEADERS,
    )
    assert submitted.status_code == 200
    numbered = submitted.json()
    assert numbered["rfi_number"] is not None
    assert numbered["rfi_display"].startswith("RFI-")
    assert numbered["status"] == "ball_in_court"

    gated = client.post(
        f"/pe/rfis/{rfi_id}/set_priority",
        json={"priority": "work_stopped", "work_stopped": True},
        headers={**PE_HEADERS, **field_headers("apprentice")},
    )
    assert gated.status_code == 403
    assert gated.json()["detail"]["policy"] == "role_allows"
