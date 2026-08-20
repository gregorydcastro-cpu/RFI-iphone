from app.ids import PROJECT_ID, REV_S301_C_ID


def test_demo_project_and_s301_rev_c(client):
    projects = client.get("/projects")
    assert projects.status_code == 200
    names = {row["name"] for row in projects.json()}
    assert "Harbor Yard Warehouse" in names

    revisions = client.get(f"/projects/{PROJECT_ID}/sheet-revisions")
    assert revisions.status_code == 200
    s301c = next(
        row
        for row in revisions.json()
        if row["sheet_number"] == "S301" and row["revision"] == "C"
    )
    assert s301c["id"] == str(REV_S301_C_ID)
    assert s301c["discipline"] == "Structural"

    drawing = client.get(f"/sheet-revisions/{REV_S301_C_ID}/drawing")
    assert drawing.status_code == 200
    assert drawing.headers["content-type"].startswith("image/png")
    assert drawing.content[:8] == b"\x89PNG\r\n\x1a\n"
