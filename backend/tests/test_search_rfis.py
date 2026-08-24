from app.ids import PROJECT_ID, REV_E101_A_ID, SHOP_DRAFT_RFI_ID
from tests.actors import actor_payload, clear_seeded_shop_draft


def _draft(client, note: str, label: str = "B-4"):
    clear_seeded_shop_draft()
    return client.post(
        "/create_rfi_draft",
        json={
            "task": "preflight_rfi",
            "project": {"id": str(PROJECT_ID), "name": "G-Line Shop Test"},
            "sheet_revision": {
                "id": str(REV_E101_A_ID),
                "sheet_number": "E-101",
                "revision": "A",
                "discipline": "E",
            },
            "pin": {"x_norm": 0.42, "y_norm": 0.71, "label": label},
            "photos": [],
            "open_rfis_same_sheet": [],
            "user_note": note,
            "actor": actor_payload("journeyman"),
        },
    )


def test_search_requires_project_id(client):
    response = client.get("/search_rfis")
    assert response.status_code == 422


def test_search_unknown_project(client):
    response = client.get(
        "/search_rfis", params={"project_id": "bbbbbbbb-0000-4000-8000-000000000099"}
    )
    assert response.status_code == 404


def test_search_default_limit_and_empty(client):
    response = client.get("/search_rfis", params={"project_id": str(PROJECT_ID)})
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["count"] == 1
    assert body["rfis"][0]["id"] == str(SHOP_DRAFT_RFI_ID)


def test_search_limit_bounds(client):
    too_low = client.get("/search_rfis", params={"project_id": str(PROJECT_ID), "limit": 0})
    too_high = client.get("/search_rfis", params={"project_id": str(PROJECT_ID), "limit": 26})
    assert too_low.status_code == 422
    assert too_high.status_code == 422


def test_search_by_sheet_grid_query_and_status(client):
    first = _draft(client, "Beam at the duct clash needs confirmation.")
    assert first.status_code == 200
    rfi_id = first.json()["rfi_id"]

    by_sheet = client.get(
        "/search_rfis",
        params={"project_id": str(PROJECT_ID), "sheet_number": "E-101"},
    )
    assert by_sheet.json()["count"] == 1
    assert by_sheet.json()["rfis"][0]["id"] == rfi_id

    by_grid = client.get(
        "/search_rfis",
        params={"project_id": str(PROJECT_ID), "grid": "B-4"},
    )
    assert by_grid.json()["count"] == 1

    by_query = client.get(
        "/search_rfis",
        params={"project_id": str(PROJECT_ID), "query": "duct clash"},
    )
    assert by_query.json()["count"] == 1

    by_status = client.get(
        "/search_rfis",
        params={"project_id": str(PROJECT_ID), "status_in": "draft"},
    )
    assert by_status.json()["count"] == 1

    closed_only = client.get(
        "/search_rfis",
        params={"project_id": str(PROJECT_ID), "status_in": "closed"},
    )
    assert closed_only.json()["count"] == 0

    other_sheet = client.get(
        "/search_rfis",
        params={"project_id": str(PROJECT_ID), "sheet_number": "E-000"},
    )
    assert other_sheet.json()["count"] == 0
