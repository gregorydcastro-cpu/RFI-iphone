## Offline pack cache vs live Procore re-pull

**Online (www): always live.** Opening `/pack/[requestId]` still re-reads `room_packs` with `cache: "no-store"`. Connected pullers still POST `/api/room-pack/refresh` (Procore REST, then bot). The device cache is **never** the online source of truth and is **not** a second Procore path.

**Offline (no signal / fetch fail):** if that live fetch throws or the response is not a pack, the viewer serves the **last good snapshot already pulled onto this device** so sheets and RFIs still open. A racing-red banner reads **“Offline — showing cached pack from …”** plus the drawing + rev stamp (`A-101 Rev A`).

| | Live re-pull | Device cache |
| --- | --- | --- |
| When | Browser can reach the site | Network miss after the live attempt |
| Source | Procore REST / bot / `room_packs` | IndexedDB snapshot + Cache Storage PDF blobs |
| Key | Server `request_id` | `project + pack/room id + revision stamp` |
| Expiry | None (`pulled_at` is display-only) | **Calendar day `America/New_York`** (“day’s packs”). Midnight ET drops yesterday’s snapshots. |

PDFs are the same viewer URLs as online (`/api/sheet-pdf?requestId=&sheetId=` or same-origin `/packs/*.pdf`). A **minimal** service worker (`/offline-pack-sw.js`) is network-first for those PDF GETs only — it does **not** intercept `/api/room-pack/*`. This is not a full offline PWA; a hard refresh of the app shell while fully offline is out of scope.

Scaffold: `lib/offlinePackCache.ts` (keying / expiry), `lib/offlinePackStore.ts` (IndexedDB + Cache Storage), wired from `PackLiveReload` / `SheetViewer`.
