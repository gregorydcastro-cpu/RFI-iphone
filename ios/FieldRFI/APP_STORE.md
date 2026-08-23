# GC Field Log — App Store v1

Listing name: **GC Field Log**. Field Log was taken. Bundle id stays `com.castro.fieldrfi`.

Field tool. Journeyman or foreman captures a pin or photo, drafts an RFI or a field problem, builds a material list, or sends print PDFs and job pictures, and sends it to the foreman inbox. Material is first-class: hold lines, send, apprentice pickup, track, back-order. Prints land in the same inbox; the foreman marks them up on this phone. Not a PO. Not submitted. Not Procore. Grokbot stays draft-only. The field UI does not set `work_stopped`. Mock job name for new copy is **G-Line Shop Test** only.

Apple contact: glineracing@gmail.com · (508) 505-1836

App Store listing URLs (not an API host):

| | |
|---|---|
| Support URL | https://gcfieldlog.com |
| Marketing URL | https://gcfieldlog.com |

Site draft in progress. Do not use https://glineracing.store/ for this product. Do not set `FIELD_API_BASE_URL` to gcfieldlog.com or glineracing.store. Listing URLs only. Display name stays **GC Field Log**. Bundle stays `com.castro.fieldrfi`.

## What this Linux cut cannot do

Linux cannot archive or upload to App Store Connect. Remaining blockers after this UI cut:

1. **Signing team** — Xcode Automatic signing on a Mac with the Apple team that owns `glineracing@gmail.com`. Bundle id is `com.castro.fieldrfi`. Confirm the team can create an App Store distribution profile.
2. **Screenshots** — iPhone 6.7" and 6.1" (plus iPad if the family stays 1,2): New RFI with a pin on a catalog sheet, Field problem, Material held list (G-Line Shop Test), Foreman inbox. Do not invent drawing numbers in the shots; use the bundled sample **E-101 Rev A**. Job name stays **G-Line Shop Test**. Do not use EL107_N, Brown, or ILSB.
3. **Privacy nutrition** — `PrivacyInfo.xcprivacy` is in the target. App Store Connect still needs the questionnaire: no tracking, camera and photos for field attachments only, no third-party analytics. Confirm Camera + Photos usage strings match the live screens.
4. **Archive + review** — Run on a device, archive in Xcode, upload. Review notes: no IAP, no Procore, send-to-foreman is an in-app handoff, not a purchase. Empty `FIELD_API_BASE_URL` is legal for this cut.

## FIELD_API_BASE_URL

v1 is on-device. Greg has no website and does not need an API host. Send-to-foreman is local. Do not invent a production host.

| | |
|---|---|
| Build setting | `FIELD_API_BASE_URL` |
| Info.plist key | `FIELD_API_BASE_URL` (`$(FIELD_API_BASE_URL)`) |
| Debug | `http://127.0.0.1:8000` when a caller actually hits a local server |
| Release | **empty is legal** |

Empty `FIELD_API_BASE_URL` is legal. The app launches. Local outbox, foreman inbox, and drafts work with no host.

Fail closed **only** when a caller actually needs a server and the URL is missing, `http`, or localhost in Release. Catalog / drawing / PE / graph calls throw. They do not fall back to `http://127.0.0.1:8000`. ATS does not allow arbitrary HTTP.

Do not invent a production host. Leave Release empty until there is a real `https://` server. Do not use https://glineracing.store/ or https://gcfieldlog.com/ as `FIELD_API_BASE_URL`.

## v1 law (do not regress)

- No Procore API.
- No IAP.
- No work-stopped control in the field UI.
- Material is a first-class held list (description, qty, UOM EA|LF|SF|BOX|SET), sent to the foreman. Not a one-off ask. Not a PO. Not submitted. Not Procore. Apprentices pick up; they do not order or submit. Status: held, sent, picked, back-ordered.
- Prints and job pictures use the same send-to-foreman inbox. Foreman markup is local. Not a ticket that skips the inbox. Do not invent drawing numbers.
- Grok takeoff counts visible devices on bundled sample sheet **E-101 Rev A** and writes the G-Line Shop Test held material list. Job photos are not a sheet. If the sample image is missing, it writes no quantities. On-device only. Grokbot still cannot submit, number, close, or set work_stopped.
- Tasks: assign to an existing mock crew name on G-Line Shop Test (short crew list, including Harbor Apprentice), assignee checks off on this phone, assigner sees verification. Optional job proof photo on check-off stays on this phone. Due date is optional and does not block assign or check-off. Journeyman/apprentice pairing routes material pickup and similar assigns. Persist on this phone.
- Access: the person above assigns what their direct reports can see and do. Default is one step: GF → Area Foreman → Foreman → Journeyman → Apprentice. A GF can grant a named apprentice a direct line (assistant / material check). That apprentice cannot open the skip. Persist on this phone. On-device UI only. Not a backend ABAC.
- Company iPhone is the default. Personal phone is allowed. Both work. Shared shop handset: pick who you are. Photos stay on this phone in the app. A personal Apple ID is not required and is not blocked. No MDM or device-management portal.
- Tools: short shop list on G-Line Shop Test (name, optional vendor/brand). Check out to an existing mock crew name, search, see who has it, check in. Find opens that one person's crew card and one-step-up contact. Lost-tool blast to all Foremen only if the tool is lost or not checked out — not when a holder is known. On this phone. No barcode hardware. No Procore.
- Optional all-hands group text to all Foremen on G-Line Shop Test is a separate Foreman-tab control for real all-hands. Not tool find. Not a lost-tool blast. Apprentices cannot skip to all Foremen unless the GF granted a direct line.
- Meetings: date/time, who, short note on G-Line Shop Test. Upcoming list and an in-app reminder on any tab in the hour before. Dated tasks show on that calendar day; assignees get an in-app due-today banner. No Apple Calendar sync. No local-notification permission required.
- Grokbot drafts only on the backend.
- Do not invent drawing numbers.
- Do not invent a production API host. Empty Release URL is legal.
