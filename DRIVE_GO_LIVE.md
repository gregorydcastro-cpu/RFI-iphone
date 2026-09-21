# Drive go-live checklist (Greg)

Operator steps so **GC Field Log** can stream live pack sheet PDFs on [gcfieldlog.com](https://gcfieldlog.com). Maple Point local `/packs` PDFs stay **direct** and do **not** need these keys. Do not put secret values in git.

## Why

Live `room_packs` rows store Google Drive **view** URLs (often on `sheets[].crop` / `preview`, with `pdf` empty). pdf.js cannot fetch those hosts (CORS / login wall).

`GET /api/sheet-pdf?requestId=&sheetId=` looks up the pack the same way the viewer does, downloads Drive bytes on the server, and streams `application/pdf`. Drive tokens never go to the client.

Without Drive credentials, that route returns `{ ok: false, code: "drive_auth_missing" }` with **503**. Maple Point demo paths (`/packs/*.pdf`) still load from `public/packs` with no Google keys.

## 1. Preferred env → `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`

1. Google Cloud → create a service account. No extra project roles are required beyond Drive file access via sharing.
2. Download the JSON key (includes `client_email` and `private_key`).
3. Paste the **full JSON** into Vercel **`GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`** (Production; Preview if you test live packs there).

Server-only. **Never** `NEXT_PUBLIC_`. Never commit. Never log the JSON or private key.

## 2. Alternates

| Key | When | Notes |
| --- | --- | --- |
| `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` | Instead of the JSON blob | Service account email (`…@….iam.gserviceaccount.com`) and PEM (`-----BEGIN PRIVATE KEY-----`). `\n` escapes in Vercel are fine. **Never** `NEXT_PUBLIC_`. |
| `GOOGLE_DRIVE_API_KEY` | Optional public-file fallback only | Works only for Drive files shared “Anyone with the link”. Live bot packs are typically **private** — prefer the service account. |
| `GOOGLE_DRIVE_FOLDER_ID` | Optional ops reminder | Not required for download. The file id is already on `crop` / `preview`. |

Use the JSON **or** email+key. Do not put secret values in git.

## 3. Share the Room Packs folder (Viewer)

1. In Drive, open the Room Packs folder the Procore bot writes pack PDFs into (same folder as the live `A207_N` sheet file).
2. Share that folder with the service account `client_email` as **Viewer**.
3. Optional: set `GOOGLE_DRIVE_FOLDER_ID` on Vercel as an ops note.

The website download uses the file id already stored on the pack. Sharing the **folder** (not each file) covers new sheets the bot adds later.

Without keys, the pack viewer shows a **Drive account missing** banner (large type, Retry) instead of a browser **Failed to fetch**. JSON is **503** `{ code: "drive_auth_missing" }`.

| Code | HTTP | Meaning |
| --- | --- | --- |
| `drive_auth_missing` | 503 | `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` (or email + key) is unset |
| `drive_auth_rejected` | 503 | Drive rejected that service account |
| `drive_forbidden` | 502 | File exists for Drive but is not shared with the service account |
| `not_found` | 404 | Drive has no file for that id (Drive also hides unshared files this way) |
| `timeout` | 504 | Fetch timed out after one retry |
| `upstream_failed` | 502 | Drive or the token endpoint returned a transient 5xx / could not be reached, after one retry |

403 share failures and 404s are not retried. Timeouts, 429, and 5xx are retried once. Error JSON uses these codes and fixed sentences. It does not include the service-account JSON, private key, access token, or upstream body.

**Separate from [issue #53](https://github.com/gregorydcastro-cpu/RFI-iphone/issues/53).** `storageKeyValid: false` on `/api/procore/status` is `SUPABASE_SERVICE_ROLE_KEY` (the Supabase **service_role** secret for Procore token storage). Sheet PDFs do not read that key. Set the Drive service account and the Room Packs folder share here; fix #53 on its own.

## 4. Vercel env (Production / Preview as needed)

| Key | Required for |
| --- | --- |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` | Preferred. Full service account JSON → Drive `files.get?alt=media` |
| `GOOGLE_CLIENT_EMAIL` | Alternate to JSON |
| `GOOGLE_PRIVATE_KEY` | Alternate to JSON |
| `GOOGLE_DRIVE_API_KEY` | Public Drive files only (not typical live packs) |
| `SUPABASE_URL` | Same project as `room_packs` (live pack lookup) |
| `SUPABASE_ANON_KEY` | Live `room_packs` read (`cache: "no-store"`) |

Never commit these values. Maple Point local demos need **none** of them.

## 5. Live check

After the JSON (or email+key) is set **and** the bot folder is shared:

```bash
curl -sS -D - -o /tmp/a207.pdf \
  "https://www.gcfieldlog.com/api/sheet-pdf?requestId=sample-arch-bounds-733&sheetId=A207_N"
# expect: HTTP 200  Content-Type: application/pdf
```

**Currently (keys unset):** **503** `{ "ok": false, "code": "drive_auth_missing", ... }`.

Maple Point local PDFs stay direct (no Drive keys):

```bash
curl -sS -o /tmp/a101.pdf -w "%{http_code} %{content_type}\n" \
  "http://localhost:3000/api/sheet-pdf?requestId=maple-point&sheetId=A-101"
# 200 application/pdf
```

Broader production smoke (pricing, Stripe checkout, sheet-pdf, Time): `bash scripts/smoke-go-live.sh`.

## 6. Confirm unconfigured behavior

With Drive keys unset (Maple Point demo / a host that has not gone live):

- Local `/packs/*.pdf` still streams **200** `application/pdf`.
- Live Drive sheets return **`drive_auth_missing`** with **HTTP 503**.
- The pack viewer shows **Drive account missing**, **Sheet not shared**, or **Can't reach the sheet** / **Sheet timed out**, each with a Retry button when a refetch can help.
- Pack viewer, Time, Voice, Stripe, and Procore OAuth are unchanged. Issue #53 (`SUPABASE_SERVICE_ROLE_KEY`) is a different secret.
