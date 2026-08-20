"""Impact review. After design answers, before close. Drafts only.

answered → impact_review → closed
                ↘ draft_change_order
                ↘ draft_material_order

Grokbot may draft CO/MO. Cannot enter, submit, or close.
Drafts are legal from answered or impact_review. work_stopped does not
block a draft. One change per CO row; many COs may hang on one RFI.
"""

from __future__ import annotations

from uuid import UUID, uuid4

from rfi.access import Action, require_access
from rfi.core import (
    ChangeOrder,
    Event,
    MaterialOrder,
    Pin,
    RFI,
    Store,
    WriteError,
    resource_for,
)

IMPACT_NONE = "none"
IMPACT_CHANGE = "change"
IMPACT_MATERIAL = "material"
IMPACT_BOTH = "both"
DRAFTABLE = frozenset({"answered", "impact_review"})
_CHANGE_CUES = (
    "different ",
    "move ",
    "relocate ",
    "reroute ",
    "replace ",
    "add ",
    "remove ",
    "change ",
    "install ",
    "new ",
)


class ImpactError(WriteError):
    pass


def record_answer(store: Store, rfi_id: str, response: str) -> RFI:
    """Design writes the answer. Not a Grok tool. Does not enter review or close."""
    rfi = store.get_rfi(rfi_id)
    if rfi.status == "ball_in_court" or rfi.status == "submitted":
        text = (response or "").strip()
        if not text:
            raise ImpactError("official response is required")
        rfi.official_response = text
        store.add_event(
            Event(
                rfi_id=rfi.id,
                event_type="status_change",
                from_status=rfi.status,
                to_status="answered",
            )
        )
        rfi.status = "answered"
        return rfi
    raise ImpactError("record_answer is for ball_in_court or submitted")


def _cite_revisions(store: Store, rfi: RFI) -> tuple[UUID | None, UUID | None]:
    """Asked print first. Current print if a pin was carried."""
    if not rfi.pins:
        return None, None
    asked = rfi.pins[0].sheet_revision_id
    current = None
    for pin in rfi.pins:
        rev = store.revisions.get(pin.sheet_revision_id)
        if rev is not None and rev.is_current:
            current = rev.id
    return asked, current or asked


def _pin_by_id(rfi: RFI, pin_id: str | None) -> Pin | None:
    if pin_id is None:
        return rfi.pins[0] if rfi.pins else None
    for pin in rfi.pins:
        if pin.id == pin_id:
            return pin
    raise ImpactError("pin not on this RFI")


def _mark_impact(rfi: RFI, kind: str) -> None:
    if rfi.impact in (None, IMPACT_NONE) or rfi.impact == kind:
        rfi.impact = kind
        return
    rfi.impact = IMPACT_BOTH


def _assert_draftable(rfi: RFI) -> None:
    """answered and impact_review are both legal. ball_in_court is not."""
    if rfi.status not in DRAFTABLE:
        raise ImpactError("drafts only from answered or impact_review")


def _has_change_cue(part: str) -> bool:
    text = f"{part.strip()} "
    return any(cue in text for cue in _CHANGE_CUES)


def _one_change(description: str) -> str:
    """One scope change per row. Same idea as one question per RFI."""
    text = (description or "").strip()
    if not text:
        raise ImpactError("one change")
    if text.count("?") > 1:
        raise ImpactError("one change")
    if ";" in text or ". " in text.rstrip("."):
        raise ImpactError("one change per draft")
    lower = text.lower()
    if " and " in lower:
        left, right = lower.split(" and ", 1)
        if _has_change_cue(left) and _has_change_cue(right):
            raise ImpactError("one change per draft")
    return text


def _ensure_review(store: Store, rfi: RFI) -> None:
    """First draft may move answered → impact_review. Enter may do it instead."""
    _assert_draftable(rfi)
    if rfi.status == "impact_review":
        return
    store.add_event(
        Event(
            rfi_id=rfi.id,
            event_type="impact_started",
            from_status=rfi.status,
            to_status="impact_review",
        )
    )
    rfi.status = "impact_review"


def enter_impact_review(store: Store, subject, rfi_id: str) -> RFI:
    """Only from answered. Not from ball_in_court. Does not clear work_stopped."""
    rfi = store.get_rfi(rfi_id)
    require_access(subject, Action.ENTER_IMPACT_REVIEW, resource_for(rfi))
    if rfi.status != "answered":
        raise ImpactError("enter_impact_review is only from answered")
    stopped = rfi.work_stopped
    due = rfi.due_at
    number = rfi.rfi_number
    store.add_event(
        Event(
            rfi_id=rfi.id,
            event_type="impact_started",
            from_status=rfi.status,
            to_status="impact_review",
            actor_id=subject.user_id,
        )
    )
    rfi.status = "impact_review"
    if rfi.work_stopped != stopped or rfi.due_at != due or rfi.rfi_number != number:
        raise ImpactError("impact review must not rewrite the pair, due, or number")
    return rfi


def suggest_impact_none(store: Store, subject, rfi_id: str) -> RFI:
    """Grokbot may suggest. Does not close. A human confirms."""
    rfi = store.get_rfi(rfi_id)
    require_access(subject, Action.DRAFT_CHANGE_ORDER, resource_for(rfi))
    if rfi.status == "answered":
        _ensure_review(store, rfi)
    if rfi.status != "impact_review":
        raise ImpactError("suggest_impact_none is for answered or impact_review")
    rfi.impact_none_suggested = True
    store.add_event(
        Event(
            rfi_id=rfi.id,
            event_type="impact_none",
            kind="suggested",
            actor_id=subject.user_id,
        )
    )
    return rfi


def draft_change_order(
    store: Store,
    subject,
    rfi_id: str,
    *,
    description: str,
    qty: float | None = None,
    pin_id: str | None = None,
) -> ChangeOrder:
    """Draft only. Never submitted. work_stopped does not block. One change."""
    rfi = store.get_rfi(rfi_id)
    require_access(subject, Action.DRAFT_CHANGE_ORDER, resource_for(rfi))
    _assert_draftable(rfi)
    claim = _one_change(description)
    _ensure_review(store, rfi)
    asked, current = _cite_revisions(store, rfi)
    pin = _pin_by_id(rfi, pin_id)
    row = ChangeOrder(
        id=str(uuid4()),
        rfi_id=rfi.id,
        description=claim,
        qty=qty,
        status="draft",
        sheet_revision_id=asked,
        current_revision_id=current,
        pin_id=pin.id if pin else None,
    )
    store.change_orders[row.id] = row
    _mark_impact(rfi, IMPACT_CHANGE)
    store.add_event(
        Event(
            rfi_id=rfi.id,
            event_type="co_drafted",
            actor_id=subject.user_id,
            from_revision_id=asked,
            to_revision_id=current,
        )
    )
    return row


def draft_material_order(
    store: Store,
    subject,
    rfi_id: str,
    *,
    sku: str,
    qty: float,
    area_id: UUID | None = None,
    pin_id: str | None = None,
) -> MaterialOrder:
    """Draft only. Never a PO. work_stopped does not block. Cites revisions."""
    rfi = store.get_rfi(rfi_id)
    require_access(subject, Action.DRAFT_MATERIAL_ORDER, resource_for(rfi))
    _assert_draftable(rfi)
    part = (sku or "").strip()
    if not part:
        raise ImpactError("one impact claim: what to buy")
    _ensure_review(store, rfi)
    asked, current = _cite_revisions(store, rfi)
    pin = _pin_by_id(rfi, pin_id)
    row = MaterialOrder(
        id=str(uuid4()),
        rfi_id=rfi.id,
        sku=part,
        qty=float(qty),
        status="draft",
        area_id=area_id if area_id is not None else rfi.area_id,
        sheet_revision_id=asked,
        current_revision_id=current,
        pin_id=pin.id if pin else None,
    )
    store.material_orders[row.id] = row
    _mark_impact(rfi, IMPACT_MATERIAL)
    store.add_event(
        Event(
            rfi_id=rfi.id,
            event_type="mo_drafted",
            actor_id=subject.user_id,
            from_revision_id=asked,
            to_revision_id=current,
        )
    )
    return row


def _children(store: Store, rfi_id: str) -> tuple[list[ChangeOrder], list[MaterialOrder]]:
    cos = [row for row in store.change_orders.values() if row.rfi_id == rfi_id]
    mos = [row for row in store.material_orders.values() if row.rfi_id == rfi_id]
    return cos, mos


def close_rfi(
    store: Store, subject, rfi_id: str, *, impact_none: bool = False
) -> RFI:
    """Human only. Not leftover drafts. Not while work_stopped. Children stay draft."""
    rfi = store.get_rfi(rfi_id)
    require_access(subject, Action.CLOSE_RFI, resource_for(rfi))
    if rfi.status != "impact_review":
        raise ImpactError("close_rfi is only from impact_review")
    if rfi.rfi_number is None:
        raise ImpactError("leftover draft RFIs are a different ticket")
    if rfi.work_stopped:
        raise ImpactError("clear work_stopped in set_priority before close")
    if impact_none:
        if rfi.impact in {IMPACT_CHANGE, IMPACT_MATERIAL, IMPACT_BOTH}:
            raise ImpactError("impact is not none")
        rfi.impact = IMPACT_NONE
        store.add_event(
            Event(
                rfi_id=rfi.id,
                event_type="impact_none",
                kind="confirmed",
                actor_id=subject.user_id,
            )
        )
    kind = rfi.impact
    if kind is None and rfi.impact_none_suggested:
        raise ImpactError("impact_none is a suggestion; a human must confirm")
    if kind is None:
        raise ImpactError("mark impact none, change, material, or both")
    cos, mos = _children(store, rfi.id)
    if kind in {IMPACT_CHANGE, IMPACT_BOTH} and not cos:
        raise ImpactError("change impact requires a drafted change order")
    if kind in {IMPACT_MATERIAL, IMPACT_BOTH} and not mos:
        raise ImpactError("material impact requires a drafted material order")
    if any(row.status != "draft" for row in cos + mos):
        raise ImpactError("impact review writes drafts only")
    store.add_event(
        Event(
            rfi_id=rfi.id,
            event_type="closed",
            from_status=rfi.status,
            to_status="closed",
            actor_id=subject.user_id,
        )
    )
    rfi.status = "closed"
    return rfi
