"""PE-actor seed for SAMPLE weekly-log RFIs. Not submit_rfi. Not Grok."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy.orm import Session

from app.aging import utc_now
from app.ids import (
    PROJECT_ID,
    REV_S301_C_ID,
    REV_S302_A_ID,
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
from app.models import RFI, RFIEvent, RFIPin, RFIRef


def _events(rfi_id: str, chain: list[tuple[str | None, str]], at) -> list[RFIEvent]:
    rows = []
    for from_status, to_status in chain:
        rows.append(
            RFIEvent(
                rfi_id=rfi_id,
                event_type="status_change",
                from_status=from_status,
                to_status=to_status,
                payload={"actor": "pe", "source": "seed_sample", "sample": True},
                created_at=at,
            )
        )
        at = at + timedelta(hours=1)
    return rows


def _anchor(rfi_id: str, rev_id, sheet_number: str, revision: str, x: float, y: float) -> list:
    return [
        RFIRef(
            rfi_id=rfi_id,
            sheet_revision_id=str(rev_id),
            sheet_number=sheet_number,
            revision=revision,
            discipline="Structural",
        ),
        RFIPin(
            rfi_id=rfi_id,
            sheet_revision_id=str(rev_id),
            x_norm=x,
            y_norm=y,
            label="SAMPLE",
        ),
    ]


def _rfi(
    *,
    rfi_id,
    number: int | None,
    status: str,
    subject: str,
    question: str,
    priority: str,
    assigned: str,
    created_at,
    submitted_at,
    due_at,
    closed_at=None,
    official_response=None,
    rev_id,
    sheet_number: str,
    revision: str,
    pin: tuple[float, float],
    chain: list[tuple[str | None, str]],
) -> list:
    display = f"RFI-{number:04d}" if number is not None else None
    row = RFI(
        id=str(rfi_id),
        project_id=str(PROJECT_ID),
        rfi_number=number,
        rfi_display=display,
        status=status,
        subject=f"[SAMPLE] {subject}",
        question=question,
        priority=priority,
        cost_impact="possible",
        schedule_impact="possible",
        proposed_solution="SAMPLE PE row for the weekly graph. Not a live field RFI.",
        assigned=assigned,
        is_sample=True,
        due_at=due_at,
        official_response=official_response,
        submitted_at=submitted_at,
        closed_at=closed_at,
        created_at=created_at,
        updated_at=created_at,
    )
    event_at = created_at
    return [row, *_events(str(rfi_id), chain, event_at), *_anchor(
        str(rfi_id), rev_id, sheet_number, revision, pin[0], pin[1]
    )]


def seed_sample_graph_rfis(db: Session) -> None:
    if db.get(RFI, str(SAMPLE_OVERDUE_ID)):
        return

    now = utc_now()
    submit_chain = [
        (None, "draft"),
        ("draft", "internal_review"),
        ("internal_review", "submitted"),
        ("submitted", "ball_in_court"),
    ]

    rows: list = []
    rows += _rfi(
        rfi_id=SAMPLE_OVERDUE_ID,
        number=1,
        status="ball_in_court",
        subject="Overdue BIC — beam seat elevation at grid B-4",
        question="SAMPLE: Confirm beam seat elevation on S301 Rev C at grid B-4.",
        priority="standard",
        assigned="Sample AE",
        created_at=now - timedelta(days=10),
        submitted_at=now - timedelta(days=8),
        due_at=now - timedelta(hours=36),
        rev_id=REV_S301_C_ID,
        sheet_number="S301",
        revision="C",
        pin=(0.40, 0.68),
        chain=submit_chain,
    )
    rows += _rfi(
        rfi_id=SAMPLE_DUE_SOON_ID,
        number=2,
        status="ball_in_court",
        subject="Due soon — hoist opening framing on S302",
        question="SAMPLE: Confirm hoist opening header on S302 Rev A.",
        priority="urgent",
        assigned="Sample PE reviewer",
        created_at=now - timedelta(days=3),
        submitted_at=now - timedelta(days=2),
        due_at=now + timedelta(hours=6),
        rev_id=REV_S302_A_ID,
        sheet_number="S302",
        revision="A",
        pin=(0.35, 0.40),
        chain=submit_chain,
    )
    rows += _rfi(
        rfi_id=SAMPLE_WORK_STOPPED_ID,
        number=3,
        status="ball_in_court",
        subject="Work stopped — column line C embed conflict",
        question="SAMPLE: Embed at column line C conflicts with the grade beam. Work is stopped.",
        priority="work_stopped",
        assigned="Sample superintendent",
        created_at=now - timedelta(days=6),
        submitted_at=now - timedelta(days=5),
        due_at=now + timedelta(hours=3),
        rev_id=REV_S301_C_ID,
        sheet_number="S301",
        revision="C",
        pin=(0.55, 0.50),
        chain=submit_chain,
    )
    rows += _rfi(
        rfi_id=SAMPLE_CLARIFY_ID,
        number=4,
        status="needs_clarification",
        subject="Needs clarification — slab depression at dock",
        question="SAMPLE: AE asked for a field dimension before answering.",
        priority="standard",
        assigned="Castro GC (aging owner)",
        created_at=now - timedelta(days=12),
        submitted_at=now - timedelta(days=11),
        due_at=now + timedelta(days=2),
        rev_id=REV_S301_C_ID,
        sheet_number="S301",
        revision="C",
        pin=(0.70, 0.30),
        chain=submit_chain + [("ball_in_court", "needs_clarification")],
    )
    rows += _rfi(
        rfi_id=SAMPLE_IMPACT_WS_ID,
        number=5,
        status="impact_review",
        subject="Impact review — work still stopped on dock leveler pit",
        question="SAMPLE: Answer received; GC is reviewing cost/schedule. Work remains stopped.",
        priority="work_stopped",
        assigned="Castro GC",
        created_at=now - timedelta(days=14),
        submitted_at=now - timedelta(days=13),
        due_at=now - timedelta(days=4),
        rev_id=REV_S302_A_ID,
        sheet_number="S302",
        revision="A",
        pin=(0.60, 0.55),
        chain=submit_chain + [
            ("ball_in_court", "answered"),
            ("answered", "impact_review"),
        ],
    )
    rows += _rfi(
        rfi_id=SAMPLE_ANSWERED_ID,
        number=8,
        status="answered",
        subject="Answered — lintel bearing at dock door",
        question="SAMPLE: Answer is in. GC holding for impact review.",
        priority="standard",
        assigned="Castro GC",
        created_at=now - timedelta(days=9),
        submitted_at=now - timedelta(days=8),
        due_at=now - timedelta(days=1),
        official_response="SAMPLE: Use the lintel shown on S301 Rev C. An answer is not a CO.",
        rev_id=REV_S301_C_ID,
        sheet_number="S301",
        revision="C",
        pin=(0.22, 0.44),
        chain=submit_chain + [("ball_in_court", "answered")],
    )
    rows += _rfi(
        rfi_id=SAMPLE_CLOSED_ID,
        number=6,
        status="closed",
        subject="Closed — stair landing thickness",
        question="SAMPLE: Landing thickness confirmed. Closed.",
        priority="standard",
        assigned="Sample AE",
        created_at=now - timedelta(days=20),
        submitted_at=now - timedelta(days=19),
        due_at=now - timedelta(days=12),
        closed_at=now - timedelta(days=5),
        official_response="SAMPLE: Landing thickness as drawn on S301 Rev C. Not a change order.",
        rev_id=REV_S301_C_ID,
        sheet_number="S301",
        revision="C",
        pin=(0.48, 0.22),
        chain=submit_chain + [
            ("ball_in_court", "answered"),
            ("answered", "impact_review"),
            ("impact_review", "closed"),
        ],
    )
    rows += _rfi(
        rfi_id=SAMPLE_MISSING_DUE_ID,
        number=7,
        status="ball_in_court",
        subject="Missing due — masonry control joint at stair",
        question="SAMPLE: Submitted without a due date.",
        priority="standard",
        assigned="Sample AE",
        created_at=now - timedelta(days=4),
        submitted_at=now - timedelta(days=3),
        due_at=None,
        rev_id=REV_S302_A_ID,
        sheet_number="S302",
        revision="A",
        pin=(0.25, 0.62),
        chain=submit_chain,
    )
    rows += _rfi(
        rfi_id=SAMPLE_ON_CYCLE_ID,
        number=9,
        status="ball_in_court",
        subject="On cycle — roof opening curb height",
        question="SAMPLE: Due next week. Still on cycle.",
        priority="standard",
        assigned="Sample AE",
        created_at=now - timedelta(days=2),
        submitted_at=now - timedelta(days=1),
        due_at=now + timedelta(days=7),
        rev_id=REV_S302_A_ID,
        sheet_number="S302",
        revision="A",
        pin=(0.72, 0.33),
        chain=submit_chain,
    )
    rows += _rfi(
        rfi_id=SAMPLE_VOID_ID,
        number=10,
        status="void",
        subject="Void — duplicate of a withdrawn question",
        question="SAMPLE: Voided after submit. Excluded from the open graph.",
        priority="standard",
        assigned="Castro GC",
        created_at=now - timedelta(days=15),
        submitted_at=now - timedelta(days=14),
        due_at=now - timedelta(days=7),
        closed_at=now - timedelta(days=6),
        rev_id=REV_S301_C_ID,
        sheet_number="S301",
        revision="C",
        pin=(0.15, 0.18),
        chain=submit_chain + [("ball_in_court", "void")],
    )
    db.add_all(rows)
    db.commit()
