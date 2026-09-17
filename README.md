# GC Pull Log — crew dashboard (web)

Browser **dashboard for field crews** on [gcpullog.com](https://gcpullog.com). Foremen and supers open a room pack in the browser: zoomable floor-plan sheets, the room highlighted on the sheet, linked RFIs, and action buttons (Generate RFI / Order materials).

This is the product surface. **Native iOS is paused.** Login and **Stripe monthly billing** are planned later — they are not in this MVP.

Host: **Vercel (primary)**. Cloudflare Pages is a possible later target; this repo is set up as a standard Next.js App Router app for Vercel.

No auth, Stripe, or live Procore API yet.

## What the dashboard shows (MVP)

| Area | Behavior |
| --- | --- |
| Floor plan / sheet | Zoomable, pannable PDF (`pdf.js`) with sheet tabs |
| Room highlight | SVG overlay (polygon or bbox in normalized 0–1 sheet coords) |
| RFI list | Linked RFIs for the room |
| Actions | **Generate RFI** (draft to foreman — not a Procore submit) and **Order materials** — stubs |
| Takeoff counts | Optional placeholder panel (demo pack has sample `by_room` counts; omit `takeoff` for an empty stub) |

## Local run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Home is the **Maple Point Medical Office** fictional demo only.

```bash
npm run build
npm start
```

`npm install` copies the pdf.js worker into `public/pdf.worker.min.mjs`. Regenerate demo sheets with `npm run generate-demo`.

## Deploy (Vercel, primary)

This is a standard Next.js App Router app. Production host for the crew dashboard is **gcpullog.com**.

1. Import the GitHub repo in [Vercel](https://vercel.com/new) (framework preset: **Next.js**).
2. Build command: `npm run build` (default). Output: Next.js default.
3. `postinstall` copies `pdf.worker.min.mjs` into `public/` so the sheet viewer works on the deployment.
4. No env secrets are required for the static Maple Point demo packs.
5. Attach the `gcpullog.com` domain (or a Vercel preview URL) when DNS is ready.

**Cloudflare Pages** can host Next.js later (via OpenNext / `@cloudflare/next-on-pages`). Do not treat that as the current deploy path; keep Vercel as the primary.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Maple Point fictional demo pack |
| `/pack/[requestId]` | **Primary** dashboard view. Loads `public/packs/<requestId>.json` |
| `/pack/[requestId]/rfi/new?sheet=` | Stub “Generate RFI” form (disabled) |
| `/pack/[requestId]/materials` | Stub “Order materials” page |
| `/jobs/[projectSlug]/rooms/[room]` | Optional alias stub (Maple Point redirects to `/pack/maple-point`) |

## Where production packs come from

Live packs are produced by **Procore’s Room pack webhook**, schema `gcpullog.room_pack.v1`.

This MVP **does not call that webhook**. The dashboard consumes the **local Maple Point demo** at `public/packs/maple-point.json`. Production will **poll the same v1 JSON** from Drive (below) and feed it to `/pack/[requestId]` — no change to the contract.

### Drive layout (Greg / ops — not secrets)

Status JSON lands next to the room folder:

```
{project_slug}/{request_id}.json
{project_slug}/Room_{room}/
```

Drive root: [GC Pull Log room packs](https://drive.google.com/drive/folders/19Ixner0dApGlfpG13M2XOw2rzReQGl3P)

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
| `sheets[]` | `{ id, rev, pdf, preview?, crop? }` — `pdf` is a URL the viewer fetches |
| `rfis[]` | `{ id, number, title, status, url? }` |
| `layout` | Room locator on the sheet (see highlight rules) |
| `actions[]` | Dashboard buttons; omitted packs get Generate RFI + Order materials defaults |
| `takeoff` | **Optional.** If missing, the Takeoff counts panel is an empty placeholder |

### Highlight (coordinate-ready)

The overlay is an **SVG** on the sheet, not a baked highlight image.

1. `layout.points` — polygon in **normalized 0–1** coordinates, origin **top-left** of the sheet.
2. Else `layout.bbox` `{x,y,w,h}` — same normalized space.
3. Else Procore `layout.bbox_pdf_pts` — PDF user-space points, origin **bottom-left**. Mapped with `page_width_pts` / `page_height_pts` (or the rendered page size) into a normalized top-left rect.

### Optional takeoff counts (placeholder)

The dashboard always shows a Takeoff counts section. With no `takeoff` object it stays empty. When present, the stub panel renders `by_room` (and the rest of this shape is reserved for later):

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

### Actions

Buttons come from `actions[]`, or default to **Generate RFI** (draft to foreman — not a Procore submit) and **Order materials**. MVP handlers are toasts / console stubs. Future deep-links: `/pack/[requestId]/rfi/new?sheet=` and `/pack/[requestId]/materials`.

## Later (not in this PR)

- Crew **login**
- **Stripe** monthly billing
- Poll Drive / Procore Room pack webhook v1 JSON (viewer still will not invoke the webhook itself)

## Demo data

**Maple Point / fictional only.** Do not use Brown, Rossi, ILSB, EL107, Danoff, Suffolk, or any real client names or production sheet IDs.

Sample files:

- `public/packs/maple-point.json`
- `public/packs/maple-point-e101.pdf`
- `public/packs/maple-point-e102.pdf`

Add another pack by dropping `<requestId>.json` (and PDFs) into `public/packs/` and opening `/pack/<requestId>`.
