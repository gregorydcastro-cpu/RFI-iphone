"""In-memory RFI store and the five hung pieces. No Postgres."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from rfi.access import (
    Action,
    ActorType,
    AccessDenied,
    Env,
    Resource,
    Role,
    Subject,
    require_access,
)

WORK_STOPPED = "work_stopped"
ALLOWED_PRIORITIES = ("standard", "urgent", WORK_STOPPED)
DRAFT_PRIORITIES = ("standard", "urgent")
PRIORITY_RANK = {"standard": 0, "urgent": 1, WORK_STOPPED: 2}
SLA = {
    "standard": timedelta(days=7),
    "urgent": timedelta(hours=72),
    WORK_STOPPED: timedelta(hours=24),
}
SUBMITTABLE = frozenset({"draft", "internal_review", "needs_clarification"})
WAITING_ON_DESIGN = frozenset({"submitted", "ball_in_court"})
GC_HOLDING = frozenset({"answered", "impact_review", "needs_clarification"})
ESCALATE_AFTER_HOURS = {"standard": 48, "urgent": 12, WORK_STOPPED: 0}


class WriteError(ValueError):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def pair_holds(priority: str, work_stopped: bool) -> bool:
    return bool(work_stopped) is (priority == WORK_STOPPED)


@dataclass
class Job:
    id: UUID
    requires_internal_review: bool = False


@dataclass
class Event:
    rfi_id: str
    event_type: str
    kind: str | None = None
    from_status: str | None = None
    to_status: str | None = None
    due_at: datetime | None = None
    at: datetime | None = None
    actor_id: UUID | None = None
    from_revision_id: UUID | None = None
    to_revision_id: UUID | None = None


@dataclass
class Sheet:
    id: UUID
    project_id: UUID
    sheet_number: str
    title: str = ""
    discipline: str = ""


@dataclass
class SheetRevision:
    id: UUID
    sheet_id: UUID
    revision: str
    is_current: bool = False


@dataclass
class ChangeOrder:
    id: str
    rfi_id: str
    project_id: UUID
    title: str
    description: str
    area_id: UUID | None = None
    cost_code: str | None = None
    rough_qty: float | None = None
    qty: float | None = None
    status: str = "draft"
    source: str = "human"
    sheet_revision_id: UUID | None = None
    asked_revision_id: UUID | None = None
    current_revision_id: UUID | None = None
    pin_id: str | None = None
    notes: str | None = None
    co_number: int | None = None


MATERIAL_UOMS = frozenset({"EA", "LF", "SF", "BOX", "SET"})


@dataclass
class MaterialLine:
    description: str
    qty: float
    uom: str = "EA"


@dataclass
class MaterialOrder:
    id: str
    rfi_id: str
    project_id: UUID
    lines: list[MaterialLine] = field(default_factory=list)
    sku: str = ""
    qty: float = 0.0
    status: str = "draft"
    source: str = "human"
    area_id: UUID | None = None
    sheet_revision_id: UUID | None = None
    asked_revision_id: UUID | None = None
    current_revision_id: UUID | None = None
    pin_id: str | None = None
    notes: str | None = None


@dataclass
class Pin:
    sheet_revision_id: UUID
    x: float
    y: float
    label: str | None = None
    id: str = field(default_factory=lambda: str(uuid4()))


@dataclass
class RFI:
    id: str
    project_id: UUID
    question: str
    created_by_id: UUID
    status: str = "draft"
    priority: str = "standard"
    work_stopped: bool = False
    rfi_number: int | None = None
    rfi_display: str | None = None
    area_id: UUID | None = None
    crew_foreman_id: UUID | None = None
    pin: dict | None = None
    pins: list[Pin] = field(default_factory=list)
    refs: list = field(default_factory=list)
    due_at: datetime | None = None
    submitted_at: datetime | None = None
    first_submitted_at: datetime | None = None
    cycle_due_at: datetime | None = None
    official_response: str | None = None
    impact: str | None = None
    impact_none_suggested: bool = False


def as_uuid(value: UUID | str) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


class Store:
    """Process-memory only. Not a database."""

    def __init__(self, *, now: datetime | None = None) -> None:
        self.now = now or utc_now()
        self.jobs: dict[UUID, Job] = {}
        self.sheets: dict[UUID, Sheet] = {}
        self.revisions: dict[UUID, SheetRevision] = {}
        self.rfis: dict[str, RFI] = {}
        self.change_orders: dict[str, ChangeOrder] = {}
        self.material_orders: dict[str, MaterialOrder] = {}
        self.events: list[Event] = []

    def add_job(self, job: Job) -> Job:
        self.jobs[job.id] = job
        return job

    def add_sheet(self, sheet: Sheet) -> Sheet:
        self.sheets[sheet.id] = sheet
        return sheet

    def add_revision(self, revision: SheetRevision) -> SheetRevision:
        """A new print does not spawn RFIs and does not move existing pins."""
        if revision.id in self.revisions:
            raise WriteError("revision already exists")
        sheet = self.sheets.get(revision.sheet_id)
        if sheet is None:
            raise WriteError("sheet not found")
        if any(
            row.sheet_id == revision.sheet_id and row.revision == revision.revision
            for row in self.revisions.values()
        ):
            raise WriteError("revision already exists on this sheet")
        if revision.is_current:
            for row in self.revisions.values():
                if row.sheet_id == revision.sheet_id:
                    row.is_current = False
        self.revisions[revision.id] = revision
        return revision

    def add_event(self, event: Event) -> Event:
        if event.at is None:
            event.at = self.now
        self.events.append(event)
        return event

    def get_rfi(self, rfi_id: str) -> RFI:
        row = self.rfis.get(rfi_id)
        if row is None:
            raise WriteError(f"RFI {rfi_id} not found")
        return row

    def get_revision(self, revision_id: UUID | str) -> SheetRevision:
        row = self.revisions.get(as_uuid(revision_id))
        if row is None:
            raise WriteError("sheet_revision.id is not a known revision")
        return row


def resource_for(rfi: RFI) -> Resource:
    return Resource(
        type="rfi",
        project_id=rfi.project_id,
        area_id=rfi.area_id,
        status=rfi.status,
        priority=rfi.priority,
        work_stopped=rfi.work_stopped,
        created_by_id=rfi.created_by_id,
        crew_foreman_id=rfi.crew_foreman_id,
        id=UUID(rfi.id) if _is_uuid(rfi.id) else None,
    )


def _is_uuid(value: str) -> bool:
    try:
        UUID(value)
        return True
    except ValueError:
        return False


def write_priority_pair(rfi: RFI, priority: str) -> None:
    """Only set_priority is the public writer of this pair."""
    if priority not in ALLOWED_PRIORITIES:
        raise WriteError(f"invalid priority: {priority}")
    rfi.priority = priority
    rfi.work_stopped = priority == WORK_STOPPED
    if not pair_holds(rfi.priority, rfi.work_stopped):
        raise WriteError("work_stopped ⇔ priority = work_stopped does not hold")


def _one_question(question: str) -> str:
    text = (question or "").strip()
    if not text:
        raise WriteError("question is required")
    if text.count("?") > 1:
        raise WriteError("one question")
    return text


def _due_at(priority: str, now: datetime) -> datetime:
    return now + SLA[priority]


def _pin_from_dict(store: Store, pin: dict) -> Pin | None:
    rev_raw = pin.get("sheet_revision_id")
    if rev_raw is None:
        return None
    rev = store.get_revision(rev_raw)
    x = pin.get("x_norm", pin.get("x"))
    y = pin.get("y_norm", pin.get("y"))
    if x is None or y is None:
        raise WriteError("a draft must pin to a sheet_revision_id (plus x/y)")
    return Pin(
        sheet_revision_id=rev.id,
        x=float(x),
        y=float(y),
        label=pin.get("label"),
    )


def create_rfi_draft(
    store: Store,
    subject: Subject,
    *,
    question: str,
    pin: dict | None = None,
    refs: list | None = None,
    priority: str = "standard",
    env: Env | None = None,
) -> RFI:
    """One question. Optional pin/refs. Status draft only. Number stays null.

    Grokbot searches leftover drafts and carried opens first. A pin/question
    match returns that row. Never submit, number, or close from here.
    """
    chosen = (priority or "standard").strip().lower()
    if chosen not in DRAFT_PRIORITIES:
        raise WriteError("create_rfi_draft cannot write work_stopped")
    if subject.actor_type is ActorType.GROKBOT:
        from rfi.compare import preflight_match

        existing = preflight_match(store, question=question, pin=pin)
        if existing is not None:
            return existing
    require_access(
        subject,
        Action.CREATE_RFI_DRAFT,
        Resource(
            type="rfi",
            project_id=subject.project_id,
            area_id=subject.area_id,
            status="draft",
            created_by_id=subject.user_id,
        ),
        env=env or Env(project_id=subject.project_id, area_id=subject.area_id),
    )
    pins: list[Pin] = []
    if pin and pin.get("sheet_revision_id") is not None:
        built = _pin_from_dict(store, pin)
        if built is not None:
            pins.append(built)
    row = RFI(
        id=str(uuid4()),
        project_id=subject.project_id,
        question=_one_question(question),
        created_by_id=subject.user_id,
        status="draft",
        area_id=subject.area_id,
        pin=dict(pin) if pin else None,
        pins=pins,
        refs=list(refs or []),
    )
    write_priority_pair(row, chosen)
    if row.rfi_number is not None or row.status != "draft":
        raise WriteError("draft only")
    store.rfis[row.id] = row
    store.add_event(Event(rfi_id=row.id, event_type="draft", to_status="draft"))
    return row


def _next_number(store: Store, project_id: UUID) -> int:
    existing = [
        r.rfi_number
        for r in store.rfis.values()
        if r.project_id == project_id and r.rfi_number is not None
    ]
    return (max(existing) if existing else 0) + 1


def submit_rfi(
    store: Store,
    subject: Subject,
    rfi_id: str,
    *,
    env: Env | None = None,
) -> RFI:
    """Number on first submit, SLA due_at, internal review when the job requires it, then ball_in_court."""
    rfi = store.get_rfi(rfi_id)
    require_access(subject, Action.SUBMIT_RFI, resource_for(rfi), env=env)
    if rfi.status not in SUBMITTABLE:
        raise WriteError(f"cannot submit from {rfi.status}")
    if not (rfi.question or "").strip():
        raise WriteError("question is required")
    job = store.jobs.get(rfi.project_id)
    if job and job.requires_internal_review and rfi.status == "draft":
        store.add_event(
            Event(
                rfi_id=rfi.id,
                event_type="status_change",
                from_status=rfi.status,
                to_status="internal_review",
            )
        )
        rfi.status = "internal_review"
    first = rfi.rfi_number is None
    if first:
        number = _next_number(store, rfi.project_id)
        rfi.rfi_number = number
        rfi.rfi_display = f"RFI-{number}"
        rfi.submitted_at = store.now
        rfi.due_at = _due_at(rfi.priority, store.now)
        if rfi.first_submitted_at is None:
            rfi.first_submitted_at = rfi.submitted_at
        if rfi.cycle_due_at is None:
            rfi.cycle_due_at = rfi.due_at
    store.add_event(
        Event(
            rfi_id=rfi.id,
            event_type="status_change",
            from_status=rfi.status,
            to_status="submitted",
            due_at=rfi.due_at,
        )
    )
    store.add_event(
        Event(
            rfi_id=rfi.id,
            event_type="status_change",
            from_status="submitted",
            to_status="ball_in_court",
        )
    )
    rfi.status = "ball_in_court"
    return rfi


def set_priority(
    store: Store,
    subject: Subject,
    rfi_id: str,
    priority: str,
    *,
    work_stopped: bool | None = None,
    allow_demote: bool = False,
    env: Env | None = None,
) -> RFI:
    """Only writer for work_stopped ⇔ priority. Raise resets due. Demote needs allow_demote."""
    rfi = store.get_rfi(rfi_id)
    wanted = (priority or "").strip().lower()
    if work_stopped is True:
        wanted = WORK_STOPPED
    elif work_stopped is False and wanted == WORK_STOPPED:
        if not allow_demote:
            raise WriteError("demote needs allow_demote")
        wanted = "standard"
    if wanted not in ALLOWED_PRIORITIES:
        raise WriteError(f"invalid priority: {priority}")
    require_access(
        subject,
        Action.SET_PRIORITY,
        resource_for(rfi),
        env=env,
        ctx={"priority": wanted, "allow_demote": allow_demote},
    )
    old = rfi.priority
    old_rank = PRIORITY_RANK[old]
    new_rank = PRIORITY_RANK[wanted]
    if new_rank < old_rank and not allow_demote:
        raise WriteError("demote needs allow_demote")
    write_priority_pair(rfi, wanted)
    reminted = False
    if new_rank > old_rank and rfi.status in WAITING_ON_DESIGN:
        rfi.due_at = _due_at(rfi.priority, store.now)
        rfi.cycle_due_at = rfi.due_at
        reminted = True
    store.add_event(
        Event(
            rfi_id=rfi.id,
            event_type="priority_change",
            kind=rfi.priority,
            from_status=old,
            to_status=rfi.priority,
            due_at=rfi.due_at if reminted else None,
        )
    )
    return rfi


def _cycle_kind(rfi: RFI, now: datetime) -> str | None:
    if rfi.status not in WAITING_ON_DESIGN or rfi.due_at is None:
        return None
    if now <= rfi.due_at:
        return None
    hours_late = (now - rfi.due_at).total_seconds() / 3600
    wait = ESCALATE_AFTER_HOURS[rfi.priority]
    if hours_late >= wait:
        return "escalated"
    return "reminder"


def _cycled_for_due(store: Store, rfi: RFI) -> bool:
    return any(
        event.rfi_id == rfi.id
        and event.event_type == "cycle"
        and event.due_at == rfi.due_at
        for event in store.events
    )


def age_rfis(store: Store, *, now: datetime | None = None) -> list[Event]:
    """Work-stopped is its own queue. impact_review is gc_holding, not design-overdue."""
    moment = now or store.now
    written: list[Event] = []
    rows = list(store.rfis.values())
    holding = [row for row in rows if row.status in GC_HOLDING]
    design = [row for row in rows if row.status in WAITING_ON_DESIGN]
    if any(row.status in WAITING_ON_DESIGN for row in holding):
        raise WriteError("gc_holding is not the design queue")
    stopped = [row for row in design if row.work_stopped]
    rest = [row for row in design if not row.work_stopped]
    for row in stopped + rest:
        if _cycled_for_due(store, row):
            continue
        kind = _cycle_kind(row, moment)
        if kind is None:
            continue
        event = store.add_event(
            Event(
                rfi_id=row.id,
                event_type="cycle",
                kind=kind,
                due_at=row.due_at,
                at=moment,
            )
        )
        written.append(event)
    return written


def run_demo() -> dict:
    """journeyman pin draft → grokbot blocked → RFI-1 → work-stopped → one cycle event."""
    from rfi.compare import (
        apply_carry_forward,
        compare_revisions,
        preflight_ask,
        search_open_on_sheet,
    )

    job_id = UUID("00000000-0000-4000-8000-000000000010")
    area = UUID("00000000-0000-4000-8000-000000000401")
    company = UUID("00000000-0000-4000-8000-000000000301")
    jman = UUID("00000000-0000-4000-8000-000000000001")
    foreman = UUID("00000000-0000-4000-8000-000000000002")
    area_fm = UUID("00000000-0000-4000-8000-000000000004")
    store = Store()
    store.add_job(Job(id=job_id, requires_internal_review=True))
    sheet = store.add_sheet(
        Sheet(
            id=UUID("aaaaaaaa-0000-4000-8000-000000000131"),
            project_id=job_id,
            sheet_number="EL107_N",
            title="Electrical Lighting Plan — Level 07 North",
            discipline="E",
        )
    )
    rev27 = store.add_revision(
        SheetRevision(
            id=UUID("aaaaaaaa-0000-4000-8000-000000000141"),
            sheet_id=sheet.id,
            revision="27",
            is_current=True,
        )
    )

    journeyman = Subject(
        user_id=jman,
        company_id=company,
        project_id=job_id,
        role=Role.JOURNEYMAN,
        actor_type=ActorType.HUMAN,
        area_id=area,
    )
    draft = create_rfi_draft(
        store,
        journeyman,
        question="Clearance at grid A-3?",
        pin={
            "sheet_revision_id": rev27.id,
            "x": 0.28,
            "y": 0.52,
            "label": "A-3",
        },
    )
    leftover_draft = create_rfi_draft(
        store,
        journeyman,
        question="Same hatch on the old print?",
        pin={
            "sheet_revision_id": rev27.id,
            "x": 0.31,
            "y": 0.48,
            "label": "leftover",
        },
    )
    created_status = draft.status
    created_number = draft.rfi_number
    created_pin = {"label": "A-3"}

    grok = Subject(
        user_id=jman,
        company_id=company,
        project_id=job_id,
        role=Role.GENERAL_FOREMAN,
        actor_type=ActorType.GROKBOT,
        area_id=area,
    )
    grok_policy = None
    try:
        submit_rfi(store, grok, draft.id)
    except AccessDenied as exc:
        grok_policy = exc.decision.policy

    fm = Subject(
        user_id=foreman,
        company_id=company,
        project_id=job_id,
        role=Role.FOREMAN,
        actor_type=ActorType.HUMAN,
        area_id=area,
        crew_ids=frozenset({jman}),
    )
    submitted = submit_rfi(store, fm, draft.id)

    af = Subject(
        user_id=area_fm,
        company_id=company,
        project_id=job_id,
        role=Role.AREA_FOREMAN,
        actor_type=ActorType.HUMAN,
        area_id=area,
    )
    stopped = set_priority(
        store,
        af,
        submitted.id,
        WORK_STOPPED,
        work_stopped=True,
    )
    later = stopped.due_at + timedelta(seconds=1)
    first = age_rfis(store, now=later)
    replay = age_rfis(store, now=later)
    rev28 = store.add_revision(
        SheetRevision(
            id=UUID("aaaaaaaa-0000-4000-8000-000000000142"),
            sheet_id=sheet.id,
            revision="28",
            is_current=True,
        )
    )
    diff = compare_revisions(store, rev27.id, rev28.id)
    carried = apply_carry_forward(store, diff, actor_id=foreman)
    apply_carry_forward(store, diff, actor_id=foreman)
    open_on_sheet = search_open_on_sheet(store, sheet.id)
    ask = preflight_ask(
        store,
        previous_revision_id=rev27.id,
        question=leftover_draft.question,
        pin={
            "sheet_revision_id": rev27.id,
            "x": 0.31,
            "y": 0.48,
            "label": "leftover",
        },
    )
    before_preflight = len(store.rfis)
    grok_leftover = create_rfi_draft(
        store,
        grok,
        question=leftover_draft.question,
        pin={
            "sheet_revision_id": rev28.id,
            "x": 0.31,
            "y": 0.48,
            "label": "leftover",
        },
    )
    grok_carried = create_rfi_draft(
        store,
        grok,
        question="Clearance at grid A-3?",
        pin={
            "sheet_revision_id": rev28.id,
            "x": 0.28,
            "y": 0.52,
            "label": "A-3",
        },
    )
    grok_fresh = create_rfi_draft(
        store,
        grok,
        question="New hatch after Bulletin 46?",
        pin={
            "sheet_revision_id": rev28.id,
            "x": 0.8,
            "y": 0.8,
            "label": "new",
        },
    )
    ball_status = stopped.status
    stopped_flag = stopped.work_stopped
    due_at = stopped.due_at
    number = stopped.rfi_number

    from rfi.impact import (
        close_rfi,
        draft_material_order,
        enter_impact_review,
        record_answer,
    )

    record_answer(store, stopped.id, "Same panel, use 225A.")
    grok_enter = None
    try:
        enter_impact_review(store, grok, stopped.id)
    except AccessDenied as exc:
        grok_enter = exc.decision.policy
    enter_impact_review(store, fm, stopped.id)
    work_stopped_after_enter = stopped.work_stopped
    mo = draft_material_order(
        store, grok, stopped.id, sku="225A", qty=1, area_id=area
    )
    grok_close = None
    try:
        close_rfi(store, grok, stopped.id)
    except AccessDenied as exc:
        grok_close = exc.decision.policy
    close_while_stopped = None
    try:
        close_rfi(store, af, stopped.id)
    except WriteError as exc:
        close_while_stopped = str(exc)
    set_priority(
        store, af, stopped.id, "standard", work_stopped=False, allow_demote=True
    )
    closed = close_rfi(store, af, stopped.id)
    return {
        "draft_status": created_status,
        "draft_number": created_number,
        "draft_was_draft": store.events[0].to_status == "draft",
        "pin": created_pin,
        "grokbot_policy": grok_policy,
        "display": submitted.rfi_display,
        "status": ball_status,
        "internal_review": any(
            e.to_status == "internal_review" for e in store.events
        ),
        "priority": "work_stopped",
        "work_stopped": stopped_flag,
        "pair_holds": pair_holds(stopped.priority, stopped.work_stopped),
        "cycle_kind": first[0].kind if first else None,
        "cycle_events": len(first),
        "replay": len(replay),
        "carry": [item.rfi_id for item in diff.carry],
        "leftover": [item.rfi_id for item in diff.leftover],
        "carried_pins": len(carried),
        "pin_carried_events": sum(
            1 for event in store.events if event.event_type == "pin_carried"
        ),
        "leftover_still_on_old": leftover_draft.pins[0].sheet_revision_id == rev27.id
        and leftover_draft.rfi_number is None,
        "carried_has_both_revs": {p.sheet_revision_id for p in stopped.pins}
        == {rev27.id, rev28.id},
        "search_open_ids": {row.id for row in open_on_sheet},
        "store": store,
        "rfi": stopped,
        "sheet": sheet,
        "rev_a": rev27,
        "rev_b": rev28,
        "leftover_draft": leftover_draft,
        "foreman_id": foreman,
        "grok_enter": grok_enter,
        "grok_close": grok_close,
        "work_stopped_after_enter": work_stopped_after_enter,
        "close_while_stopped": close_while_stopped,
        "mo_status": mo.status,
        "mo_asked": mo.asked_revision_id,
        "mo_current": mo.sheet_revision_id,
        "closed_status": closed.status,
        "closed_number": closed.rfi_number,
        "due_unchanged": closed.due_at == due_at,
        "number_unchanged": closed.rfi_number == number,
        "leftover_still_draft": leftover_draft.status == "draft",
        "preflight_leftover_ids": {row.id for row in ask.leftover},
        "preflight_carried_ids": {row.id for row in ask.carried},
        "grok_leftover_id": grok_leftover.id,
        "grok_carried_id": grok_carried.id,
        "grok_fresh_id": grok_fresh.id,
        "grok_fresh_status": grok_fresh.status,
        "grok_fresh_number": grok_fresh.rfi_number,
        "preflight_did_not_spawn": grok_leftover.id == leftover_draft.id
        and grok_carried.id == stopped.id
        and len(store.rfis) == before_preflight + 1,
    }
