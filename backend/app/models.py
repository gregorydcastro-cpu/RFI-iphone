from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def new_uuid() -> str:
    return str(uuid.uuid4())


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    projects: Mapped[list[Project]] = relationship(back_populates="organization")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    architect: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    project_number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    organization: Mapped[Organization] = relationship(back_populates="projects")
    rfi_settings: Mapped[Optional[ProjectRFISettings]] = relationship(
        back_populates="project", uselist=False
    )
    drawing_sets: Mapped[list[DrawingSet]] = relationship(back_populates="project")
    locations: Mapped[list[Location]] = relationship(back_populates="project")
    rfis: Mapped[list[RFI]] = relationship(back_populates="project")
    companies: Mapped[list["Company"]] = relationship(back_populates="project")
    users: Mapped[list["User"]] = relationship(back_populates="project")


class ProjectRFISettings(Base):
    __tablename__ = "project_rfi_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False, unique=True
    )
    rfi_prefix: Mapped[str] = mapped_column(String(16), default="RFI")
    number_width: Mapped[int] = mapped_column(Integer, default=4)
    standard_due_days: Mapped[int] = mapped_column(Integer, default=7)
    urgent_due_hours: Mapped[int] = mapped_column(Integer, default=72)
    work_stopped_due_hours: Mapped[int] = mapped_column(Integer, default=24)
    escalate_after_overdue_hours: Mapped[int] = mapped_column(Integer, default=48)

    project: Mapped[Project] = relationship(back_populates="rfi_settings")


class ProjectCalendar(Base):
    __tablename__ = "project_calendars"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False, unique=True
    )
    timezone: Mapped[str] = mapped_column(String(64), default="America/New_York")
    weekend_days: Mapped[list] = mapped_column(JSON, default=lambda: [5, 6])
    standard_sla_unit: Mapped[str] = mapped_column(String(32), default="business_days")
    due_time: Mapped[str] = mapped_column(String(8), default="17:00")
    roll_to_business_day: Mapped[bool] = mapped_column(default=False)

    project: Mapped[Project] = relationship()


class ProjectHoliday(Base):
    __tablename__ = "project_holidays"
    __table_args__ = (
        UniqueConstraint("project_id", "on_date", name="uq_project_holiday_date"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False
    )
    on_date: Mapped[date] = mapped_column(Date, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="manual")
    catalog_date_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    active: Mapped[bool] = mapped_column(default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class DrawingSet(Base):
    __tablename__ = "drawing_sets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    issued_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    project: Mapped[Project] = relationship(back_populates="drawing_sets")
    sheets: Mapped[list[Sheet]] = relationship(back_populates="drawing_set")


class Sheet(Base):
    __tablename__ = "sheets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    drawing_set_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("drawing_sets.id"), nullable=False
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False
    )
    sheet_number: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    discipline: Mapped[str] = mapped_column(String(64), nullable=False)

    drawing_set: Mapped[DrawingSet] = relationship(back_populates="sheets")
    revisions: Mapped[list[SheetRevision]] = relationship(back_populates="sheet")


class SheetRevision(Base):
    __tablename__ = "sheet_revisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    sheet_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sheets.id"), nullable=False
    )
    revision: Mapped[str] = mapped_column(String(16), nullable=False)
    drawing_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[Optional[str]] = mapped_column(String(400), nullable=True)
    page_width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    page_height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_current: Mapped[bool] = mapped_column(default=False)
    issued_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    sheet: Mapped[Sheet] = relationship(back_populates="revisions")


class Company(Base):
    """Thin project company row for PE assignment. Not a full CRM."""

    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="design")

    project: Mapped[Optional[Project]] = relationship(back_populates="companies")
    users: Mapped[list["User"]] = relationship(back_populates="company")


class User(Base):
    """Thin project person row for PE assignment."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=True
    )
    company_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("companies.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="ae")

    project: Mapped[Optional[Project]] = relationship(back_populates="users")
    company: Mapped[Optional[Company]] = relationship(back_populates="users")


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    grid: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    project: Mapped[Project] = relationship(back_populates="locations")


class RFI(Base):
    __tablename__ = "rfis"
    __table_args__ = (
        UniqueConstraint("project_id", "rfi_display", name="uq_project_rfi_display"),
        Index("ix_rfis_project_status", "project_id", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False
    )
    rfi_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rfi_display: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    subject: Mapped[str] = mapped_column(String(240), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(32), nullable=False)
    cost_impact: Mapped[str] = mapped_column(String(32), nullable=False)
    schedule_impact: Mapped[str] = mapped_column(String(32), nullable=False)
    proposed_solution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    grok_preflight: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    assigned: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    assigned_to_user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    assigned_to_company_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("companies.id"), nullable=True
    )
    is_sample: Mapped[bool] = mapped_column(default=False)
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    official_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    project: Mapped[Project] = relationship(back_populates="rfis")
    refs: Mapped[list[RFIRef]] = relationship(back_populates="rfi")
    pins: Mapped[list[RFIPin]] = relationship(back_populates="rfi")
    attachments: Mapped[list[RFIAttachment]] = relationship(back_populates="rfi")
    events: Mapped[list[RFIEvent]] = relationship(back_populates="rfi")


class RFIRef(Base):
    __tablename__ = "rfi_refs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    rfi_id: Mapped[str] = mapped_column(String(36), ForeignKey("rfis.id"), nullable=False)
    sheet_revision_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("sheet_revisions.id"), nullable=True
    )
    sheet_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    revision: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    discipline: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    grid: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    location_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("locations.id"), nullable=True
    )

    rfi: Mapped[RFI] = relationship(back_populates="refs")


class RFIPin(Base):
    __tablename__ = "rfi_pins"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    rfi_id: Mapped[str] = mapped_column(String(36), ForeignKey("rfis.id"), nullable=False)
    sheet_revision_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sheet_revisions.id"), nullable=False
    )
    x_norm: Mapped[float] = mapped_column(Float, nullable=False)
    y_norm: Mapped[float] = mapped_column(Float, nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)

    rfi: Mapped[RFI] = relationship(back_populates="pins")


class RFIAttachment(Base):
    __tablename__ = "rfi_attachments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    rfi_id: Mapped[str] = mapped_column(String(36), ForeignKey("rfis.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), default="photo")

    rfi: Mapped[RFI] = relationship(back_populates="attachments")


class RFIEvent(Base):
    __tablename__ = "rfi_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    rfi_id: Mapped[str] = mapped_column(String(36), ForeignKey("rfis.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    from_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    to_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    rfi: Mapped[RFI] = relationship(back_populates="events")


class DraftChangeOrder(Base):
    __tablename__ = "draft_change_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    rfi_id: Mapped[str] = mapped_column(String(36), ForeignKey("rfis.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    title: Mapped[Optional[str]] = mapped_column(String(240), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    cost_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    schedule_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class DraftMaterialOrder(Base):
    __tablename__ = "draft_material_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    rfi_id: Mapped[str] = mapped_column(String(36), ForeignKey("rfis.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    lines: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class SuggestedRFI(Base):
    __tablename__ = "suggested_rfis"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False
    )
    subject: Mapped[Optional[str]] = mapped_column(String(240), nullable=True)
    question: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
