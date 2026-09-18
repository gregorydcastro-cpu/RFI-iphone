# GC Field Log — crew dashboard (web)

Browser **dashboard for field crews** on **[gcfieldlog.com](https://gcfieldlog.com)**. Foremen and supers sign in (stub), pick a job, request a room pack, then work the sheet: zoomable floor plans, room highlight, linked RFIs, and Generate RFI / Order materials.

This is the product surface. **Native iOS is paused. No Apple.** Real login and **Stripe monthly billing** are later — the login page is UI only. Wordmark is clean text: **GC Field Log** (no extra logo).

Host: **Vercel (primary)** with **HostGator DNS** for `gcfieldlog.com` (document only; this PR does not change DNS). Cloudflare Pages is a possible later target.

No real auth, Stripe, HostGator uploads, or live Procore REST API in this MVP. The **Room pack webhook routine is deleted** — this app does **not** call `procore_room_pack_webhook_url` / webhook Authorization.

**Live path:** the Procore bot (`969a9d8e-c07f-44c3-ae9d-862704cd60c7`) owns the Procore pull and upserts `public.room_packs` on Supabase project `aejevzkqvlwbmjbqdxuu`. The website reads that table with `SUPABASE_URL` + `SUPABASE_ANON_KEY` (`cache: "no-store"`) on every pack open. Pullers can request a refresh; viewers only read. Local demo leaves Supabase unset: Maple Point JSON, no pull.

## Locked nav (MVP)

Must match this path — nothing else in the primary nav:

**Login (stub) → Jobs → Room pack request → Pack viewer (plan + sheets + RFIs) → Generate RFI / Materials stubs.**

**Tools** and **Time** appear in the header as later (not wired). No Apple.

## What the dashboard shows (MVP)

| Area | Behavior |
| --- | --- |
| Login (`/`) | Email/password form UI. Checkbox **Linked Procore account (puller)** sets the stub `procoreLinked` cookie. Any submit goes to jobs. No session server. |
| Jobs (`/jobs`) | Fictional jobs only (Maple Point and similar). Header shows **Puller** or **View only**. |
| Room pack request | Room number (e.g. `733`). **Puller:** `POST /api/room-pack` asks the Procore bot to refresh, then opens `/pack/[requestId]`. **Viewer:** **Open pack** only — no pull. Local demo (no `SUPABASE_URL`) loads Maple Point JSON. |
| Pack viewer | Zoomable plan/sheets + SVG room highlight + linked RFIs. Top bar and sheet tabs show **drawing number + revision letter** from the pull (`E-101 Rev A`) plus `pulled_at`. Website open always re-reads `room_packs` (no-store). Pullers also trigger a bot refresh; viewers cannot. |
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
3. **Env:** the Maple Point demo needs **no** secrets. Production reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` (see below). Do **not** restore `procore_room_pack_webhook_url` / `procore_room_pack_webhook_authorization` for this live path — that routine is deleted.
4. **DNS (ops, not this repo):** at HostGator, point `gcfieldlog.com` / `www` to Vercel (A / CNAME per Vercel’s domain docs). Do not upload files to HostGator for this app.

### Roles (stub MVP)

Auth is still stubby. Default is **read-only viewer**. Only a **linked Procore account** (the puller) can trigger pulls.

| Mark a puller | How |
| --- | --- |
| Login checkbox | Check **Linked Procore account (puller)** before Enter dashboard |
| Cookie | `gcfieldlog_procore_linked=1; Path=/; SameSite=Lax` |
| Header (API) | `x-procore-linked: true` (also `1` / `yes` / `puller`) |

Viewers can open `/pack/[requestId]` and see sheets, RFIs, and revision stamps. Pull / file-pull controls are hidden. `POST /api/room-pack` and `POST /api/room-pack/refresh` return **403** for viewers.

This is not real auth. Anyone who can set the cookie is a puller. Replace with a real Procore-linked session later.

### Supabase + Procore bot (Vercel)

Read **only** these exact keys from `process.env` on the server. Never commit values, never `NEXT_PUBLIC_` them, never log them.

| Key | Role |
| --- | --- |
| `SUPABASE_URL` | `https://aejevzkqvlwbmjbqdxuu.supabase.co` |
| `SUPABASE_ANON_KEY` | Anon / publishable key for the gc-field-log project |

```ts
process.env.SUPABASE_URL
process.env.SUPABASE_ANON_KEY
```

- **Both set (Production):** website live view GETs the latest `public.room_packs` row with `cache: "no-store"`. Pullers POST a refresh that coordinates the **Procore bot** (`969a9d8e-c07f-44c3-ae9d-862704cd60c7`). The bot owns the Procore pull and upserts `room_packs`. The website then re-reads the latest row. No expiry timers.
- **Missing / local:** Maple Point JSON, **no** Supabase call, **no** bot pull.
- **Hard rule:** never display another job’s pack. Match project slug or exact job name.

The deleted webhook keys (`procore_room_pack_webhook_url`, `procore_room_pack_webhook_authorization`) are **not** used.

### `public.room_packs` (project `aejevzkqvlwbmjbqdxuu`)

Inspected live. Columns:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK, `gen_random_uuid()` |
| `project_name` | text | Job name (e.g. Maple Point Medical Office) |
| `pack_data` | jsonb | Full `gcpullog.room_pack.v1` document (`request_id`, `room`, `sheets[].id` / `sheets[].rev`, `pulled_at`, …) |
| `created_at` | timestamptz | Row insert time |
| `request_id` | text | Lookup key (nullable; backfilled from `pack_data`) |
| `room` | text | Room number/name (nullable; backfilled) |
| `pulled_at` | timestamptz | Pull timestamp (nullable; backfilled) |

Website read: latest row for `request_id` (then job slug), else `project_name` + `room`, else `project_name`, ordered by `pulled_at desc nulls last, created_at desc`.

Bot/ops persist: insert a new row (history) via `POST /api/room-pack/refresh` with `{ pack }` as a puller, or write `room_packs` directly. Latest row is source of truth.

**RLS is currently disabled** on `public.room_packs`, so the anon key can read and write every row. Enabling RLS without a SELECT policy would block the website. Suggested later (do not apply blindly):

```sql
ALTER TABLE public.room_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_packs_read_anon ON public.room_packs
  FOR SELECT TO anon, authenticated USING (true);
-- Keep INSERT/UPDATE for the Procore bot / service role, not the browser.
```

Local `npm run dev` does not need any of these variables.

**Cloudflare Pages** can host Next.js later. Keep Vercel as the primary.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Stub **login** (optional Procore-linked puller checkbox) |
| `/jobs` | Fictional **job selection** |
| `/jobs/[projectSlug]` | **Pull / open room pack** (puller POSTs `/api/room-pack`; viewer opens `/pack/[requestId]` only) |
| `/jobs/[projectSlug]/rooms/[room]` | Alias → `/pack/{slug}-{room}` (no pull; use the request form) |
| `/api/room-pack` | Puller POST. Requests a Procore bot refresh + reads `room_packs`. Demo when Supabase unset. |
| `/api/room-pack/refresh` | Puller POST. Bot refresh, optional `{ pack }` upsert, then latest `room_packs` row. |
| `/api/room-pack/live` | Anyone GET/POST. Latest `room_packs` row, `no-store`. Does not pull. |
| `/api/room-pack/status` | Alias of live read (no Drive poll, no webhook). |
| `/pack/[requestId]` | Live pack viewer. Re-reads on open. Unknown IDs fall back to local Maple Point demo |
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

Live packs are produced by the **Procore bot** (`969a9d8e-c07f-44c3-ae9d-862704cd60c7`) and stored in Supabase **`public.room_packs`**, schema `gcpullog.room_pack.v1`.

**Request (this app, Production, puller):** `POST /api/room-pack` or `POST /api/room-pack/refresh` asks that bot to pull, then reads the latest matching `room_packs` row with `SUPABASE_URL` + `SUPABASE_ANON_KEY` (`cache: "no-store"`). Opening `/pack/[requestId]` does the same read every time (pullers also trigger refresh). The website does **not** call the deleted Room pack webhook.

**Viewer:** GET `/api/room-pack/live` / open `/pack/[requestId]` only. No pull.

**Local demo:** `SUPABASE_URL` / `SUPABASE_ANON_KEY` unset → local Maple Point JSON.

The bot (or ops) persists by inserting a `room_packs` row (`project_name`, `request_id`, `room`, `pulled_at`, `pack_data`). Optional website callback: `POST /api/room-pack/refresh` with `{ pack }` and a puller cookie/header.

## Pack JSON contract (`gcpullog.room_pack.v1`)

Coordinate-ready: drop a JSON file at `public/packs/<requestId>.json` and open `/pack/<requestId>`. Demo packs are those local files. Production bot output uses this same shape in `room_packs.pack_data`.

```json
{
  "schema": "gcpullog.room_pack.v1",
  "status": "ready",
  "request_id": "maple-point",
  "pulled_at": "2026-09-18T00:15:17.277Z",
  "revision_stamp": { "drawing": "E-101", "rev": "A" },
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
| `pulled_at` | ISO timestamp of this pull. Shown in the pack viewer. Not a cache expiry. |
| `revision_stamp` | `{ drawing, rev }` for the primary sheet at pull time |
| `project` | `{ id, name, slug }` |
| `room` | `{ id, name, number? }` |
| `request_id` | URL key for `/pack/[requestId]` |
| `sheets[]` | `{ id, rev, pdf, preview?, crop? }` — `id` is the drawing number, `rev` is the revision letter. Tabs and the top bar show `E-101 Rev A`. |
| `rfis[]` | `{ id, number, title, status, url? }` |
| `layout` | Room locator on the sheet |
| `actions` | Dashboard buttons |
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

- Real crew **login** (replace the `procoreLinked` cookie)
- **Stripe** monthly billing
- **Tools** and **Time** nav
- Sent pack **snapshots** (text/email frozen copies — not in this PR)
- RLS policies on `public.room_packs` (table is currently wide open to the anon key)
- HostGator DNS cutover to Vercel for gcfieldlog.com
- No Apple / native iOS

## Demo data

**Maple Point / fictional only.** Do not use Brown, Rossi, ILSB, EL107, Danoff, Suffolk, or any real client names or production sheet IDs.

Sample files:

- `public/packs/maple-point.json`
- `public/packs/maple-point-e101.pdf`
- `public/packs/maple-point-e102.pdf`
