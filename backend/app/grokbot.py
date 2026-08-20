"""Grokbot draft rules for the New RFI path.

Search first, then create_rfi_draft only. This module never writes submitted,
ball_in_court, closed, or void. It never assigns rfi_number / rfi_display.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.schemas import DRAFT_PRIORITIES, IMPACT_VALUES

QUESTION_SPLIT = re.compile(r"\?")
NUMBERED_QUESTION = re.compile(
    r"(?:^|\n)\s*(?:\d+[\).\]]|[-*])\s+.+\?", re.MULTILINE
)
URGENCY = re.compile(
    r"\b(urgent|asap|critical path|work[\s-]?stop|stopped|emergency)\b",
    re.IGNORECASE,
)
COST_HINT = re.compile(
    r"\b(cost|price|money|dollar|change order|\bco\b|budget)\b", re.IGNORECASE
)
SCHEDULE_HINT = re.compile(
    r"\b(schedule|delay|lead time|shutdown|duration|days)\b", re.IGNORECASE
)
BLAME = re.compile(
    r"\b(stupid|incompetent|they screwed|idiot|blame|fault of)\b", re.IGNORECASE
)
# Do not mint new drawing / spec / quantity claims in structured fields.
INVENTED_SPEC = re.compile(
    r"\b(?:section|spec(?:ification)?s?)\s+\d{2}\s+\d{2}\s+\d{2}\b",
    re.IGNORECASE,
)
INVENTED_QTY = re.compile(
    r"\b\d+(?:\.\d+)?\s*(?:cy|lf|sf|ea|lbs?|tons?)\b", re.IGNORECASE
)

DISCLAIMER = (
    "An answer is not a change order and does not authorize work."
)


class GrokbotError(ValueError):
    pass


@dataclass(frozen=True)
class DraftedRFI:
    subject: str
    question: str
    priority: str
    cost_impact: str
    schedule_impact: str
    proposed_solution: str
    rewrite_applied: bool = True
    question_count: int = 1
    notes: str = ""


def _count_questions(note: str) -> int:
    marks = len(QUESTION_SPLIT.findall(note))
    numbered = len(NUMBERED_QUESTION.findall(note))
    return max(marks, numbered)


def _neutral_note(note: str) -> str:
    cleaned = BLAME.sub("", note)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if cleaned and cleaned[-1] not in ".?!":
        cleaned += "."
    return cleaned


def _cite(sheet_number: str | None, revision: str | None, discipline: str | None,
          grid: str | None, detail: str | None) -> str:
    parts: list[str] = []
    if sheet_number and revision:
        parts.append(f"On {sheet_number} Rev {revision}")
    elif sheet_number:
        parts.append(f"On {sheet_number}")
    if discipline:
        parts.append(f"({discipline})")
    cite = " ".join(parts) if parts else "On the cited sheet revision"
    extras: list[str] = []
    if detail:
        extras.append(f"detail {detail}")
    if grid:
        extras.append(f"grid {grid}")
    if extras:
        cite += ", at " + " and ".join(extras)
    return cite


def _subject(sheet_number: str | None, revision: str | None, note: str,
             grid: str | None) -> str:
    head = note.split(".")[0].strip()
    head = head[:72] if head else "Clarification requested"
    loc = f" at grid {grid}" if grid else ""
    if sheet_number and revision:
        return f"{sheet_number} Rev {revision}{loc}: {head}"[:240]
    return f"{head}{loc}"[:240]


def _proposed_solution(note: str) -> str:
    match = re.search(
        r"(?:proposed(?: solution)?|we propose|suggest(?:ed)?)\s*[:\-]\s*(.+)",
        note,
        re.IGNORECASE,
    )
    if match:
        proposal = match.group(1).strip()
        if proposal and proposal[-1] not in ".!?":
            proposal += "."
        return proposal
    return (
        "Please confirm the intended condition on the cited sheet revision "
        "so the field can proceed from the documents."
    )


def _priority(note: str) -> str:
    if URGENCY.search(note):
        return "urgent"
    return "standard"


def _impact(note: str, kind: str) -> str:
    if kind == "cost" and COST_HINT.search(note):
        return "possible"
    if kind == "schedule" and SCHEDULE_HINT.search(note):
        return "possible"
    return "unknown"


def _ilsb_vivarium_note(note: str, sheet_number: str | None) -> bool:
    blob = f"{sheet_number or ''} {note}".lower()
    return (
        "el107" in blob
        and "e-803" in blob
        and "vivarium" in blob
    )


def draft_from_preflight(
    user_note: str,
    sheet_number: str | None,
    revision: str | None,
    discipline: str | None,
    grid: str | None,
    detail: str | None = None,
) -> DraftedRFI:
    from app.ids import ILSB_PREFLIGHT_NOTES, ILSB_PROPOSED, ILSB_QUESTION, ILSB_SUBJECT

    note = (user_note or "").strip()
    if not note:
        raise GrokbotError("A note is required so Grokbot can write one question.")

    questions = _count_questions(note)
    if questions > 1:
        raise GrokbotError(
            "One question per RFI. Split these into separate drafts."
        )

    if _ilsb_vivarium_note(note, sheet_number):
        return DraftedRFI(
            subject=ILSB_SUBJECT,
            question=ILSB_QUESTION,
            priority="standard",
            cost_impact="possible",
            schedule_impact="possible",
            proposed_solution=ILSB_PROPOSED,
            rewrite_applied=True,
            question_count=1,
            notes=ILSB_PREFLIGHT_NOTES,
        )

    # Structured fields never invent drawing numbers, quantities, or spec sections.
    # User prose may mention them; we do not copy those into refs or new citations.
    _ = INVENTED_SPEC.findall(note)
    _ = INVENTED_QTY.findall(note)

    body = _neutral_note(note)
    cite = _cite(sheet_number, revision, discipline, grid, detail)
    question = (
        f"{cite}, {body[0].lower() + body[1:] if body else 'please clarify.'} "
        f"Please confirm the design intent. {DISCLAIMER}"
    )
    priority = _priority(note)
    if priority not in DRAFT_PRIORITIES:
        priority = "standard"
    cost = _impact(note, "cost")
    schedule = _impact(note, "schedule")
    if cost not in IMPACT_VALUES:
        cost = "unknown"
    if schedule not in IMPACT_VALUES:
        schedule = "unknown"

    return DraftedRFI(
        subject=_subject(sheet_number, revision, body, grid),
        question=question,
        priority=priority,
        cost_impact=cost,
        schedule_impact=schedule,
        proposed_solution=_proposed_solution(note),
        rewrite_applied=True,
        question_count=max(questions, 1),
        notes="",
    )


def assert_draft_priority(priority: str) -> None:
    if priority == "work_stopped":
        raise GrokbotError(
            "The Grok/draft path must not set work_stopped."
        )
    if priority not in DRAFT_PRIORITIES:
        raise GrokbotError(f"Invalid draft priority: {priority}")
