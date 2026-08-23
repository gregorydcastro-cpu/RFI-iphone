# Field RFI — App Store v1

Field tool. Journeyman or foreman captures a pin or photo, drafts an RFI or a field problem, or a material ask, and sends it to the foreman. The foreman orders or enters it in Procore later. This app does not call the Procore API. Grokbot stays draft-only. The field UI does not set `work_stopped`.

Apple contact: glineracing@gmail.com · (508) 505-1836

## What this Linux cut cannot do

Linux cannot archive or upload to App Store Connect. Remaining blockers after this UI cut:

1. **Signing team** — Xcode Automatic signing on a Mac with the Apple team that owns `glineracing@gmail.com`. Bundle id is `com.castro.fieldrfi`. Confirm the team can create an App Store distribution profile.
2. **Screenshots** — iPhone 6.7" and 6.1" (plus iPad if the family stays 1,2): New RFI with a pin on a catalog sheet, Field problem, Material draft list, Foreman inbox. Do not invent drawing numbers in the shots; use the catalog (ILSB EL107_N Rev 27).
3. **Privacy nutrition** — `PrivacyInfo.xcprivacy` is in the target. App Store Connect still needs the questionnaire: no tracking, camera and photos for field attachments only, no third-party analytics. Confirm Camera + Photos usage strings match the live screens.
4. **HTTPS** — Debug talks to `http://127.0.0.1:8000`. Store build needs a real HTTPS host (or documented on-LAN only). ATS no longer allows arbitrary HTTP.
5. **Archive + review** — Run on a device, archive in Xcode, upload. Review notes: no IAP, no Procore, send-to-foreman is an in-app handoff, not a purchase.

## v1 law (do not regress)

- No Procore API.
- No IAP.
- No work-stopped control in the field UI.
- Material is a draft list, not a PO submit.
- Grokbot drafts only on the backend.
- Do not invent drawing numbers.
