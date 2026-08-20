from __future__ import annotations

from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

ALLOWED_PRIORITIES = ("standard", "urgent", "work_stopped")
DRAFT_PRIORITIES = ("standard", "urgent")
IMPACT_VALUES = ("unknown", "none", "possible")
OPEN_STATUSES = (
    "draft",
    "internal_review",
    "submitted",
    "ball_in_court",
    "needs_clarification",
    "answered",
    "impact_review",
)
ALL_STATUSES = OPEN_STATUSES + ("closed", "void")
GRAPH_EXCLUDED = ("draft", "closed", "void")
AGE_BUCKET_ORDER = (
    "work_stopped",
    "escalated",
    "overdue",
    "due_soon",
    "gc_holding",
    "missing_due",
    "on_cycle",
)
STATUS_MACHINE_MAIN = (
    "draft",
    "internal_review",
    "submitted",
    "ball_in_court",
    "answered",
    "impact_review",
    "closed",
)
STATUS_MACHINE_BRANCHES = ("needs_clarification", "void")

FORBIDDEN_DRAFT_KEYS = frozenset(
    {
        "status",
        "rfi_number",
        "rfi_display",
        "due_at",
        "official_response",
        "submitted_at",
        "closed_at",
        "submit",
        "submitted",
        "void",
        "ball_in_court",
    }
)

ALLOWED_TOP_LEVEL = frozenset(
    {
        "task",
        "project",
        "sheet_revision",
        "pin",
        "photos",
        "open_rfis_same_sheet",
        "user_note",
    }
)


class ProjectInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    name: str


class SheetRevisionInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    sheet_number: str
    revision: str
    discipline: str


class PinInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x_norm: float = Field(ge=0, le=1)
    y_norm: float = Field(ge=0, le=1)
    label: Optional[str] = None


class PhotoInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: str
    content_type: str = "image/jpeg"
    data_base64: str


class OpenRFIInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: Optional[UUID] = None
    subject: Optional[str] = None
    status: Optional[str] = None
    sheet_number: Optional[str] = None
    grid: Optional[str] = None
    rfi_display: Optional[str] = None


class PreflightEnvelope(BaseModel):
    """Client envelope for POST /create_rfi_draft. Extra keys are forbidden."""

    model_config = ConfigDict(extra="forbid")

    task: Literal["preflight_rfi"]
    project: ProjectInfo
    sheet_revision: Optional[SheetRevisionInfo] = None
    pin: Optional[PinInfo] = None
    photos: list[PhotoInfo] = Field(default_factory=list)
    open_rfis_same_sheet: list[OpenRFIInfo] = Field(default_factory=list)
    user_note: str = ""

    @field_validator("user_note")
    @classmethod
    def strip_note(cls, value: str) -> str:
        return value.strip()


class DraftResult(BaseModel):
    ok: bool
    rfi_id: Optional[str] = None
    status: Optional[str] = None
    rfi_display: Optional[str] = None
    missing_for_submit: list[str] = Field(default_factory=list)
    message: str
    duplicate: bool = False


class SearchHit(BaseModel):
    id: str
    project_id: str
    status: str
    subject: str
    question: str
    priority: str
    rfi_display: Optional[str]
    sheet_numbers: list[str]
    grids: list[str]
    created_at: Optional[str] = None


class SearchResponse(BaseModel):
    ok: bool
    count: int
    rfis: list[SearchHit]


class ProjectOut(BaseModel):
    id: str
    name: str
    organization_name: str
    address: Optional[str] = None
    architect: Optional[str] = None
    project_number: Optional[str] = None


class SheetRevisionOut(BaseModel):
    id: str
    sheet_id: str
    sheet_number: str
    revision: str
    discipline: str
    title: str
    drawing_url: str
    file_url: Optional[str] = None
    page_width: Optional[int] = None
    page_height: Optional[int] = None
    is_current: bool = False


class GraphRow(BaseModel):
    id: str
    project_id: str
    project_name: str
    rfi_display: Optional[str]
    rfi_number: Optional[int]
    subject: str
    sheet_number: Optional[str]
    status: str
    priority: str
    work_stopped: bool
    assigned: Optional[str]
    due_at: Optional[str]
    days_open: int
    age_bucket: Optional[str]
    is_sample: bool
    is_draft: bool


class GraphResponse(BaseModel):
    ok: bool
    generated_at: str
    timezone: str
    days_open_rule: str
    sample_notice: str
    status_machine: dict
    bucket_order: list[str]
    bucket_counts: dict[str, int]
    open: list[GraphRow]
    drafts: list[GraphRow]
    closed_or_void_count: int


class RFIOut(BaseModel):
    id: str
    project_id: str
    status: str
    rfi_number: Optional[int]
    rfi_display: Optional[str]
    subject: str
    question: str
    priority: str
    work_stopped: bool = False
    cost_impact: str
    schedule_impact: str
    proposed_solution: Optional[str]
    grok_preflight: Optional[dict]
    assigned: Optional[str] = None
    assigned_to_user_id: Optional[str] = None
    assigned_to_company_id: Optional[str] = None
    official_response: Optional[str] = None
    responded_at: Optional[str] = None
    due_at: Optional[str] = None
    submitted_at: Optional[str] = None
    closed_at: Optional[str] = None
    pins: list[dict]
    refs: list[dict]
    attachment_count: int
    missing_for_submit: list[str]
    last_internal_review: bool = False
    draft_change_orders: list[dict] = Field(default_factory=list)
    draft_material_orders: list[dict] = Field(default_factory=list)


class PEApproveBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    comment: Optional[str] = None


class PESubmitBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    priority: str
    work_stopped: bool
    require_internal_review: bool = True
    assigned_to_user_id: Optional[UUID] = None
    assigned_to_company_id: Optional[UUID] = None
    assignee: Optional[str] = None
    comment: Optional[str] = None

    @field_validator("priority")
    @classmethod
    def strip_priority(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("assignee")
    @classmethod
    def strip_assignee(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class PESubmitResult(BaseModel):
    ok: bool
    rfi_id: str
    status: str
    rfi_display: Optional[str]
    rfi_number: Optional[int] = None
    due_at: Optional[str] = None
    submitted_at: Optional[str] = None
    first_submit: bool
    assigned: Optional[str] = None
    assigned_to_user_id: Optional[str] = None
    assigned_to_company_id: Optional[str] = None
    priority: str
    work_stopped: bool
    due_at_rule: str
    message: str


class PEApproveResult(BaseModel):
    ok: bool
    rfi_id: str
    status: str
    rfi_display: Optional[str]
    message: str


class AssigneeUserOut(BaseModel):
    id: str
    name: str
    role: str
    company_id: Optional[str] = None
    company_name: Optional[str] = None


class AssigneeCompanyOut(BaseModel):
    id: str
    name: str
    kind: str


class AssigneeRosterOut(BaseModel):
    ok: bool
    users: list[AssigneeUserOut]
    companies: list[AssigneeCompanyOut]


class DesignAnswerBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    official_response: str

    @field_validator("official_response")
    @classmethod
    def strip_response(cls, value: str) -> str:
        return value.strip()


class DesignClarifyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    note: str

    @field_validator("note")
    @classmethod
    def strip_note(cls, value: str) -> str:
        return value.strip()


class DesignActionResult(BaseModel):
    ok: bool
    rfi_id: str
    status: str
    rfi_display: Optional[str]
    official_response: Optional[str] = None
    responded_at: Optional[str] = None
    assigned: Optional[str] = None
    priority: Optional[str] = None
    work_stopped: bool = False
    message: str
    disclaimer: str
