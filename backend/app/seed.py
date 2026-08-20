from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.drawings import ensure_demo_drawings
from app.ids import (
    DEMO_ORG_NAME,
    DEMO_PROJECT_NAME,
    DRAWING_SET_ID,
    LOC_GRID_B4_ID,
    ORG_ID,
    PROJECT_ID,
    REV_S301_B_ID,
    REV_S301_C_ID,
    REV_S302_A_ID,
    SETTINGS_ID,
    SHEET_S301_ID,
    SHEET_S302_ID,
)
from app.db import ASSETS_DIR
from app.models import (
    DrawingSet,
    Location,
    Organization,
    Project,
    ProjectRFISettings,
    Sheet,
    SheetRevision,
)


def seed_demo(db: Session) -> None:
    ensure_demo_drawings(ASSETS_DIR)
    existing = db.get(Project, str(PROJECT_ID))
    if existing:
        return

    org = Organization(id=str(ORG_ID), name=DEMO_ORG_NAME)
    project = Project(
        id=str(PROJECT_ID),
        organization_id=str(ORG_ID),
        name=DEMO_PROJECT_NAME,
    )
    settings = ProjectRFISettings(
        id=str(SETTINGS_ID),
        project_id=str(PROJECT_ID),
        rfi_prefix="RFI",
        number_width=4,
    )
    drawing_set = DrawingSet(
        id=str(DRAWING_SET_ID),
        project_id=str(PROJECT_ID),
        name="Issued for Construction",
        issued_on=date(2026, 3, 12),
    )
    s301 = Sheet(
        id=str(SHEET_S301_ID),
        drawing_set_id=str(DRAWING_SET_ID),
        project_id=str(PROJECT_ID),
        sheet_number="S301",
        title="Foundation Plan",
        discipline="Structural",
    )
    s302 = Sheet(
        id=str(SHEET_S302_ID),
        drawing_set_id=str(DRAWING_SET_ID),
        project_id=str(PROJECT_ID),
        sheet_number="S302",
        title="Framing Plan",
        discipline="Structural",
    )
    revisions = [
        SheetRevision(
            id=str(REV_S301_B_ID),
            sheet_id=str(SHEET_S301_ID),
            revision="B",
            drawing_filename="s301-rev-b.png",
            issued_on=date(2026, 2, 20),
        ),
        SheetRevision(
            id=str(REV_S301_C_ID),
            sheet_id=str(SHEET_S301_ID),
            revision="C",
            drawing_filename="s301-rev-c.png",
            issued_on=date(2026, 3, 12),
        ),
        SheetRevision(
            id=str(REV_S302_A_ID),
            sheet_id=str(SHEET_S302_ID),
            revision="A",
            drawing_filename="s302-rev-a.png",
            issued_on=date(2026, 3, 12),
        ),
    ]
    location = Location(
        id=str(LOC_GRID_B4_ID),
        project_id=str(PROJECT_ID),
        name="Grid B-4",
        grid="B-4",
    )
    db.add_all([org, project, settings, drawing_set, s301, s302, location, *revisions])
    db.commit()


def has_demo_project(db: Session) -> bool:
    return db.scalar(select(Project.id).where(Project.id == str(PROJECT_ID))) is not None
