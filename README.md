# GC Field Log

A native SwiftUI iPhone + iPad field tool for electricians. The product promise is simple: **material gets ordered, workers get what they need, the job gets done.** If a screen does not save a trip, a recount, or a hunt for material or tools, it does not belong here.

This repo is a product pivot of `RFI-iphone`. The previous tree was an empty README. There is no Procore-submit path and no real-job documents.

## What it is

| Destination | Why it exists |
|---|---|
| **RFI** | Prep a Procore-ready packet (pin, sheet revision, question, photos) and send it to the foreman or GF. **They** file it in Procore. This app never submits RFIs or POs. |
| **Problem** | Field problems. Not RFIs. Not Procore tickets. |
| **Material** | Needed → grab it → ordered → **backordered (loud)** → on site. Grab list to apprentices. Order draft to the foreman. Snap a packing slip. |
| **Foreman** | Command board: new-rev alert, backorders, packets to file, tools out, morning assignment, bump. |
| **Count** | Spec + symbol legend in, Grok count out. Zone box or full sheet. Scale from the title block + 24×36 page. Homerun length; slack is a separate add. One tap adds lines to Material. |
| **Tools** | Who has it, what floor. Check out / in. Reserve tomorrow or next week. |
| **Time** | Who worked which days. OT in red. Punch. Foreman can fix. Paper sign-in sheet → confirm → week updates. |

Plus **Bump** (in-app, both devices must have the app — not the system AirDrop sheet):

1. **Morning assignment** — floor, current sheet, grab list, tools, bumped to each worker.
2. **End of day dump** — time, leftover material, tool returns, RFIs, problems onto the job iPad.
3. **Job handoff** — current prints, panel schedules, material, order/backorder, tools out, open RFIs.
4. **Inspection-ready** and **as-built redlines** to the GF.

Works offline: queue in a basement with no signal, bump when you are back in range.

## Demo job (fictional — required)

- **Job:** Maple Point Demo Job (`MP-DEMO-01`) at 410 Maple Point Drive — invented campus annex.
- **Sheet:** `E-201 Lighting L2 Rev 1` (Rev 0 is the superseded set for the new-rev alert).
- **Plan:** invented Office / Shop / Corridor, grid C-5. 2×4 troffers, downlights, duplex receptacles. Drawn in SwiftUI. No real PDFs in the repo.
- **Scale:** `1/8 in = 1 ft` on a **24×36** full-size plot.
- **People (demo only):**
  - Pat Nguyen — Foreman — PIN `1001`
  - Alex Rivera — Journeyman — PIN `2002`
  - Sam Ortiz — Apprentice — PIN `3003`
  - Jordan Lee — Apprentice — PIN `4004`

Real crew names come later via accounts. v1 is on-device SwiftData. No backend. No API keys.

## How to run

You need **Xcode 16+** on a Mac and the **iOS 18 SDK**.

```bash
git clone <this-repo>
cd RFI-iphone
open GCFieldLog.xcodeproj
```

Select the **GCFieldLog** scheme.

### iPhone

1. Destination: **iPhone 16** (or any iPhone simulator).
2. Run (⌘R).
3. You get a **tab bar** with the seven destinations. Journeymen and apprentices live here.

### iPad

1. Destination: **iPad (10th generation)** or **iPad Pro 13-inch** (or any iPad simulator).
2. Run (⌘R).
3. You get a **persistent sidebar** and a split view (drawing / list on the left, form on the right).
4. Sign in as **Pat Nguyen**. Use **Crew PIN** so Sam or Jordan can punch or check out a tool. The iPad flips back. Nobody shares the foreman password.

### Demo accounts

Tap the person chip in the header → **Demo accounts**. Switch among the four fake crew. This is the v1 account model.

### Bump (local demo path)

Tap **Bump** in the header (or Foreman → Bump a device). Pick a nearby demo peer (`Job iPad`, `Alex's iPhone`, …). Toggle **Basement / no signal** to queue. **Deliver queued** simulates walking back into range. The inbox is written on this device so one simulator is enough. A later Multipeer transport can replace `BumpService` without changing the payload.

### Count

Open **Count**. The invented lighting plan loads with the Office zone boxed. **Recount zone** calls `StubPrintTakeoffService` (Office: 12 / 8 / 18, homerun ~186 ft). **Add to material** writes those lines. Tap a fixture for **LP-2A** and the circuit. Long-press to drop an as-built. **Spec + legend** shows the duplex / switch / GFCI ingest story — no network.

## Architecture

```
GCFieldLog/
  App/           SwiftData container, session, root
  Navigation/    iPhone tab bar · iPad sidebar
  Models/        SwiftData models + Maple Point seed
  Services/      takeoff (stub), scale, Procore *read*, sign-in OCR (stub), bump
  Features/      one folder per destination + Bump + shared chrome
  Theme/         jobsite type, 48pt tap targets, dark mode
```

- **SwiftData** on device. Seeded once on first launch.
- **PrintTakeoffService** is a protocol. `StubPrintTakeoffService` runs the demo. `GrokVisionTakeoffService` is a typed hole for xAI/Grok vision later. Do not put keys in the repo.
- **ProcoreReadService** is read-only (current-set / new-rev alert). There is no submit client.
- Shared job iPad: `SessionController` keeps the signed-in foreman and an optional PIN session. PIN sessions can only use Time, Tools, and Material, then flip back.

## Legal

All demo jobs, sheets, specs, and drawings are fictional. Do **not** add Brown, ILSB, Rossi, EL107, EL107_N, Level 07 North, university buildings, or any real construction documents. If you find a real name or sheet in this tree, delete it.

## Requirements

- iOS 18 / iPadOS 18
- iPhone and iPad (device family 1,2)
- Camera permission: packing slips, paper sign-in, field photos
- Local network permission: reserved for a future real bump transport
