# GC Field Log — crew dashboard (web)

Browser **dashboard for field crews** on **[gcfieldlog.com](https://gcfieldlog.com)**. Foremen and supers sign in (stub), pick a job, request a room pack, then work the sheet: zoomable floor plans, room highlight, linked RFIs, and Generate RFI / Order materials.

This is the product surface. **Native iOS is paused. No Apple.** Real login and **Stripe monthly billing** are later — the login page is UI only. Wordmark is clean text: **GC Field Log** (no extra logo).

Host: **Vercel (primary)** with **HostGator DNS** for `gcfieldlog.com` (document only; this PR does not change DNS). Cloudflare Pages is a possible later target.

No real auth, Stripe, HostGator uploads, or live Procore REST API in this MVP. Opening a website pack view **asks the Procore bot** to refresh, then reads the latest `public.room_packs.pack_data` row with `SUPABASE_URL` + `SUPABASE_ANON_KEY` (`cache: "no-store"`). Webhook writes are abandoned. Local demo leaves Supabase unset: Maple Point JSON.

## Locked nav (MVP)

Must match this path — nothing else in the primary nav:

**Login (stub) → Jobs → Room pack request → Pack viewer (plan + sheets + RFIs) → Generate RFI / Materials stubs.**

**Tools** and **Time** appear in the header as later (not wired). No Apple.

## What the dashboard shows (MVP)

| Area | Behavior |
| --- | --- |
| Login (`/`) | Email/password form UI. Any submit goes to jobs. No session server. |
| Jobs (`/jobs`) | Fictional jobs only (Maple Point and similar). |
| Room pack request | Room number (e.g. `733`) → `POST /api/room-pack` → `/pack/[requestId]`. Local demo loads Maple Point JSON when Supabase is unset. Live asks the Procore bot to refresh, then reads `room_packs`. |
| Pack viewer | Zoomable plan/sheets + SVG room highlight + linked RFIs. Top bar and sheet tabs show **drawing number + revision letter** (`E-101 Rev A`) and `pulled_at`. **Every open** of `/pack/[requestId]` coordinates a bot refresh and re-reads `pack_data` (no expiry, no website cache as source of truth). |
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
3. **Env:** the Maple Point demo needs **no** secrets. Production reads `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Webhook writes (`procore_room_pack_webhook_*`) are **abandoned** — do not POST them from this app.
4. **DNS (ops, not this repo):** at HostGator, point `gcfieldlog.com` / `www` to Vercel (A / CNAME per Vercel’s domain docs). Do not upload files to HostGator for this app.

### Supabase `public.room_packs` (locked contract)

Project `aejevzkqvlwbmjbqdxuu`. Read with exact Vercel keys (never `NEXT_PUBLIC_`, never log):

```ts
process.env.SUPABASE_URL
process.env.SUPABASE_ANON_KEY
```

Table columns (only these):

| Column | Type |
| --- | --- |
| `id` | uuid PK, `gen_random_uuid()` |
| `project_name` | text |
| `pack_data` | jsonb default `{}` |
| `created_at` | timestamptz default `now()` |

`request_id`, `room`, `pulled_at`, `company_id` live **inside** `pack_data`, not as columns.

`pack_data` is `gcpullog.room_pack.v1`: `request_id`, `status`, `project` (exact name), `room`, `pulled_at`, `company_id` (from the selected job — never one hardcoded company), `project_id`, `sheets[{id, rev, …}]`, `rfis`, `locator`, `pack_pdf`, `layout`, `actions`, `flags`.

Website live view: latest row ordered by `created_at desc`, filtered by `project_name` / `pack_data.request_id` / `pack_data.room` as available (`cache: "no-store"`).

Procore bot id `969a9d8e-c07f-44c3-ae9d-862704cd60c7` owns the Procore pull and writes `room_packs`. Opening `/pack/[requestId]` requests that refresh, then reads. **Missing / local:** Maple Point JSON.

No pack expiry timers. No heavy website cache. Re-pull on open.

**Cloudflare Pages** can host Next.js later. Keep Vercel as the primary.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Stub **login** |
| `/jobs` | Fictional **job selection** |
| `/jobs/[projectSlug]` | **Request room pack** (room number → `POST /api/room-pack` → `/pack/[requestId]`) |
| `/jobs/[projectSlug]/rooms/[room]` | Alias → `/pack/{slug}-{room}` |
| `/api/room-pack` | Server POST. Procore bot refresh + `room_packs` read when Supabase is set; otherwise demo. |
| `/api/room-pack/refresh` | Bot refresh + latest `pack_data` (used on every `/pack/[requestId]` open). |
| `/api/room-pack/status` | Latest `pack_data` row, no-store, no pull. |
| `/pack/[requestId]` | Live pack viewer. Re-pulls on open. Unknown IDs fall back to Maple Point demo |
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

Live packs are written by the **Procore bot** (`969a9d8e-c07f-44c3-ae9d-862704cd60c7`) into Supabase **`public.room_packs.pack_data`** (`gcpullog.room_pack.v1`). Webhook writes are abandoned.

**Website live view:** every open of `/pack/[requestId]` requests a bot refresh, then GETs the latest matching row with `SUPABASE_URL` + `SUPABASE_ANON_KEY` (`cache: "no-store"`). Local demo JSON is **not** the live source of truth.

**Local demo:** Supabase unset → Maple Point JSON.

## Pack JSON contract (`gcpullog.room_pack.v1`)

Coordinate-ready: drop a JSON file at `public/packs/<requestId>.json` and open `/pack/<requestId>`. Demo packs are those local files. Production bot output uses this same shape in `room_packs.pack_data`.

```json
{
  "schema": "gcpullog.room_pack.v1",
  "status": "ready",
  "request_id": "maple-point",
  "pulled_at": "2026-09-18T00:15:17.277Z",
  "revision_stamp": { "drawing": "E-101", "rev": "A" },
  "company_id": "<job company id>",
  "project_id": "proj-maple-point",
  "locator": "Electrical Closet 101",
  "pack_pdf": "/packs/maple-point-e101.pdf",
  "flags": ["fictional-project"],
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
| `pulled_at` | ISO timestamp of this pull (in `pack_data`). Shown in the viewer. Not a cache expiry. |
| `revision_stamp` | `{ drawing, rev }` for the primary sheet at pull time |
| `company_id` | That job’s Procore company id — never a single hardcoded value |
| `project_id` | Procore / pack project id |
| `project` | Exact job name (string or `{ id, name, slug }`) |
| `room` | Room number/name (string or `{ id, name, number? }`) |
| `request_id` | URL key for `/pack/[requestId]` |
| `sheets[]` | `{ id, rev, pdf, preview?, crop? }` — `id` is the drawing number, `rev` is the revision letter |
| `locator` | Room locator (also `layout.locator`) |
| `pack_pdf` | Optional whole-pack PDF |
| `flags` | Optional string tags |
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
- Read-only vs puller **roles**
- Texted/emailed pack **snapshots**
- **Stripe** monthly billing
- **Tools** and **Time** nav
- HostGator DNS cutover to Vercel for gcfieldlog.com
- No Apple / native iOS

## Demo data

**Maple Point / fictional only.** Do not use Brown, Rossi, ILSB, EL107, Danoff, Suffolk, or any real client names or production sheet IDs.

Sample files:

- `public/packs/maple-point.json`
- `public/packs/maple-point-e101.pdf`
- `public/packs/maple-point-e102.pdf`
