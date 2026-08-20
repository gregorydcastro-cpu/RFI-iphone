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
| Organization | Castro Construction |
| Project | Harbor Yard Warehouse |
| Sheets | S301 Foundation Plan (Rev B, **Rev C**), S302 Framing Plan (Rev A) |

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

`create_rfi_draft` result: `{ok, rfi_id, status:"draft", rfi_display:null, missing_for_submit, message}`. Typical `missing_for_submit` includes `internal_review`.

## iOS app (Mac + Xcode)

This cloud VM cannot run the iOS simulator. On a Mac:

1. Start the backend on port 8000.
2. Open `ios/FieldRFI/FieldRFI.xcodeproj` in Xcode 15+ (iOS 17).
3. Run **Field RFI** on an iPhone simulator.
4. The simulator talks to `http://127.0.0.1:8000`. On a physical device, expand **Server** on the New RFI screen and set the Mac’s LAN URL.

## Test plan (New RFI screen)

1. Open the app. You should land on **New RFI**, not a placeholder.
2. Project should resolve to **Harbor Yard Warehouse** (or pick it).
3. Pick **S301 Rev C** (Structural / Foundation Plan). The drawing should load.
4. Tap the sheet to drop a pin. Optionally set grid `B-4`.
5. Add a photo if you want. Enter one note, for example: `Beam at grid B-4 appears to conflict with the duct. Please confirm clearance.`
6. Tap **Draft RFI**. The client calls `search_rfis`, then `create_rfi_draft`.
7. Confirm the result: **status is `draft`**, **display number is null**, and `missing_for_submit` includes `internal_review`.
8. Tap Draft again with a similar note. The app should show the open match and refuse to duplicate.

Not in this slice: submit, holiday cache, Prometheus, aging, `set_priority`.
