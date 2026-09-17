# GC Field Log — crew dashboard (web)

Browser **dashboard for field crews** on **[gcfieldlog.com](https://gcfieldlog.com)**. Foremen and supers sign in (stub), pick a job, request a room pack, then work the sheet: zoomable floor plans, room highlight, linked RFIs, and Generate RFI / Order materials.

This is the product surface. **Native iOS is paused. No Apple.** Real login and **Stripe monthly billing** are later — the login page is UI only. Wordmark is clean text: **GC Field Log** (no extra logo).

Host: **Vercel (primary)** with **HostGator DNS** for `gcfieldlog.com` (document only; this PR does not change DNS). Cloudflare Pages is a possible later target.

No real auth, Stripe, HostGator uploads, or live Procore API in this MVP.

## Locked nav (MVP)

Must match this path — nothing else in the primary nav:

**Login (stub) → Jobs → Room pack request → Pack viewer (plan + sheets + RFIs) → Generate RFI / Materials stubs.**

**Tools** and **Time** appear in the header as later (not wired). No Apple.

## What the dashboard shows (MVP)

| Area | Behavior |
| --- | --- |
| Login (`/`) | Email/password form UI. Any submit goes to jobs. No session server. |
| Jobs (`/jobs`) | Fictional jobs only (Maple Point and similar). |
| Room pack request | Room number (e.g. `733`) → `requestId` → pack viewer. Demo loads local Maple Point JSON immediately. |
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
3. No env secrets are required for the Maple Point demo.
4. **DNS (ops, not this repo):** at HostGator, point `gcfieldlog.com` / `www` to Vercel (A / CNAME per Vercel’s domain docs). Do not upload files to HostGator for this app.

**Cloudflare Pages** can host Next.js later. Keep Vercel as the primary.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Stub **login** |
| `/jobs` | Fictional **job selection** |
| `/jobs/[projectSlug]` | **Request room pack** (room number → requestId) |
| `/jobs/[projectSlug]/rooms/[room]` | Alias → `/pack/{slug}-{room}` |
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

This MVP **does not call that webhook**. Requesting a room navigates to `/pack/{projectSlug}-{room}` and **loads the local Maple Point demo** when that JSON is missing.

Production will:

1. **POST** the room-pack request to the Procore Room pack webhook.
2. **Poll** Drive v1 status JSON until `status` is `ready`.
3. Open `/pack/[requestId]` with that JSON.

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
- Poll Drive / Procore Room pack webhook v1 JSON (viewer still will not invoke the webhook itself)
- HostGator DNS cutover to Vercel for gcfieldlog.com
- No Apple / native iOS

## Demo data

**Maple Point / fictional only.** Do not use Brown, Rossi, ILSB, EL107, Danoff, Suffolk, or any real client names or production sheet IDs.

Sample files:

- `public/packs/maple-point.json`
- `public/packs/maple-point-e101.pdf`
- `public/packs/maple-point-e102.pdf`
