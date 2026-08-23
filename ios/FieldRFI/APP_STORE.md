# GC Field Log — App Store v1

Listing name: **GC Field Log**. Field Log was taken. Bundle id stays `com.castro.fieldrfi`.

Field tool. Journeyman or foreman captures a pin or photo, drafts an RFI or a field problem, or a material ask, and sends it to the foreman. The foreman orders or enters it in Procore later. This app does not call the Procore API. Grokbot stays draft-only. The field UI does not set `work_stopped`.

Apple contact: glineracing@gmail.com · (508) 505-1836

App Store listing URLs (not an API host):

| | |
|---|---|
| Support URL | https://gcfieldlog.com/ when that page exists |
| Marketing URL | https://gcfieldlog.com/ when that page exists |

Do not list this product on https://glineracing.store/. Do not set `FIELD_API_BASE_URL` to glineracing.store or gcfieldlog.com. Those are listing / domain notes only.

## What this Linux cut cannot do

Linux cannot archive or upload to App Store Connect. Remaining blockers after this UI cut:

1. **Signing team** — Xcode Automatic signing on a Mac with the Apple team that owns `glineracing@gmail.com`. Bundle id is `com.castro.fieldrfi`. Confirm the team can create an App Store distribution profile.
2. **Screenshots** — iPhone 6.7" and 6.1" (plus iPad if the family stays 1,2): New RFI with a pin on a catalog sheet, Field problem, Material draft list, Foreman inbox. Do not invent drawing numbers in the shots; use the catalog (ILSB EL107_N Rev 27).
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
- Material is a draft list, not a PO submit.
- Grokbot drafts only on the backend.
- Do not invent drawing numbers.
- Do not invent a production API host. Empty Release URL is legal.
