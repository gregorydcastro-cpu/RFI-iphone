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

from rfi.access import Action, ActorType, require_access
from rfi.core import (
    MATERIAL_UOMS,
    ChangeOrder,
    Event,
    MaterialLine,
    MaterialOrder,
    Pin,
    RFI,
    Store,
    WriteError,
    as_uuid,
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


def _cite_revisions(
    store: Store, rfi: RFI, pin: Pin | None
) -> tuple[UUID | None, UUID | None, UUID | None]:
    """Prefer current if pins were carried; else the pin's revision."""
    asked = pin.sheet_revision_id if pin is not None else (
        rfi.pins[0].sheet_revision_id if rfi.pins else None
    )
    current = None
    for item in rfi.pins:
        rev = store.revisions.get(item.sheet_revision_id)
        if rev is not None and rev.is_current:
            current = rev.id
    preferred = current or asked
    return preferred, asked, current or asked


def _revision_on_job(store: Store, revision_id: UUID, project_id: UUID) -> None:
    rev = store.revisions.get(revision_id)
    if rev is None:
        raise ImpactError("sheet_revision_id is not this job")
    sheet = store.sheets.get(rev.sheet_id)
    if sheet is None or sheet.project_id != project_id:
        raise ImpactError("sheet_revision_id is not this job")


def _norm_title(text: str) -> str:
    return " ".join((text or "").strip().lower().split()).rstrip(".,;:")


def _source_of(subject) -> str:
    return "grokbot" if subject.actor_type is ActorType.GROKBOT else "human"


def _force_draft(subject, status: str | None) -> str:
    if status is not None and status != "draft":
        if subject.actor_type is ActorType.GROKBOT:
            raise ImpactError("Grokbot may only write draft")
        raise ImpactError("status always draft from this handler")
    return "draft"


def _refuse_retarget(
    rfi: RFI, project_id: UUID | str | None, area_id: UUID | str | None
) -> None:
    if project_id is not None and as_uuid(project_id) != rfi.project_id:
        raise ImpactError("cannot retarget another job")
    if area_id is not None and rfi.area_id is not None and as_uuid(area_id) != rfi.area_id:
        raise ImpactError("cannot retarget another job")


def _append_note(row: ChangeOrder | MaterialOrder, note: str) -> None:
    text = (note or "").strip()
    if not text:
        return
    if row.notes and text in row.notes:
        return
    row.notes = f"{row.notes}\n{text}" if row.notes else text


def _cos_for(store: Store, rfi_id: str) -> list[ChangeOrder]:
    return [row for row in store.change_orders.values() if row.rfi_id == rfi_id]


def _mos_for(store: Store, rfi_id: str) -> list[MaterialOrder]:
    return [row for row in store.material_orders.values() if row.rfi_id == rfi_id]


def _existing_co_draft(store: Store, rfi_id: str, title: str) -> ChangeOrder | None:
    key = _norm_title(title)
    for row in _cos_for(store, rfi_id):
        if row.status == "draft" and _norm_title(row.title) == key:
            return row
    return None


def _twin_co_on_pin(
    store: Store, rfi_id: str, pin_id: str | None, title: str, description: str
) -> ChangeOrder | None:
    if pin_id is None:
        return None
    key = _norm_title(description) or _norm_title(title)
    for row in _cos_for(store, rfi_id):
        if row.status != "draft" or row.pin_id != pin_id:
            continue
        if _norm_title(row.title) == _norm_title(title) or _norm_title(row.description) == key:
            return row
    return None


def _existing_mo_draft(
    store: Store, rfi_id: str, key: str, pin_id: str | None
) -> MaterialOrder | None:
    needle = _norm_title(key)
    for row in _mos_for(store, rfi_id):
        if row.status != "draft":
            continue
        first = _norm_title(row.lines[0].description) if row.lines else _norm_title(row.sku)
        if needle and first == needle:
            return row
        if pin_id is not None and row.pin_id == pin_id:
            return row
    return None


def _as_lines(
    *,
    lines: list | None,
    sku: str | None,
    description: str | None,
    qty: float | None,
    uom: str,
) -> list[MaterialLine]:
    raw = list(lines or [])
    if not raw:
        text = (sku or description or "").strip()
        if not text:
            raise ImpactError("one impact claim: what to buy")
        raw = [{"description": text, "qty": 1.0 if qty is None else qty, "uom": uom}]
    built: list[MaterialLine] = []
    for item in raw:
        if isinstance(item, MaterialLine):
            desc, amount, unit = item.description, item.qty, item.uom
        else:
            desc = (item.get("description") or item.get("sku") or "").strip()
            amount = item.get("qty")
            unit = item.get("uom") or uom
        if not desc:
            raise ImpactError("one impact claim: what to buy")
        try:
            number = float(amount)
        except (TypeError, ValueError) as exc:
            raise ImpactError("qty must be a number") from exc
        if number <= 0:
            raise ImpactError("qty must be greater than 0")
        code = (unit or "EA").strip().upper()
        if code not in MATERIAL_UOMS:
            raise ImpactError("uom must be EA|LF|SF|BOX|SET")
        built.append(MaterialLine(description=desc, qty=number, uom=code))
    if not built:
        raise ImpactError("one impact claim: what to buy")
    return built


def _merge_lines(row: MaterialOrder, incoming: list[MaterialLine]) -> None:
    seen = {_norm_title(line.description) for line in row.lines}
    for line in incoming:
        if _norm_title(line.description) in seen:
            continue
        row.lines.append(line)
        seen.add(_norm_title(line.description))
    if row.lines:
        row.sku = row.lines[0].description
        row.qty = row.lines[0].qty


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


def _ensure_review(store: Store, rfi: RFI, *, actor_id: UUID | None = None) -> None:
    """First successful draft moves answered → impact_review. No due_at rewrite."""
    _assert_draftable(rfi)
    if rfi.status == "impact_review":
        return
    stopped = rfi.work_stopped
    due = rfi.due_at
    number = rfi.rfi_number
    store.add_event(
        Event(
            rfi_id=rfi.id,
            event_type="impact_started",
            from_status=rfi.status,
            to_status="impact_review",
            actor_id=actor_id,
        )
    )
    rfi.status = "impact_review"
    if rfi.work_stopped != stopped or rfi.due_at != due or rfi.rfi_number != number:
        raise ImpactError("impact review must not rewrite the pair, due, or number")


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
    description: str | None = None,
    title: str | None = None,
    qty: float | None = None,
    rough_qty: float | None = None,
    cost_code: str | None = None,
    pin_id: str | None = None,
    sheet_revision_id: UUID | None = None,
    project_id: UUID | str | None = None,
    area_id: UUID | str | None = None,
    status: str | None = None,
) -> ChangeOrder:
    """Child of an answered RFI. Scope/method only. Search before insert."""
    rfi = store.get_rfi(rfi_id)
    require_access(subject, Action.DRAFT_CHANGE_ORDER, resource_for(rfi))
    _assert_draftable(rfi)
    _refuse_retarget(rfi, project_id, area_id)
    _force_draft(subject, status)
    if description is not None and not description.strip():
        raise ImpactError("description is empty")
    heading = _one_change(title or description or "")
    body = (description or title or "").strip()
    if not body:
        raise ImpactError("description is empty")
    if sheet_revision_id is not None:
        _revision_on_job(store, as_uuid(sheet_revision_id), rfi.project_id)
    _ensure_review(store, rfi, actor_id=subject.user_id)
    existing = _existing_co_draft(store, rfi.id, heading)
    pin = _pin_by_id(rfi, pin_id)
    if existing is None:
        existing = _twin_co_on_pin(
            store, rfi.id, pin.id if pin else None, heading, body
        )
    if existing is not None:
        _append_note(existing, body if _norm_title(body) != _norm_title(existing.description) else "repeat draft")
        return existing
    preferred, asked, current = _cite_revisions(store, rfi, pin)
    if preferred is not None:
        _revision_on_job(store, preferred, rfi.project_id)
    estimate = rough_qty if rough_qty is not None else qty
    row = ChangeOrder(
        id=str(uuid4()),
        rfi_id=rfi.id,
        project_id=rfi.project_id,
        area_id=rfi.area_id,
        title=heading,
        description=body,
        cost_code=(cost_code or "").strip() or None,
        rough_qty=estimate,
        qty=estimate,
        status="draft",
        source=_source_of(subject),
        sheet_revision_id=preferred,
        asked_revision_id=asked,
        current_revision_id=current,
        pin_id=pin.id if pin else None,
        co_number=None,
    )
    store.change_orders[row.id] = row
    _mark_impact(rfi, IMPACT_CHANGE)
    store.add_event(
        Event(
            rfi_id=rfi.id,
            event_type="co_drafted",
            actor_id=subject.user_id,
            from_revision_id=asked,
            to_revision_id=preferred,
        )
    )
    return row


def draft_material_order(
    store: Store,
    subject,
    rfi_id: str,
    *,
    sku: str | None = None,
    description: str | None = None,
    qty: float | None = None,
    uom: str = "EA",
    lines: list | None = None,
    area_id: UUID | str | None = None,
    pin_id: str | None = None,
    sheet_revision_id: UUID | None = None,
    project_id: UUID | str | None = None,
    status: str | None = None,
) -> MaterialOrder:
    """Child buy list. Draft only. Same gate and search-before-insert as the CO."""
    rfi = store.get_rfi(rfi_id)
    require_access(subject, Action.DRAFT_MATERIAL_ORDER, resource_for(rfi))
    _assert_draftable(rfi)
    _refuse_retarget(rfi, project_id, area_id)
    _force_draft(subject, status)
    built = _as_lines(
        lines=lines, sku=sku, description=description, qty=qty, uom=uom
    )
    if sheet_revision_id is not None:
        _revision_on_job(store, as_uuid(sheet_revision_id), rfi.project_id)
    _ensure_review(store, rfi, actor_id=subject.user_id)
    pin = _pin_by_id(rfi, pin_id)
    key = built[0].description
    existing = _existing_mo_draft(store, rfi.id, key, pin.id if pin else None)
    if existing is not None:
        _merge_lines(existing, built)
        _append_note(existing, "repeat draft")
        return existing
    preferred, asked, current = _cite_revisions(store, rfi, pin)
    if preferred is not None:
        _revision_on_job(store, preferred, rfi.project_id)
    row = MaterialOrder(
        id=str(uuid4()),
        rfi_id=rfi.id,
        project_id=rfi.project_id,
        lines=built,
        sku=built[0].description,
        qty=built[0].qty,
        status="draft",
        source=_source_of(subject),
        area_id=rfi.area_id,
        sheet_revision_id=preferred,
        asked_revision_id=asked,
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
            to_revision_id=preferred,
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
