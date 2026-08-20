"""Seeded field-chain actors for HTTP tests."""

from app.ids import (
    USER_GREG_PE_ID,
    USER_HARBOR_AF_ID,
    USER_HARBOR_AF_ROOF_ID,
    USER_HARBOR_AP_ID,
    USER_HARBOR_FM_ID,
    USER_HARBOR_JM_ID,
    USER_ILSB_AP_ID,
    USER_ILSB_JM_ID,
)

HARBOR_ACTORS = {
    "apprentice": USER_HARBOR_AP_ID,
    "journeyman": USER_HARBOR_JM_ID,
    "foreman": USER_HARBOR_FM_ID,
    "area_foreman": USER_HARBOR_AF_ID,
    "roof_area_foreman": USER_HARBOR_AF_ROOF_ID,
    "general_foreman": USER_GREG_PE_ID,
}


def actor_payload(role: str = "journeyman", *, ils: bool = False) -> dict:
    if ils:
        user_id = USER_ILSB_AP_ID if role == "apprentice" else USER_ILSB_JM_ID
        return {"user_id": str(user_id), "role": role}
    return {"user_id": str(HARBOR_ACTORS[role]), "role": role}


def field_headers(role: str, *, pe: bool = False) -> dict:
    headers = {
        "X-User-Id": str(HARBOR_ACTORS[role]),
        "X-Field-Role": "area_foreman" if role == "roof_area_foreman" else role,
    }
    if pe:
        headers["X-Field-Actor"] = "pe"
        headers["X-PE-Token"] = "pe-demo"
    return headers
