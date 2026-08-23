# Field RFI — App Store v1

Field tool. Journeyman or foreman captures a pin or photo, drafts an RFI or a field problem, or a material ask, and sends it to the foreman. The foreman orders or enters it in Procore later. This app does not call the Procore API. Grokbot stays draft-only. The field UI does not set `work_stopped`.

Apple contact: glineracing@gmail.com · (508) 505-1836

## What this Linux cut cannot do

Linux cannot archive or upload to App Store Connect. Remaining blockers after this UI cut:

1. **Signing team** — Xcode Automatic signing on a Mac with the Apple team that owns `glineracing@gmail.com`. Bundle id is `com.castro.fieldrfi`. Confirm the team can create an App Store distribution profile.
2. **Screenshots** — iPhone 6.7" and 6.1" (plus iPad if the family stays 1,2): New RFI with a pin on a catalog sheet, Field problem, Material draft list, Foreman inbox. Do not invent drawing numbers in the shots; use the catalog (ILSB EL107_N Rev 27).
3. **Privacy nutrition** — `PrivacyInfo.xcprivacy` is in the target. App Store Connect still needs the questionnaire: no tracking, camera and photos for field attachments only, no third-party analytics. Confirm Camera + Photos usage strings match the live screens.
4. **HTTPS / `FIELD_API_BASE_URL`** — Set this at archive time. Do not invent a production host here.
5. **Archive + review** — Run on a device, archive in Xcode, upload. Review notes: no IAP, no Procore, send-to-foreman is an in-app handoff, not a purchase.

## FIELD_API_BASE_URL (set at archive)

| | |
|---|---|
| Build setting | `FIELD_API_BASE_URL` |
| Info.plist key | `FIELD_API_BASE_URL` (`$(FIELD_API_BASE_URL)`) |
| Debug | `http://127.0.0.1:8000` (localhost HTTP is allowed) |
| Release | empty until archive. Must be `https://…` |

Xcode → FieldRFI target → Build Settings → `FIELD_API_BASE_URL` for **Release**. Paste the real `https://` host. Leave Debug on localhost.

Release **fails closed** if the key is missing, empty, still `http`, localhost, or `127.0.0.1`. The client will not fall back to `http://127.0.0.1:8000`. ATS does not allow arbitrary HTTP.

This repo does not name a production host. B sets the key when Greg can archive.

## v1 law (do not regress)

- No Procore API.
- No IAP.
- No work-stopped control in the field UI.
- Material is a draft list, not a PO submit.
- Grokbot drafts only on the backend.
- Do not invent drawing numbers.
- Do not invent a production API host. Set `FIELD_API_BASE_URL` at archive.
