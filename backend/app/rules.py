"""Shared validation for the draft path — extra/forbidden keys, search matching."""

from __future__ import annotations

from typing import Any

from app.schemas import ALLOWED_TOP_LEVEL, FORBIDDEN_DRAFT_KEYS, OPEN_STATUSES


class DraftValidationError(ValueError):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


SKIP_FORBIDDEN_WALK = frozenset({"open_rfis_same_sheet"})


def walk_forbidden_keys(payload: Any, path: str = "") -> list[str]:
    """Reject forbidden keys on the draft being written.

    `open_rfis_same_sheet` may include status of *existing* RFIs from search.
    Those are not fields on the new draft.
    """
    hits: list[str] = []
    if isinstance(payload, dict):
        for key, value in payload.items():
            here = f"{path}.{key}" if path else key
            if key in SKIP_FORBIDDEN_WALK and not path:
                continue
            if key in FORBIDDEN_DRAFT_KEYS:
                hits.append(here)
            hits.extend(walk_forbidden_keys(value, here))
    elif isinstance(payload, list):
        for i, item in enumerate(payload):
            hits.extend(walk_forbidden_keys(item, f"{path}[{i}]"))
    return hits


def validate_draft_payload(raw: dict[str, Any]) -> None:
    if not isinstance(raw, dict):
        raise DraftValidationError("create_rfi_draft expects a JSON object.")
    extra = sorted(set(raw) - ALLOWED_TOP_LEVEL)
    if extra:
        raise DraftValidationError(
            f"Extra keys are forbidden on a draft: {', '.join(extra)}."
        )
    forbidden = walk_forbidden_keys(raw)
    if forbidden:
        raise DraftValidationError(
            "Forbidden draft keys: "
            + ", ".join(forbidden)
            + ". Do not set status, rfi_number, rfi_display, due_at, "
            "official_response, or submit/close fields from the draft path."
        )


def is_open_status(status: str | None) -> bool:
    return (status or "") in OPEN_STATUSES
