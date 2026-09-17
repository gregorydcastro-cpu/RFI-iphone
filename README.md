# GC Pull Log — room-pack viewer

Web-first construction **room-pack viewer** for [gcpullog.com](https://gcpullog.com). Superintendents and foremen open a room pack in the browser: sheet, room highlight, linked RFIs, takeoff counts, and stub actions.

**Native iOS is paused.** This repo is no longer an iPhone stub. The default entry is a Next.js (App Router) app meant for Vercel.

No auth, Stripe, or live Procore API in this MVP.

## Local run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The home page is the **Maple Point Medical Office** fictional demo only.

```bash
npm run build
npm start
```

`npm install` copies the pdf.js worker into `public/pdf.worker.min.mjs`. Regenerate demo sheets with `npm run generate-demo`.

## Deploy on Vercel

This is a standard Next.js app. Import the GitHub repo in Vercel (framework preset: Next.js). Build command `npm run build`, output as Next.js default. `postinstall` copies the pdf.js worker the sheet viewer needs.

Point the production host at gcpullog.com (or a preview URL) when DNS is ready. No server secrets are required for the static demo packs.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Maple Point fictional demo pack |
| `/pack/[requestId]` | **Primary** viewer. Loads `public/packs/<requestId>.json` |
| `/pack/[requestId]/rfi/new?sheet=` | Stub “Generate RFI” form (disabled) |
| `/pack/[requestId]/materials` | Stub “Order materials” page |
| `/jobs/[projectSlug]/rooms/[room]` | Optional alias stub (Maple Point redirects to `/pack/maple-point`) |

## Pack contract (`gcpullog.room_pack.v1`)

Demo JSON is a local file under `public/packs/`. It follows the Procore room-pack v1 field set the dashboard will consume later.

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

### Highlight

The overlay is an **SVG** on the sheet, not a baked highlight image.

1. `layout.points` — polygon in **normalized 0–1** coordinates, origin **top-left** of the sheet.
2. Else `layout.bbox` `{x,y,w,h}` — same normalized space.
3. Else Procore `layout.bbox_pdf_pts` — PDF user-space points, origin **bottom-left**. Mapped with `page_width_pts` / `page_height_pts` (or the rendered page size) into a normalized top-left rect.

### Optional takeoff counts

Stub panel renders `takeoff.by_room`:

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

## Demo data

**Maple Point / fictional only.** Do not use Brown, Rossi, ILSB, EL107, Danoff, Suffolk, or any real client names or production sheet IDs.

Sample files:

- `public/packs/maple-point.json`
- `public/packs/maple-point-e101.pdf`
- `public/packs/maple-point-e102.pdf`

Add another pack by dropping `<requestId>.json` (and PDFs) into `public/packs/` and opening `/pack/<requestId>`.
