"""Revision compare / carry-forward. A new print does not spawn RFIs.

compare_revisions decides which pins move. apply_carry_forward copies
x/y onto the new rev and writes pin_carried. Drafts stay leftover.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from rfi.core import Event, Pin, RFI, Store, WriteError, as_uuid

# Open on the main machine, internal_review through impact_review.
# needs_clarification is still open work. Drafts are leftover, not carried.
CARRY_STATUSES = frozenset(
    {
        "internal_review",
        "submitted",
        "ball_in_court",
        "answered",
        "impact_review",
        "needs_clarification",
    }
)
STAY_STATUSES = frozenset({"closed", "void"})
LEFTOVER_STATUSES = frozenset({"draft"})
SEARCH_OPEN = CARRY_STATUSES | LEFTOVER_STATUSES


class CompareError(WriteError):
    pass


@dataclass
class PinDecision:
    rfi_id: str
    from_revision_id: UUID
    to_revision_id: UUID
    x: float
    y: float
    label: str | None
    action: str


@dataclass
class RevisionDiff:
    from_revision_id: UUID
    to_revision_id: UUID
    sheet_id: UUID
    carry: list[PinDecision] = field(default_factory=list)
    leftover: list[PinDecision] = field(default_factory=list)
    stay: list[PinDecision] = field(default_factory=list)
    skip: list[PinDecision] = field(default_factory=list)


def _pin_on_rev(rfi: RFI, revision_id: UUID) -> Pin | None:
    for pin in rfi.pins:
        if pin.sheet_revision_id == revision_id:
            return pin
    return None


def compare_revisions(
    store: Store, rev_a_id: UUID | str, rev_b_id: UUID | str
) -> RevisionDiff:
    """Same sheet only. One RFI row. Pins are per revision."""
    old = store.get_revision(rev_a_id)
    new = store.get_revision(rev_b_id)
    if old.sheet_id != new.sheet_id:
        raise CompareError("same sheet only")
    diff = RevisionDiff(
        from_revision_id=old.id,
        to_revision_id=new.id,
        sheet_id=old.sheet_id,
    )
    for rfi in store.rfis.values():
        pin = _pin_on_rev(rfi, old.id)
        if pin is None:
            continue
        decision = PinDecision(
            rfi_id=rfi.id,
            from_revision_id=old.id,
            to_revision_id=new.id,
            x=pin.x,
            y=pin.y,
            label=pin.label,
            action="carry",
        )
        if _pin_on_rev(rfi, new.id) is not None:
            decision.action = "skip"
            diff.skip.append(decision)
            continue
        if rfi.status in LEFTOVER_STATUSES or rfi.rfi_number is None:
            decision.action = "leftover"
            diff.leftover.append(decision)
            continue
        if rfi.status in STAY_STATUSES:
            decision.action = "stay"
            diff.stay.append(decision)
            continue
        if rfi.status in CARRY_STATUSES:
            decision.action = "carry"
            diff.carry.append(decision)
            continue
        decision.action = "stay"
        diff.stay.append(decision)
    return diff


def apply_carry_forward(
    store: Store, diff: RevisionDiff, *, actor_id: UUID
) -> list[Pin]:
    """Copy carry pins onto the new rev. Write pin_carried. Second run is a no-op."""
    copied: list[Pin] = []
    for item in diff.carry:
        rfi = store.get_rfi(item.rfi_id)
        if _pin_on_rev(rfi, diff.to_revision_id) is not None:
            continue
        if any(
            event.event_type == "pin_carried"
            and event.rfi_id == rfi.id
            and event.from_revision_id == diff.from_revision_id
            and event.to_revision_id == diff.to_revision_id
            for event in store.events
        ):
            continue
        pin = Pin(
            sheet_revision_id=diff.to_revision_id,
            x=item.x,
            y=item.y,
            label=item.label,
        )
        rfi.pins.append(pin)
        store.add_event(
            Event(
                rfi_id=rfi.id,
                event_type="pin_carried",
                actor_id=actor_id,
                from_revision_id=diff.from_revision_id,
                to_revision_id=diff.to_revision_id,
            )
        )
        copied.append(pin)
    return copied


def search_open_on_sheet(store: Store, sheet_id: UUID | str) -> list[RFI]:
    """Grokbot preflight before another draft. Includes leftover drafts."""
    wanted = as_uuid(sheet_id)
    rev_ids = {
        row.id for row in store.revisions.values() if row.sheet_id == wanted
    }
    found: list[RFI] = []
    for rfi in store.rfis.values():
        if rfi.status not in SEARCH_OPEN:
            continue
        if any(pin.sheet_revision_id in rev_ids for pin in rfi.pins):
            found.append(rfi)
    return found
