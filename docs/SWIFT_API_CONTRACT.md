# Swift API contract (anon / session only)

Base URL: `https://www.gcfieldlog.com`

Scope for native iPhone/iPad (#27): login, packs/sheets, markup→RFI, dictate/TTS, time.
Out of scope for v1: Procore OAuth/ops, Stripe, service-role secrets, inventing keys.

Auth model
- Real Supabase Auth via HTTP cookies set by `POST /api/session` (access + refresh through Supabase SSR helpers). Swift must use a cookie jar (`HTTPCookieStorage`) against `www.gcfieldlog.com`.
- `GET /api/session` returns the current user when cookies are valid.
- Roles: `viewer` | `full` | `puller` from profiles / app_metadata / invite — never chosen by the client.
- Legacy stub cookie `gcfieldlog_stub_user` is cleared on login; do not send it.
- Procore linked flag: cookie `gcfieldlog_procore_linked` or header `x-procore-linked` — **Swift v1 should treat Procore pull as optional / later**; prefer demo Maple Point packs and live reads that do not require puller.

Cookie / CORS notes for iOS
- Prefer `URLSession` with shared cookie storage; `SameSite=Lax` cookies work for first-party API calls to www.
- Always send `Cookie` on authenticated routes; include `Cache-Control: no-store` expectations (server already sets no-store on JSON).

---

## 1. Session / login

### `GET /api/session`
- Auth: cookies
- 200: `{ ok: true, userId, email, role, stub: false }`
- 401: `{ ok: false, error: "Sign in first.", stub: false }`
- 503: `{ ok: false, error: "auth_unconfigured", stub: false }`

### `POST /api/session`
- Body JSON:
  - `email` (required)
  - `password` (required unless `mode: "otp"`)
  - `mode`: `"signin"` (default) | `"signup"` | `"otp"`
- Success sign-in/signup with session: public session JSON + Set-Cookie
- OTP / email-confirm: `{ ok: true, mode, email, needsEmailConfirm: true, stub: false }`
- Errors: 400 / 401 / 503 with `{ ok: false, error, stub: false }`

### `GET /api/session/logout`
- Clears session cookies; follow redirects if any. Prefer calling this for Sign out.

---

## 2. Packs / sheets

### `GET|POST /api/room-pack/live`
- Auth: none required for read (viewers OK). Always no-store.
- Query or JSON: `requestId` (required), optional `job` / `projectSlug`, `room`
- 200: `{ ok: true, mode: "live"|"demo", source, pull, demoFallback, requestId, job, room, pulled_at, revision_stamp, pack }`
- 404: pack not available

### `POST /api/room-pack` (pull / refresh)
- Auth: **puller + Procore linked** (`procoreLinked` cookie/header). Returns 403 otherwise.
- Body: `projectSlug` or `projectName`, plus `room`
- Swift v1: skip unless user is puller; use `/live` + demo Maple Point instead.

### `GET /api/sheet-pdf?requestId=&sheetId=`
- Auth: none for PDF stream (pack id + sheet id)
- 200: `application/pdf` bytes
- Errors JSON: `{ ok: false, error, code, configured? }` (`bad_request`, Drive codes after #59 merges)

Demo packs may also load from `/packs/<requestId>.json` / static PDFs under `/packs/` on the site.

---

## 3. Markup → RFI

### `GET /api/markups?request_id=&sheet_id=`
- Auth: session required
- 200: `{ ok: true, persisted, storage: "supabase"|"unconfigured", row }`

### `PUT /api/markups`
- Auth: session + writable role (`full` / `puller`; not view-only)
- Body: `request_id`, `sheet_id`, optional `id`, `vectors`
- 200: `{ ok: true, persisted, storage, row }`

### `POST /api/rfis`
- Auth: session + writable role
- Body: `subject`, `description` (required); optional `location`, `sheet_id`, `markup_id` (UUID), `status` (draft)
- 200: `{ ok: true, persisted, storage, procore: false, sentTo: { name, role, email }, row }`
- Never submits to Procore — drafts to foreman packet only.

---

## 4. Dictate / voice

### `GET /api/voice/status`
- Auth: none
- 200: `{ ok: true, configured: boolean, provider: "xai", stt: "/api/dictation", tts: "/api/tts" }`
- Never returns API keys.

### `POST /api/dictation`
- Auth: none at route (holds server `XAI_API_KEY`)
- `multipart/form-data`: field `file` (audio blob); optional repeated `keyterm`
- Max ~8 MB
- 200: `{ ok: true, text, language }`
- Errors: `{ ok: false, error, code }` (`unconfigured` 503, `bad_input`, `too_large`, `no_speech`, …)

### `POST /api/tts`
- Auth: none at route
- JSON: `{ text, voice_id?, language? }` → MP3 body on success
- Errors same voice code pattern; 503 if unconfigured

On device, Swift can also use Speech framework for STT and skip `/api/dictation` when offline; still call site TTS only when `configured: true`.

---

## 5. Time

### `GET /api/time?week=&job=`
- Auth: none at route (snapshot for demo job)
- Defaults: current week Monday, default time job slug
- 200: `{ ok: true, ...snapshot }`
- 404: unknown job

### `POST /api/time/punches`
- Auth: session required
- Worker body: `workerId`, `punchType` (`in`|`out`), `pin?`, `lat`, `lng`, `accuracy_m` (GPS required for in; geofence server-side)
- Foreman override: `foreman: true`, `workerId`, `punchedAt`, optional `pairOutAt`, `note`, `punchId`, `punchType`
- 401 if signed out

---

## Swift v1 recommended call order

1. `GET /api/voice/status` (optional)
2. `POST /api/session` → store cookies
3. `GET /api/session` to confirm `{ userId, email, role }`
4. `GET /api/room-pack/live?requestId=…` (Maple Point demo id from jobs UI / known demo)
5. `GET /api/sheet-pdf?requestId=&sheetId=` for sheet bytes
6. Markup `PUT` → RFI `POST` with `markup_id`
7. Dictate `POST /api/dictation` when configured
8. Time `GET /api/time` + `POST /api/time/punches`

## Explicit non-goals (do not call from Swift v1)

- `/api/procore/*` OAuth and REST pull ops
- `/api/stripe/*`
- Any `SUPABASE_SERVICE_ROLE_KEY` or inventing publishable keys in the app binary beyond what the web already exposes via session cookies

Last verified against main routes on 2026-09-22 (post #60).
