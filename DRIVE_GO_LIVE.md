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

## 3. Share the Procore bot Drive pack folder (Viewer)

1. In Drive, open the folder the Procore bot writes pack PDFs into (same folder as the live `A207_N` sheet file).
2. Share that folder with the service account `client_email` as **Viewer**.
3. Optional: set `GOOGLE_DRIVE_FOLDER_ID` on Vercel as an ops note.

The website download uses the file id already stored on the pack. Sharing the **folder** (not each file) covers new sheets the bot adds later.

Without keys, the viewer shows the 503 `drive_auth_missing` message instead of a browser **Failed to fetch**. With keys but a file not shared, expect **502** `{ code: "drive_forbidden" }`.

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
- Pack viewer, Time, Voice, Stripe, and Procore OAuth are unchanged.
