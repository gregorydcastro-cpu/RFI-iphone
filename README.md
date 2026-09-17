# GC Field Log — crew dashboard (web)

Browser **dashboard for field crews** on **[gcfieldlog.com](https://gcfieldlog.com)**. Foremen and supers sign in (stub), pick a job, request a room pack, then work the sheet: zoomable floor plans, room highlight, linked RFIs, and Generate RFI / Order materials.

This is the product surface. **Native iOS is paused. No Apple.** Real login and **Stripe monthly billing** are later — the login page is UI only. Wordmark is clean text: **GC Field Log** (no extra logo).

Host: **Vercel (primary)** with **HostGator DNS** for `gcfieldlog.com` (document only; this PR does not change DNS). Cloudflare Pages is a possible later target.

No real auth, Stripe, HostGator uploads, or live Procore REST API in this MVP. Requesting a room pack **does** POST to Procore’s Room pack webhook when the two lowercase Vercel env keys are set (Production), then polls Drive/status JSON in the background. Local demo leaves those unset: no webhook, no poll, Maple Point JSON.

## Locked nav (MVP)

Must match this path — nothing else in the primary nav:

**Login (stub) → Jobs → Room pack request → Pack viewer (plan + sheets + RFIs) → Generate RFI / Materials stubs.**

**Tools** and **Time** appear in the header as later (not wired). No Apple.

## What the dashboard shows (MVP)

| Area | Behavior |
| --- | --- |
| Login (`/`) | Email/password form UI. Any submit goes to jobs. No session server. |
| Jobs (`/jobs`) | Fictional jobs only (Maple Point and similar). |
| Room pack request | Room number (e.g. `733`) → `POST /api/room-pack` → `/pack/[requestId]`. Local demo loads Maple Point JSON immediately (no webhook, no poll). Production POSTs the selected job’s **exact name** to the Procore webhook, opens the pack page as soon as the webhook accepts, and polls `{project_slug}/{request_id}.json` until `ready`. Missing pack JSON still falls back to Maple Point while pending. |
| Pack viewer | Zoomable plan/sheets + SVG room highlight + linked RFIs |
| Generate RFI / Materials | Stub pages from the pack action buttons |
| Takeoff counts | Optional placeholder panel |

## Local run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in (stub) → pick **Maple Point Medical Office** → request room `733`.

```bash
npm run lint
npm run build
npm start
```

`npm install` copies the pdf.js worker into `public/pdf.worker.min.mjs`.

## Deploy (Vercel + HostGator DNS)

Production host is **gcfieldlog.com**.

1. Import this GitHub repo in [Vercel](https://vercel.com/new) (framework preset: **Next.js**).
2. Build command: `npm run build`. `postinstall` copies `pdf.worker.min.mjs`.
3. **Env:** the Maple Point demo needs **no** secrets. Production already has the two lowercase Procore webhook keys (see below). Do not add `PROCORE_ROOM_PACK_*` aliases unless you also wire both directions. Drive API credentials are **not** on Vercel today — polling uses the status interface described below.
4. **DNS (ops, not this repo):** at HostGator, point `gcfieldlog.com` / `www` to Vercel (A / CNAME per Vercel’s domain docs). Do not upload files to HostGator for this app.

### Procore Room pack webhook env (Vercel)

Read **only** these exact lowercase keys from `process.env` on the server (`POST /api/room-pack`). They are already set on **Vercel Production**. Never commit values, never `NEXT_PUBLIC_` them, never log them.

| Key | Role |
| --- | --- |
| `procore_room_pack_webhook_url` | Webhook URL (POST target) |
| `procore_room_pack_webhook_authorization` | Sent as the `Authorization` header, verbatim |

```ts
process.env.procore_room_pack_webhook_url
process.env.procore_room_pack_webhook_authorization
```

- **Both set** (Production): request pack POSTs `{ "project": "<exact job name>", "room": "<room>", "request_id": "..." }` and treats a 2xx as accepted. The UI navigates to `/pack/[requestId]?accepted=1` without waiting for the full pack, then polls status in the background.
- **Missing / local:** same as today — local Maple Point JSON, **no** webhook call, **no** Drive poll.
- **Hard rule:** `project` is the selected job’s exact `name` from the jobs list (looked up server-side from `projectSlug`). Never send another job’s name. Never mix jobs.

### Drive / status poll (after accept)

Live packs land at `{project_slug}/{request_id}.json` under [GC Field Log room packs](https://drive.google.com/drive/folders/19Ixner0dApGlfpG13M2XOw2rzReQGl3P).

`GET`/`POST /api/room-pack/status` is the poll client:

1. Local `public/packs/<requestId>.json` if present and `status` is `ready` (and the pack’s project matches the selected job).
2. Else HTTP GET of a public JSON / status URL:
   - Optional lowercase `procore_room_pack_status_url` (not on Production today) — template with `{project_slug}`, `{request_id}`, `{path}`.
   - Or `status_url` / `json_url` / `pack_url` on the webhook accept JSON (https Drive/Google hosts only).
3. Else **Drive API stub**: no Drive credentials are in Vercel env, so the interface returns `pending` / `unconfigured` and the pack page keeps showing accepted/pending + Maple Point demo. It does **not** block waiting for the file.

The viewer polls about every 3s and stops after ~2 minutes (refresh to check again). Secrets are never logged.

**To finish Drive fetch later (not invented on Vercel):** a Google service account or API key that can read folder `19Ixner0dApGlfpG13M2XOw2rzReQGl3P`, stored under whatever **lowercase** key Field Log actually adds. Wire that in `fetchDrivePackJson` — do not add `DRIVE_*` uppercase names unless you also alias both directions. Until then, set `procore_room_pack_status_url` to a public JSON URL template, or have the webhook return a status URL.

Local `npm run dev` does not need any of these variables.

**Cloudflare Pages** can host Next.js later. Keep Vercel as the primary.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Stub **login** |
| `/jobs` | Fictional **job selection** |
| `/jobs/[projectSlug]` | **Request room pack** (room number → `POST /api/room-pack` → `/pack/[requestId]`) |
| `/jobs/[projectSlug]/rooms/[room]` | Alias → `/pack/{slug}-{room}` (no webhook; use the request form) |
| `/api/room-pack` | Server POST. Forwards to Procore when both lowercase webhook keys are set; otherwise demo. |
| `/api/room-pack/status` | Poll `{project_slug}/{request_id}.json` (local file, public JSON URL, or Drive stub). |
| `/pack/[requestId]` | Pack viewer. Unknown IDs fall back to local Maple Point demo |
| `/pack/[requestId]/rfi/new?sheet=` | Stub Generate RFI form |
| `/pack/[requestId]/materials` | Stub Order materials |

## Theme tokens (GlineRacing, adapted)

Observed on [glineracing.com](https://glineracing.com) live CSS (`/_next/static/css/f2c975d8c7508e2f.css`, 2026-09-17). Field dashboard keeps those surfaces and uses a **racing red CTA** so primary buttons stay high-contrast on dark panels.

| Token | Value | Use |
| --- | --- | --- |
| `--color-primary` | `#191616` | Header, cards, side panel |
| `--color-secondary` | `#f5f1eb` | Primary type |
| `--color-accent-1` | `#673b2f` | Warm brown-red (badges / deep fill) |
| `--color-accent-2` | `#6d9ca5` | Muted labels |
| `--color-accent-3` | `#4d7798` | Answered / steel info |
| `--color-tan` | `#c8bdac` | Secondary type / metal |
| gray-900 | `#111827` | Page background, sheet well |
| gray-800 | `#1f2937` | Raised charcoal |
| `--color-cta` | `#e10600` | Primary buttons, active tabs, room highlight |
| `--color-cta-hover` | `#ff2b1a` | Button hover |
| Display font | Oswald | Clean **GC Field Log** wordmark |
| UI font | Geist | Body |

Defined in `app/globals.css`.

## Where production packs come from

Live packs are produced by **Procore’s Room pack webhook**, schema `gcpullog.room_pack.v1`.

**Request (this app, Production):** `POST /api/room-pack` reads the lowercase Vercel keys and POSTs `{ project, room, request_id }` to `procore_room_pack_webhook_url` with `Authorization` from `procore_room_pack_webhook_authorization`. A 2xx is accepted; the dashboard does **not** wait for the pack to finish. It opens `/pack/[requestId]` (accepted/pending) and polls `/api/room-pack/status` until `status` is `ready`. Maple Point demo fallback stays until that JSON exists and matches the selected job.

**Local demo:** webhook keys unset → no webhook POST → no poll → local Maple Point JSON.

### Drive layout (Greg / ops — not secrets)

```
{project_slug}/{request_id}.json
{project_slug}/Room_{room}/
```

Drive root: [GC Field Log room packs](https://drive.google.com/drive/folders/19Ixner0dApGlfpG13M2XOw2rzReQGl3P)

That folder is an ops pointer, not a credential. Do not put Drive API keys or webhook secrets in this app.

## Pack JSON contract (`gcpullog.room_pack.v1`)

Coordinate-ready: drop a JSON file at `public/packs/<requestId>.json` and open `/pack/<requestId>`. Demo packs are those local files. Production webhook output uses this same shape.

```json
{
  "schema": "gcpullog.room_pack.v1",
  "status": "ready",
  "request_id": "maple-point",
  "project": { "id": "proj-maple-point", "name": "Maple Point Medical Office", "slug": "maple-point" },
  "room": { "id": "room-e101", "name": "Electrical Closet 101", "number": "101" },
  "sheets": [
    { "id": "E-101", "rev": "A", "pdf": "/packs/maple-point-e101.pdf", "preview": null, "crop": null }
  ],
  "rfis": [
    { "id": "r1", "number": "RFI-001", "title": "Panel feed clarification", "status": "open", "url": null }
  ],
  "layout": {
    "sheet": "E-101",
    "type": "polygon",
    "locator": "Electrical Closet 101",
    "points": [[0.2, 0.2], [0.5, 0.2], [0.5, 0.5], [0.2, 0.5]],
    "bbox": { "x": 0.2, "y": 0.2, "w": 0.3, "h": 0.3 },
    "bbox_pdf_pts": { "x": 244.8, "y": 396, "w": 367.2, "h": 237.6 },
    "page_width_pts": 1224,
    "page_height_pts": 792
  },
  "actions": [
    { "id": "generate-rfi", "label": "Generate RFI", "href": "/pack/maple-point/rfi/new?sheet=E-101", "enabled": false },
    { "id": "order-materials", "label": "Order materials", "href": "/pack/maple-point/materials", "enabled": false }
  ]
}
```

| Field | Notes |
| --- | --- |
| `status` | e.g. `ready` / `pending` — shown in the top bar |
| `project` | `{ id, name, slug }` |
| `room` | `{ id, name, number? }` |
| `request_id` | URL key for `/pack/[requestId]` |
| `sheets[]` | `{ id, rev, pdf, preview?, crop? }` |
| `rfis[]` | `{ id, number, title, status, url? }` |
| `layout` | Room locator on the sheet |
| `actions[]` | Dashboard buttons |
| `takeoff` | **Optional.** If missing, Takeoff counts is empty |

### Highlight (coordinate-ready)

The overlay is an **SVG** on the sheet (crimson stroke), not a baked highlight image.

1. `layout.points` — polygon in **normalized 0–1** coordinates, origin **top-left**.
2. Else `layout.bbox` `{x,y,w,h}` — same space.
3. Else Procore `layout.bbox_pdf_pts` — PDF user-space, origin **bottom-left**, mapped with `page_width_pts` / `page_height_pts`.

### Optional takeoff counts (placeholder)

Always shown. Empty without `takeoff`. When present, renders `by_room`:

```json
{
  "project": "Maple Point Medical Office",
  "scope": "Electrical Closet 101 — Level 1 power",
  "sheets": ["E-101"],
  "units": "each",
  "by_room": [
    {
      "room": "101",
      "name": "Electrical Closet 101",
      "sheet": "E-101",
      "fixtures": [{ "type": "Junction box 4sq", "qty": 6 }]
    }
  ],
  "by_type": [{ "type": "Junction box 4sq", "qty": 6 }],
  "by_sheet": [{ "sheet": "E-101", "qty": 6 }],
  "confidence": "demo",
  "flags": ["fictional-project"]
}
```

## Later (not implemented)

- Real crew **login**
- **Stripe** monthly billing
- **Tools** and **Time** nav
- Drive API credentials on Vercel (status poll interface is in; `fetchDrivePackJson` is unconfigured until Field Log stores lowercase creds)
- HostGator DNS cutover to Vercel for gcfieldlog.com
- No Apple / native iOS

## Demo data

**Maple Point / fictional only.** Do not use Brown, Rossi, ILSB, EL107, Danoff, Suffolk, or any real client names or production sheet IDs.

Sample files:

- `public/packs/maple-point.json`
- `public/packs/maple-point-e101.pdf`
- `public/packs/maple-point-e102.pdf`
