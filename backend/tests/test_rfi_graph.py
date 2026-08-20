from datetime import timedelta

from app.aging import age_bucket, days_open, utc_now
from app.ids import (
    ILSB_PROJECT_ID,
    ILSB_RFI_ID,
    ILSB_SUBJECT,
    SAMPLE_ANSWERED_ID,
    SAMPLE_CLARIFY_ID,
    SAMPLE_CLOSED_ID,
    SAMPLE_DUE_SOON_ID,
    SAMPLE_IMPACT_WS_ID,
    SAMPLE_MISSING_DUE_ID,
    SAMPLE_ON_CYCLE_ID,
    SAMPLE_OVERDUE_ID,
    SAMPLE_VOID_ID,
    SAMPLE_WORK_STOPPED_ID,
)


def test_drafts_and_terminal_excluded_from_open_graph(client):
    graph = client.get("/rfi_graph").json()
    open_ids = {row["id"] for row in graph["open"]}
    draft_ids = {row["id"] for row in graph["drafts"]}
    assert str(ILSB_RFI_ID) not in open_ids
    assert str(ILSB_RFI_ID) in draft_ids
    assert str(SAMPLE_CLOSED_ID) not in open_ids
    assert str(SAMPLE_VOID_ID) not in open_ids
    assert graph["closed_or_void_count"] >= 2


def test_e803_draft_still_unnumbered(client):
    draft = next(row for row in client.get("/rfi_graph").json()["drafts"] if row["id"] == str(ILSB_RFI_ID))
    assert draft["status"] == "draft"
    assert draft["rfi_display"] is None
    assert draft["rfi_number"] is None
    assert draft["subject"] == ILSB_SUBJECT
    assert draft["is_sample"] is False
    assert draft["project_id"] == str(ILSB_PROJECT_ID)
    assert draft["sheet_number"] == "EL107_N"

    detail = client.get(f"/rfis/{ILSB_RFI_ID}").json()
    assert detail["rfi_display"] is None
    assert detail["status"] == "draft"


def test_sample_rows_have_numbers_only_after_submit(client):
    graph = client.get("/rfi_graph").json()
    for row in graph["open"]:
        if row["is_sample"]:
            assert row["rfi_display"]
            assert row["rfi_display"].startswith("RFI-")
            assert row["rfi_number"] is not None
            assert "[SAMPLE]" in row["subject"]
    for row in graph["drafts"]:
        if not row["is_sample"]:
            assert row["rfi_display"] is None


def test_work_stopped_sorts_first(client):
    graph = client.get("/rfi_graph").json()
    assert graph["ok"] is True
    open_rows = graph["open"]
    assert open_rows
    assert open_rows[0]["age_bucket"] == "work_stopped"
    assert open_rows[0]["work_stopped"] is True
    assert open_rows[0]["priority"] == "work_stopped"
    buckets = [row["age_bucket"] for row in open_rows]
    ranks = {name: i for i, name in enumerate(graph["bucket_order"])}
    assert buckets == sorted(buckets, key=lambda name: ranks[name])


def test_sample_buckets_cover_required_cases(client):
    graph = client.get("/rfi_graph").json()
    by_id = {row["id"]: row for row in graph["open"]}
    overdue = by_id[str(SAMPLE_OVERDUE_ID)]
    assert overdue["status"] == "ball_in_court"
    assert overdue["priority"] == "standard"
    assert overdue["age_bucket"] == "overdue"
    assert overdue["work_stopped"] is False

    soon = by_id[str(SAMPLE_DUE_SOON_ID)]
    assert soon["priority"] == "urgent"
    assert soon["age_bucket"] == "due_soon"

    stopped = by_id[str(SAMPLE_WORK_STOPPED_ID)]
    assert stopped["priority"] == "work_stopped"
    assert stopped["work_stopped"] is True
    assert stopped["age_bucket"] == "work_stopped"
    assert stopped["status"] == "ball_in_court"

    clarify = by_id[str(SAMPLE_CLARIFY_ID)]
    assert clarify["status"] == "needs_clarification"
    assert clarify["age_bucket"] == "gc_holding"

    impact = by_id[str(SAMPLE_IMPACT_WS_ID)]
    assert impact["status"] == "impact_review"
    assert impact["work_stopped"] is True
    assert impact["age_bucket"] == "work_stopped"

    answered = by_id[str(SAMPLE_ANSWERED_ID)]
    assert answered["status"] == "answered"
    assert answered["age_bucket"] == "gc_holding"
    assert answered["work_stopped"] is False

    missing = by_id[str(SAMPLE_MISSING_DUE_ID)]
    assert missing["due_at"] is None
    assert missing["age_bucket"] == "missing_due"

    cycle = by_id[str(SAMPLE_ON_CYCLE_ID)]
    assert cycle["age_bucket"] == "on_cycle"

    counts = graph["bucket_counts"]
    assert counts["work_stopped"] >= 2
    assert counts["overdue"] >= 1
    assert counts["due_soon"] >= 1
    assert counts["gc_holding"] >= 2
    assert counts["missing_due"] >= 1
    assert counts["on_cycle"] >= 1


def test_graph_can_filter_ilsb_and_keeps_machine_sample(client):
    ils = client.get("/rfi_graph", params={"project_id": str(ILSB_PROJECT_ID)}).json()
    assert all(row["status"] != "draft" for row in ils["open"])
    assert any(row["id"] == str(ILSB_RFI_ID) for row in ils["drafts"])
    assert ils["status_machine"]["main"][0] == "draft"
    assert "needs_clarification" in ils["status_machine"]["branches"]
    assert "void" in ils["status_machine"]["branches"]
    assert ils["timezone"] == "UTC"
    assert "business days" in ils["days_open_rule"]


def test_days_open_is_calendar_floor_hours(client):
    now = utc_now()
    assert days_open(now - timedelta(hours=23), now) == 0
    assert days_open(now - timedelta(hours=25), now) == 1
    overdue = age_bucket(
        status="ball_in_court",
        priority="standard",
        due_at=now - timedelta(hours=36),
        now=now,
    )
    assert overdue == "overdue"
    escalated = age_bucket(
        status="ball_in_court",
        priority="standard",
        due_at=now - timedelta(hours=80),
        now=now,
    )
    assert escalated == "escalated"
    stopped = age_bucket(
        status="ball_in_court",
        priority="work_stopped",
        due_at=now - timedelta(hours=1),
        now=now,
    )
    assert stopped == "work_stopped"
    assert age_bucket(status="draft", priority="standard", due_at=None, now=now) is None
    assert age_bucket(status="closed", priority="standard", due_at=None, now=now) is None
    assert age_bucket(status="void", priority="standard", due_at=None, now=now) is None


def test_search_hides_sample_rows_by_default(client):
    hidden = client.get(
        "/search_rfis",
        params={"project_id": "aaaaaaaa-0000-4000-8000-000000000010"},
    ).json()
    assert hidden["count"] == 0
    shown = client.get(
        "/search_rfis",
        params={
            "project_id": "aaaaaaaa-0000-4000-8000-000000000010",
            "exclude_sample": False,
        },
    ).json()
    assert shown["count"] >= 1
