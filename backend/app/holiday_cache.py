"""In-process HolidayLookup cache. 10-minute per-project TTL + fingerprint.

Refresh after a holiday/weekend write commits. No Redis, no pub/sub, no Prometheus.
"""

from __future__ import annotations

import asyncio
import threading
import time
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.calendar import CACHE_TTL_SECONDS, HolidayLookup, load_holiday_lookup


@dataclass
class _Entry:
    lookup: HolidayLookup
    loaded_at: float
    fingerprint: str


class HolidayLookupCache:
    def __init__(self) -> None:
        self._thread_lock = threading.RLock()
        self._async_lock = asyncio.Lock()
        self._entries: dict[str, _Entry] = {}

    def clear(self) -> None:
        with self._thread_lock:
            self._entries.clear()

    def get(self, db: Session, project_id: str) -> HolidayLookup:
        with self._thread_lock:
            hit = self._entries.get(project_id)
            if hit and time.monotonic() - hit.loaded_at < CACHE_TTL_SECONDS:
                return hit.lookup
            return self._store(db, project_id)

    def refresh(self, db: Session, project_id: str) -> HolidayLookup:
        """Reload after a holiday/weekend write commits so the next read is warm."""
        with self._thread_lock:
            return self._store(db, project_id)

    async def aget(self, db: Session, project_id: str) -> HolidayLookup:
        async with self._async_lock:
            return self.get(db, project_id)

    def _store(self, db: Session, project_id: str) -> HolidayLookup:
        lookup = load_holiday_lookup(db, project_id)
        self._entries[project_id] = _Entry(
            lookup=lookup,
            loaded_at=time.monotonic(),
            fingerprint=lookup.fingerprint,
        )
        return lookup


holiday_cache = HolidayLookupCache()
