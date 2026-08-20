"""Adapters over abac. The engine lives in app.abac — do not fork a second lock."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.abac import (
    AccessContext,
    AccessDenied,
    Action,
    ActorType,
    Combining,
    Decision,
    DESIGN_OPEN,
    DRAFTISH,
    Effect,
    Env,
    EvaluationLog,
    EvaluationTrace,
    FIELD_CHAIN,
    FIELD_POLICY_SET,
    Policy,
    PolicyContext,
    PolicySet,
    Resource,
    Role,
    ROLE_ACTIONS,
    Subject,
    area_scope,
    assigned_only,
    audit_logs,
    chain_owns,
    check_access,
    default_deny,
    evaluate,
    grokbot_lane,
    on_site,
    raise_http,
    require_access,
    role_allows,
    same_project,
    status_guard,
    work_stop_writer,
)
from app.models import DraftMaterialOrder, ProjectAssignment, RFI, RolePermission, User
from app.models import Role as RoleRow

LEGACY_ACTION = {
    "void": Action.VOID_RFI,
    "assign_tickets": Action.ASSIGN_MATERIAL,
    "request_material": Action.DRAFT_MATERIAL,
    "flag_material": Action.FLAG_UP,
    "internal_review": Action.SUBMIT_RFI,
    "approve_internal_review": Action.SUBMIT_RFI,
}

RESOURCE_KIND = {
    Action.VIEW_PRINT: "sheet",
    Action.PIN_DRAFT: "sheet",
    Action.CREATE_RFI_DRAFT: "rfi",
    Action.SUBMIT_RFI: "rfi",
    Action.SET_PRIORITY: "rfi",
    Action.WORK_STOP: "rfi",
    Action.VOID_RFI: "rfi",
    Action.ALLOW_DEMOTE: "rfi",
    Action.DRAFT_MATERIAL: "material_order",
    Action.APPROVE_MATERIAL: "material_order",
    Action.ASSIGN_MATERIAL: "material_order",
    Action.HANDLE_MATERIAL: "ticket",
    Action.FLAG_UP: "ticket",
}


def parse_action(name: str) -> Action:
    mapped = LEGACY_ACTION.get(name)
    if mapped:
        return mapped
    return Action(name)


def as_uuid(value: Any) -> UUID | None:
    if value is None or value == "":
        return None
    if isinstance(value, UUID):
        return value
    return UUID(str(value))


def must_uuid(value: Any) -> UUID:
    parsed = as_uuid(value)
    if parsed is None:
        raise ValueError("expected a UUID")
    return parsed


def env_from_request(
    on_site_header: str | None,
    *,
    project_id: UUID | None = None,
    area_id: UUID | None = None,
) -> Env:
    if on_site_header is None or not str(on_site_header).strip():
        return Env(on_site=True, project_id=project_id, area_id=area_id)
    token = str(on_site_header).strip().lower()
    return Env(
        on_site=token not in {"0", "false", "off", "no"},
        project_id=project_id,
        area_id=area_id,
    )


def load_crew_ids(db: Session, project_id: str, user_id: str) -> frozenset[UUID]:
    rows = db.scalars(
        select(ProjectAssignment.user_id).where(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.reports_to_user_id == user_id,
            ProjectAssignment.active.is_(True),
        )
    )
    return frozenset(must_uuid(row) for row in rows)


def _crew_foreman_id(db: Session, project_id: str, user_id: str | None) -> UUID | None:
    if not user_id:
        return None
    row = db.scalar(
        select(ProjectAssignment).where(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.user_id == user_id,
            ProjectAssignment.active.is_(True),
        )
    )
    if row is None:
        return None
    if row.role == Role.FOREMAN.value:
        return must_uuid(row.user_id)
    return as_uuid(row.reports_to_user_id)


def resource_from_rfi(db: Session, rfi: RFI) -> Resource:
    return Resource(
        type="rfi",
        project_id=must_uuid(rfi.project_id),
        area_id=as_uuid(rfi.area_id),
        status=rfi.status,
        priority=rfi.priority,
        work_stopped=rfi.priority == "work_stopped",
        created_by_id=as_uuid(rfi.created_by_user_id),
        assigned_to_id=as_uuid(rfi.assigned_to_user_id),
        crew_foreman_id=_crew_foreman_id(db, rfi.project_id, rfi.created_by_user_id),
        requires_internal_review=False,
    )


def resource_from_ticket(
    db: Session, ticket: DraftMaterialOrder, rfi: RFI | None = None
) -> Resource:
    row = rfi or db.get(RFI, ticket.rfi_id)
    if row is None:
        raise KeyError(ticket.rfi_id)
    return Resource(
        type="ticket",
        project_id=must_uuid(row.project_id),
        area_id=as_uuid(row.area_id),
        status=ticket.status,
        created_by_id=as_uuid(ticket.requested_by_user_id),
        assigned_to_id=as_uuid(ticket.assigned_to_user_id),
        crew_foreman_id=_crew_foreman_id(
            db, row.project_id, ticket.requested_by_user_id
        ),
    )


def resource_from_order(
    db: Session, order: DraftMaterialOrder, rfi: RFI | None = None
) -> Resource:
    ticket = resource_from_ticket(db, order, rfi)
    return Resource(
        type="material_order",
        project_id=ticket.project_id,
        area_id=ticket.area_id,
        status=ticket.status,
        created_by_id=ticket.created_by_id,
        assigned_to_id=ticket.assigned_to_id,
        crew_foreman_id=ticket.crew_foreman_id,
    )


def load_rfi(db: Session, rfi_id: UUID | str) -> tuple[RFI, Resource]:
    rfi = db.get(RFI, str(rfi_id))
    if rfi is None:
        raise KeyError(str(rfi_id))
    return rfi, resource_from_rfi(db, rfi)


def load_ticket(
    db: Session, ticket_id: UUID | str
) -> tuple[DraftMaterialOrder, Resource]:
    ticket = db.get(DraftMaterialOrder, str(ticket_id))
    if ticket is None:
        raise KeyError(str(ticket_id))
    return ticket, resource_from_ticket(db, ticket)


def subject_from_assignment(
    db: Session,
    assignment: ProjectAssignment,
    *,
    actor_type: ActorType = ActorType.HUMAN,
) -> Subject:
    user = db.get(User, assignment.user_id)
    company_id = as_uuid(user.company_id) if user and user.company_id else UUID(int=0)
    return Subject(
        user_id=must_uuid(assignment.user_id),
        company_id=company_id,
        project_id=must_uuid(assignment.project_id),
        role=Role(assignment.role),
        area_id=as_uuid(assignment.area_id),
        reports_to_id=as_uuid(assignment.reports_to_user_id),
        actor_type=actor_type,
        crew_ids=load_crew_ids(db, assignment.project_id, assignment.user_id),
    )


def office_pe_subject(project_id: UUID | str) -> Subject:
    return Subject(
        user_id=UUID(int=0),
        company_id=UUID(int=0),
        project_id=must_uuid(project_id),
        role=Role.GENERAL_FOREMAN,
        area_id=None,
        reports_to_id=None,
        actor_type=ActorType.HUMAN,
        crew_ids=frozenset(),
    )


def seed_role_permissions(db: Session) -> None:
    titles = {
        Role.GENERAL_FOREMAN: (4, "General Foreman"),
        Role.AREA_FOREMAN: (3, "Area Foreman"),
        Role.FOREMAN: (2, "Foreman"),
        Role.JOURNEYMAN: (1, "Journeyman"),
        Role.APPRENTICE: (0, "Apprentice"),
    }
    for role, (rank, label) in titles.items():
        if db.get(RoleRow, role.value) is None:
            db.add(RoleRow(name=role.value, rank=rank, kind="field", label=label))
    db.flush()
    have = {
        (row.role_name, row.action, row.resource_kind)
        for row in db.scalars(select(RolePermission))
    }
    for role, actions in ROLE_ACTIONS.items():
        for action in actions:
            kind = RESOURCE_KIND.get(action, "")
            key = (role.value, action.value, kind)
            if key not in have:
                db.add(
                    RolePermission(
                        role_name=role.value,
                        action=action.value,
                        resource_kind=kind,
                    )
                )
                have.add(key)
    db.flush()
