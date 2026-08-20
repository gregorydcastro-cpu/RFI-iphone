# Field RFI

First slice of Greg Castro’s construction RFI iPhone app: a working **New RFI** draft screen (SwiftUI) and the FastAPI backend that supports it.

This slice drafts only. It does not submit, number, age, or close RFIs.

## Product rules (this slice)

- One question per RFI.
- Write `draft` only (or `suggested_rfis` later). Never `submitted`, `ball_in_court`, `closed`, or `void`.
- Pin to a **sheet revision**, not a loose sheet number.
- An answer is not a CO and does not authorize work.
- **Draft** runs `search_rfis` first. If an open match exists on the same sheet, grid, or subject, stop and show that RFI.
- Required on a draft: subject, question, priority, cost_impact, schedule_impact, and at least one sheet_revision, pin, or ref.
- Priority: `standard` | `urgent` | `work_stopped`. The Grok/draft path may suggest `urgent`. It must not set `work_stopped`.
- Do not set `status`, `rfi_number`, `rfi_display`, `due_at`, `official_response`, `submitted_at`, or `closed_at` from the client draft envelope.
- Human numbers (`RFI-0047`) stay null until a human submits (out of scope).

## Demo data

Seeded on first API boot:

| | |
| --- | --- |
| Organization | Castro Construction | Brown University |
| Project | Harbor Yard Warehouse | **Brown Integrated Life Sciences Building (ILSB)** |
| Address / architect | — | 233 Richmond St, Providence RI 02903 · TenBerke · 4224 |
| Sheets | S301 Rev B/C, S302 Rev A | **EL107_N Rev 27** (Bulletin 46, 06/25/2026, `is_current`) |
| Seeded draft | none | Vivarium lighting control — which E-803 revision for EL107_N (`draft`, no number) |

## Backend (Linux / Mac)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Useful endpoints:

- `GET /projects`
- `GET /projects/{id}/sheet-revisions`
- `GET /sheet-revisions/{id}/drawing`
- `GET /search_rfis?project_id=&query=&sheet_number=&grid=&status_in=&limit=`
- `POST /create_rfi_draft` with a `preflight_rfi` envelope
- `GET /rfis/{id}`
- `GET /rfi_graph` (optional `project_id`) — weekly log / age buckets. Drafts, closed, and void are off the open list.

`create_rfi_draft` result: `{ok, rfi_id, status:"draft", rfi_display:null, missing_for_submit, message}`. Typical `missing_for_submit` includes `internal_review`.

## iOS app (Mac + Xcode)

This cloud VM cannot run the iOS simulator. On a Mac:

1. Start the backend on port 8000.
2. Open `ios/FieldRFI/FieldRFI.xcodeproj` in Xcode 15+ (iOS 17).
3. Run **Field RFI** on an iPhone simulator.
4. The simulator talks to `http://127.0.0.1:8000`. On a physical device, expand **Server** on the New RFI screen and set the Mac’s LAN URL.

## Test plan (New RFI screen)

1. Open the app. You should land on **New RFI**, not a placeholder.
2. Project list includes **Brown Integrated Life Sciences Building (ILSB)** (default) and Harbor Yard Warehouse.
3. Pick **EL107_N Rev 27** (Electrical Lighting Plan — Level 07 North). The full-sheet drawing should load. Harbor Yard **S301 Rev C** remains available.
4. Tap the sheet to drop a pin. Optionally set grid `B-4`.
5. Add a photo if you want. Enter one note, for example: `Beam at grid B-4 appears to conflict with the duct. Please confirm clearance.`
6. Tap **Draft RFI**. The client calls `search_rfis`, then `create_rfi_draft`.
7. Confirm the result: **status is `draft`**, **display number is null**, and `missing_for_submit` includes `internal_review`.
8. Tap Draft again with a similar note. The app should show the open match and refuse to duplicate.

## RFI Graph (weekly log)

The iOS **RFI Graph** tab is the meeting / pipeline view. Open RFIs are ordered `work_stopped → escalated → overdue → due_soon → gc_holding → missing_due → on_cycle`. Harbor Yard rows labeled **SAMPLE** are PE-seeded examples so the graph is not empty. The ILSB E-803 vivarium RFI stays a **draft with no number** and appears only under **Drafts (no number)**.

`days_open` is `floor(life_hours/24)` in **UTC** (not project-TZ business days; no holiday calendar).

Not in this slice: submit, holiday cache, Prometheus, `set_priority`, `age_rfis` as a job. Age buckets are computed on read.
