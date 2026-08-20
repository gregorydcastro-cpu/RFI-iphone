from __future__ import annotations

from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

ALLOWED_PRIORITIES = ("standard", "urgent", "work_stopped")
DRAFT_PRIORITIES = ("standard", "urgent")
IMPACT_VALUES = ("unknown", "none", "possible")
OPEN_STATUSES = ("draft", "submitted", "ball_in_court")
ALL_STATUSES = ("draft", "submitted", "ball_in_court", "closed", "void")

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


class SheetRevisionOut(BaseModel):
    id: str
    sheet_id: str
    sheet_number: str
    revision: str
    discipline: str
    title: str
    drawing_url: str


class RFIOut(BaseModel):
    id: str
    project_id: str
    status: str
    rfi_number: Optional[int]
    rfi_display: Optional[str]
    subject: str
    question: str
    priority: str
    cost_impact: str
    schedule_impact: str
    proposed_solution: Optional[str]
    grok_preflight: Optional[dict]
    pins: list[dict]
    refs: list[dict]
    attachment_count: int
    missing_for_submit: list[str]
