"""Contractor field chain. Law, not a UI hint.

General Foreman → Area Foreman → Foreman → Journeyman → Apprentice.
Nobody jumps a step because they have the phone.

Grokbot still only search_rfis + create_rfi_draft. It reads actor.role
and stops there. Submit, set_priority, assign, and work-stop are out of lane.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    DraftMaterialOrder,
    ProjectArea,
    ProjectAssignment,
    RFI,
    User,
    WorkStopGrant,
)

FIELD_ROLES = (
    "apprentice",
    "journeyman",
    "foreman",
    "area_foreman",
    "general_foreman",
)
RANK = {name: i for i, name in enumerate(FIELD_ROLES)}
BOSS_ROLE = {
    "apprentice": "journeyman",
    "journeyman": "foreman",
    "foreman": "area_foreman",
    "area_foreman": "general_foreman",
    "general_foreman": None,
}
GROK_ACTIONS = frozenset({"search_rfis", "create_rfi_draft", "draft", None, ""})
GROK_OUT_OF_LANE = frozenset(
    {
        "submit",
        "submit_rfi",
        "set_priority",
        "work_stop",
        "work_stopped",
        "void",
        "assign",
        "assign_tickets",
        "assign_hopper",
        "allow_demote",
        "approve_material",
        "internal_review",
    }
)

ACTIONS = frozenset(
    {
        "create_rfi_draft",
        "request_material",
        "handle_material",
        "flag_material",
        "assign_tickets",
        "submit_rfi",
        "internal_review",
        "set_priority",
        "work_stop",
        "approve_material",
        "void",
        "allow_demote",
    }
)


class FieldError(ValueError):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class Actor:
    user_id: str
    name: str
    role: str
    project_id: str
    area_id: str | None
    reports_to_user_id: str | None
    assignment_id: str
    kind: str = "field"
    area_name: str | None = None
    boss_name: str | None = None
    boss_role: str | None = None

    @property
    def is_field(self) -> bool:
        return self.kind == "field"

    def rank(self) -> int:
        return RANK.get(self.role, -1)


def office_actor(kind: str, project_id: str = "") -> Actor:
    """Demo PE / design / GC tokens. Not the field chain. Existing tests stay on this lane."""
    if kind == "pe":
        return Actor(
            user_id="",
            name="Office PE",
            role="general_foreman",
            project_id=project_id,
            area_id=None,
            reports_to_user_id=None,
            assignment_id="",
            kind="office_pe",
        )
    if kind == "design":
        return Actor(
            user_id="",
            name="Design",
            role="design",
            project_id=project_id,
            area_id=None,
            reports_to_user_id=None,
            assignment_id="",
            kind="office_design",
        )
    if kind == "gc":
        return Actor(
            user_id="",
            name="Office GC",
            role="gc",
            project_id=project_id,
            area_id=None,
            reports_to_user_id=None,
            assignment_id="",
            kind="office_gc",
        )
    raise FieldError(f"Unknown office actor: {kind}")


def _active_assignment(db: Session, project_id: str, user_id: str) -> ProjectAssignment | None:
    return db.scalar(
        select(ProjectAssignment).where(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.user_id == user_id,
            ProjectAssignment.active.is_(True),
        )
    )


def load_actor(db: Session, project_id: str, user_id: str) -> Actor:
    row = _active_assignment(db, project_id, user_id)
    if not row:
        raise FieldError("No active assignment on this project.", 403)
    user = db.get(User, user_id)
    if not user:
        raise FieldError("Unknown user.", 403)
    boss = db.get(User, row.reports_to_user_id) if row.reports_to_user_id else None
    boss_row = (
        _active_assignment(db, project_id, row.reports_to_user_id)
        if row.reports_to_user_id
        else None
    )
    area = db.get(ProjectArea, row.area_id) if row.area_id else None
    return Actor(
        user_id=row.user_id,
        name=user.name,
        role=row.role,
        project_id=row.project_id,
        area_id=row.area_id,
        reports_to_user_id=row.reports_to_user_id,
        assignment_id=row.id,
        kind="field",
        area_name=area.name if area else None,
        boss_name=boss.name if boss else None,
        boss_role=boss_row.role if boss_row else None,
    )


def resolve_actor(
    db: Session,
    project_id: str,
    *,
    user_id: str | None = None,
    claimed_role: str | None = None,
    office_kind: str | None = None,
) -> Actor:
    if user_id:
        actor = load_actor(db, project_id, user_id)
        if claimed_role and claimed_role.strip().lower() != actor.role:
            raise FieldError(
                "Actor role does not match the signed-in assignment.", 403
            )
        return actor
    if office_kind:
        return office_actor(office_kind, project_id)
    raise FieldError("Actor role is required.", 403)


def _validate_boss(
    db: Session,
    *,
    project_id: str,
    role: str,
    reports_to_user_id: str | None,
    area_id: str | None,
) -> None:
    expected = BOSS_ROLE[role]
    if role == "general_foreman":
        if reports_to_user_id:
            raise FieldError("General Foreman reports_to must be null.")
        if area_id:
            raise FieldError("General Foreman area_id must be null (the job).")
        return
    if not reports_to_user_id:
        raise FieldError(f"{role} must report to a {expected}.")
    if not area_id:
        raise FieldError(f"{role} requires an area_id.")
    boss = _active_assignment(db, project_id, reports_to_user_id)
    if not boss:
        raise FieldError("Boss must be assigned to the same project and active.")
    if role == "apprentice" and boss.role == "foreman":
        pass
    elif boss.role != expected:
        raise FieldError(
            f"{role} must report one step up to a {expected}, not {boss.role}."
        )
    if RANK[boss.role] != RANK[role] + 1 and not (
        role == "apprentice" and boss.role == "foreman"
    ):
        raise FieldError("Boss must be one step up the chain. Nobody jumps a rank.")
    if boss.role != "general_foreman" and boss.area_id != area_id:
        raise FieldError("Area must match the boss’s area (except GF).")
    area = db.get(ProjectArea, area_id)
    if not area or area.project_id != project_id:
        raise FieldError("area_id is not on this project.")


def assign_person(
    db: Session,
    *,
    project_id: str,
    user_id: str,
    role: str,
    reports_to_user_id: str | None,
    area_id: str | None,
    assignment_id: str | None = None,
    active: bool = True,
) -> ProjectAssignment:
    role = (role or "").strip().lower()
    if role not in FIELD_ROLES:
        raise FieldError(f"Invalid field role: {role}")
    if not db.get(User, user_id):
        raise FieldError("user_id is not a known user.")
    existing = db.scalar(
        select(ProjectAssignment).where(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.user_id == user_id,
        )
    )
    if existing and existing.active and active and existing.id != (assignment_id or existing.id):
        raise FieldError("Unique active assignment per (project, user).")
    if existing and existing.active and active and assignment_id and assignment_id != existing.id:
        raise FieldError("Unique active assignment per (project, user).")
    if active:
        _validate_boss(
            db,
            project_id=project_id,
            role=role,
            reports_to_user_id=reports_to_user_id,
            area_id=area_id,
        )
    if existing:
        existing.role = role
        existing.reports_to_user_id = reports_to_user_id
        existing.area_id = area_id
        existing.active = active
        db.commit()
        db.refresh(existing)
        return existing
    row = ProjectAssignment(
        id=assignment_id,
        project_id=project_id,
        user_id=user_id,
        role=role,
        reports_to_user_id=reports_to_user_id,
        area_id=area_id,
        active=active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _same_area(actor: Actor, rfi: RFI | None) -> bool:
    if rfi is None:
        return True
    if actor.role == "general_foreman" or actor.kind == "office_pe":
        return True
    if not rfi.area_id:
        return False
    return rfi.area_id == actor.area_id


def _has_work_stop_grant(db: Session, actor: Actor, rfi: RFI | None) -> bool:
    rows = list(
        db.scalars(
            select(WorkStopGrant).where(
                WorkStopGrant.project_id == actor.project_id,
                WorkStopGrant.grantee_user_id == actor.user_id,
                WorkStopGrant.active.is_(True),
            )
        )
    )
    if not rows:
        return False
    if rfi is None:
        return True
    return any(row.rfi_id is None or row.rfi_id == rfi.id for row in rows)


def grant_work_stop(
    db: Session,
    *,
    grantor: Actor,
    grantee_user_id: str,
    rfi_id: str | None = None,
) -> WorkStopGrant:
    if not can(db, grantor, "work_stop"):
        raise FieldError("Only Area Foreman or GF may grant work-stopped.", 403)
    grantee = load_actor(db, grantor.project_id, grantee_user_id)
    if grantee.role != "foreman":
        raise FieldError("Work-stop grants go to a Foreman.")
    if grantor.role == "area_foreman" and grantee.area_id != grantor.area_id:
        raise FieldError("Area Foreman may only grant inside their area.", 403)
    row = WorkStopGrant(
        project_id=grantor.project_id,
        grantee_user_id=grantee_user_id,
        granted_by_user_id=grantor.user_id,
        rfi_id=rfi_id,
        active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def can(
    db: Session,
    actor: Actor,
    action: str,
    *,
    rfi: RFI | None = None,
    ticket: DraftMaterialOrder | None = None,
) -> bool:
    if action not in ACTIONS:
        return False
    if actor.kind == "office_pe":
        return action in {
            "submit_rfi",
            "internal_review",
            "set_priority",
            "work_stop",
            "void",
            "allow_demote",
            "approve_material",
            "assign_tickets",
            "request_material",
        }
    if actor.kind in {"office_design", "office_gc"}:
        return False
    if not actor.is_field:
        return False

    role = actor.role
    if action == "create_rfi_draft":
        return RANK[role] >= RANK["journeyman"]
    if action == "request_material":
        return RANK[role] >= RANK["journeyman"]
    if action == "handle_material":
        if role != "apprentice" or ticket is None:
            return False
        return ticket.assigned_to_user_id == actor.user_id and ticket.handled_at is None
    if action == "flag_material":
        return role == "apprentice"
    if action == "assign_tickets":
        return RANK[role] >= RANK["foreman"] and _same_area(actor, rfi)
    if action == "submit_rfi":
        return RANK[role] >= RANK["foreman"] and _same_area(actor, rfi)
    if action == "internal_review":
        return RANK[role] >= RANK["foreman"] and _same_area(actor, rfi)
    if action == "set_priority":
        if role == "general_foreman":
            return True
        if role == "area_foreman":
            return _same_area(actor, rfi)
        return False
    if action == "work_stop":
        if role == "general_foreman":
            return True
        if role == "area_foreman":
            return _same_area(actor, rfi)
        if role == "foreman":
            return _same_area(actor, rfi) and _has_work_stop_grant(db, actor, rfi)
        return False
    if action == "approve_material":
        if role == "general_foreman":
            return True
        if role == "area_foreman":
            return _same_area(actor, rfi)
        return False
    if action in {"void", "allow_demote"}:
        return role == "general_foreman"
    return False


def require_can(
    db: Session,
    actor: Actor,
    action: str,
    *,
    rfi: RFI | None = None,
    ticket: DraftMaterialOrder | None = None,
) -> None:
    if not can(db, actor, action, rfi=rfi, ticket=ticket):
        raise FieldError(f"{actor.role} cannot {action}.", 403)


def grok_out_of_lane(raw: dict | None, actor_role: str | None) -> str | None:
    """Reject hopper-assign / submit / work-stop from the Grok packet."""
    packet = raw or {}
    claimed = (actor_role or "").strip().lower()
    if claimed == "apprentice":
        return "Apprentice cannot create an RFI draft. Handle material or flag up."
    action = str(packet.get("action") or "").strip().lower()
    actor = packet.get("actor") if isinstance(packet.get("actor"), dict) else {}
    actor_action = str(actor.get("action") or "").strip().lower()
    for value in (action, actor_action):
        if value in GROK_OUT_OF_LANE:
            return f"Grokbot is out of lane for {value}. Search, then create_rfi_draft only."
    for key in GROK_OUT_OF_LANE:
        if key in packet and key not in {"work_stopped"}:
            return f"Grokbot is out of lane for {key}."
    return None


def capabilities(db: Session, actor: Actor, rfi: RFI | None = None) -> dict[str, bool]:
    return {name: can(db, actor, name, rfi=rfi) for name in sorted(ACTIONS)}


def assignment_payload(db: Session, actor: Actor) -> dict:
    return {
        "ok": True,
        "user_id": actor.user_id,
        "name": actor.name,
        "role": actor.role,
        "project_id": actor.project_id,
        "area_id": actor.area_id,
        "area_name": actor.area_name,
        "reports_to_user_id": actor.reports_to_user_id,
        "boss_name": actor.boss_name,
        "boss_role": actor.boss_role,
        "capabilities": capabilities(db, actor),
        "chain": list(FIELD_ROLES),
    }
