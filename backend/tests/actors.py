"""Seeded field-chain actors for HTTP tests."""

from sqlalchemy import delete

from app import db as dbmod
from app.ids import (
    SHOP_DRAFT_RFI_ID,
    USER_GREG_PE_ID,
    USER_HARBOR_AF_ID,
    USER_HARBOR_AF_ROOF_ID,
    USER_HARBOR_AP_ID,
    USER_HARBOR_FM_ID,
    USER_HARBOR_JM_ID,
)
from app.models import RFI, RFIAttachment, RFIEvent, RFIPin, RFIRef

SHOP_ACTORS = {
    "apprentice": USER_HARBOR_AP_ID,
    "journeyman": USER_HARBOR_JM_ID,
    "foreman": USER_HARBOR_FM_ID,
    "area_foreman": USER_HARBOR_AF_ID,
    "roof_area_foreman": USER_HARBOR_AF_ROOF_ID,
    "general_foreman": USER_GREG_PE_ID,
}


def actor_payload(role: str = "journeyman") -> dict:
    return {"user_id": str(SHOP_ACTORS[role]), "role": role}


def field_headers(role: str, *, pe: bool = False) -> dict:
    headers = {
        "X-User-Id": str(SHOP_ACTORS[role]),
        "X-Field-Role": "area_foreman" if role == "roof_area_foreman" else role,
    }
    if pe:
        headers["X-Field-Actor"] = "pe"
        headers["X-PE-Token"] = "pe-demo"
    return headers


def clear_seeded_shop_draft() -> None:
    """Remove the seeded E-101 open draft so a test can create a fresh one."""
    db = dbmod.SessionLocal()
    try:
        rid = str(SHOP_DRAFT_RFI_ID)
        if db.get(RFI, rid):
            for model in (RFIPin, RFIRef, RFIEvent, RFIAttachment):
                db.execute(delete(model).where(model.rfi_id == rid))
            db.execute(delete(RFI).where(RFI.id == rid))
            db.commit()
    finally:
        db.close()
