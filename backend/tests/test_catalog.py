from app.ids import (
    CEDAR_PROJECT_NAME,
    DEMO_PROJECT_NAME,
    DEMO_REVISION,
    DEMO_SHEET_NUMBER,
    MILL_PROJECT_NAME,
    PROJECT_CEDAR_ID,
    PROJECT_ID,
    PROJECT_MILL_ID,
    REV_CEDAR_E101_A_ID,
    REV_E101_A_ID,
    REV_MILL_E101_A_ID,
)


def test_demo_project_and_e101_rev_a(client):
    projects = client.get("/projects")
    assert projects.status_code == 200
    names = {row["name"] for row in projects.json()}
    assert DEMO_PROJECT_NAME in names
    assert CEDAR_PROJECT_NAME in names
    assert MILL_PROJECT_NAME in names

    revisions = client.get(f"/projects/{PROJECT_ID}/sheet-revisions")
    assert revisions.status_code == 200
    e101 = next(
        row
        for row in revisions.json()
        if row["sheet_number"] == DEMO_SHEET_NUMBER and row["revision"] == DEMO_REVISION
    )
    assert e101["id"] == str(REV_E101_A_ID)
    assert e101["discipline"] == "E"
    assert e101["title"] == "Sample lighting plan"
    assert e101["is_current"] is True

    drawing = client.get(f"/sheet-revisions/{REV_E101_A_ID}/drawing")
    assert drawing.status_code == 200
    assert drawing.headers["content-type"].startswith("image/png")
    assert drawing.content[:8] == b"\x89PNG\r\n\x1a\n"
    assert e101["page_width"] == 1800
    assert e101["page_height"] == 1200


def test_extra_sample_jobs_have_bundled_e101(client):
    for project_id, rev_id in (
        (PROJECT_CEDAR_ID, REV_CEDAR_E101_A_ID),
        (PROJECT_MILL_ID, REV_MILL_E101_A_ID),
    ):
        revisions = client.get(f"/projects/{project_id}/sheet-revisions")
        assert revisions.status_code == 200
        e101 = next(
            row
            for row in revisions.json()
            if row["sheet_number"] == DEMO_SHEET_NUMBER and row["revision"] == DEMO_REVISION
        )
        assert e101["id"] == str(rev_id)
        assert e101["is_current"] is True
        drawing = client.get(f"/sheet-revisions/{rev_id}/drawing")
        assert drawing.status_code == 200
        assert drawing.content[:8] == b"\x89PNG\r\n\x1a\n"

        search = client.get(
            "/search_rfis",
            params={"project_id": str(project_id), "sheet_number": DEMO_SHEET_NUMBER},
        )
        assert search.status_code == 200
        assert search.json()["count"] == 0
