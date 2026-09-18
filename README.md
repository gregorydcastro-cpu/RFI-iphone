# GC Field Log — crew dashboard (web)

Browser **dashboard for field crews** on **[gcfieldlog.com](https://gcfieldlog.com)**. Foremen and supers sign in (stub), pick a job, request a room pack, then work the sheet: zoomable floor plans, room highlight, linked RFIs, Generate RFI / Order materials, and a **Time** tab (geofenced punch-in + crew week).

This is the product surface. **Native iOS is paused. No Apple.** Real login is later — the login page is a **stub session** (httpOnly cookie with user id + email + role). **Stripe Checkout** (60-day trial → monthly) is scaffolded at `/pricing`. Wordmark is clean text: **GC Field Log** (no extra logo).

Host: **Vercel (primary)** with **HostGator DNS** for `gcfieldlog.com` (document only; this PR does not change DNS). Cloudflare Pages is a possible later target.

No real crew auth, HostGator uploads, or live Procore REST API in this MVP. Stripe Checkout + webhook are scaffolded (secrets stay in Vercel; Maple Point demos do not need them). The **Room pack webhook routine is deleted** — this app does **not** call `procore_room_pack_webhook_url` / webhook Authorization.

**Pullers** can **Connect Procore** with their own Procore login (OAuth authorization code). Tokens are stored per stub user in Supabase `procore_connections`. Viewers do not need to connect and cannot trigger a pull.

**Live path:** the Procore bot (`969a9d8e-c07f-44c3-ae9d-862704cd60c7`) owns the Procore pull and upserts `public.room_packs` on Supabase project `aejevzkqvlwbmjbqdxuu`. The website reads that table with `SUPABASE_URL` + `SUPABASE_ANON_KEY` (`cache: "no-store"`) on every pack open. Pullers who have connected Procore can request a refresh; viewers only read. Local demo leaves Supabase unset: Maple Point JSON, no pull.

## Locked nav (MVP)

Must match this path — nothing else in the primary nav:

**Login (stub) → Jobs → Room pack request → Pack viewer (plan + sheets + RFIs) → Generate RFI / Order materials (drafts to foreman). Time is wired (`/time`).**

**Tools** stays later (not wired). No Apple.

## What the dashboard shows (MVP)

| Area | Behavior |
| --- | --- |
| Login (`/`) | Email/password form UI. Submit creates a stub session cookie (`gcfieldlog_stub_user`) with `userId` + email + role (`viewer` default, or `puller`). Password is not checked. |
| Jobs (`/jobs`) | Fictional jobs only (Maple Point and similar). Header shows **Puller** / **Procore connected** / **View only**. Pullers get **Connect Procore**. |
| Account (`/account`) | Stub session + Procore connected / disconnected state + link to pricing. |
| Pricing (`/pricing`) | Subscribe CTA → Stripe-hosted Checkout (60-day trial, payment method collected). |
| Room pack request | Room number (e.g. `733`). **Connected puller:** `POST /api/room-pack` asks the Procore bot to refresh, then opens `/pack/[requestId]`. **Viewer / unconnected puller:** **Open pack** only — no pull. Local demo (no `SUPABASE_URL`) loads Maple Point JSON. |
| Pack viewer | Field stack on `/pack/[requestId]`: **architectural floor plan first** (A-*, architectural, floor plan heuristics; else current primary), oversized crimson SVG box around the room walls, **vector markup tools** (circle, box, arrow, text note) with one-tap **Create RFI**, then remaining sheets (power, lighting, …) and linked RFIs. Drawing number + revision letter stamps stay on the top bar and each sheet (`A-101 Rev A`). Website open always re-reads `room_packs` (no-store). Connected pullers also trigger a bot refresh; viewers cannot. |
| Generate RFI / Materials | Live pack actions. Drafts go to foreman Pat Nguyen — not a Procore submit. **Dictate** fills the form from the mic; **Read aloud** speaks RFIs. **Create RFI** from a selected sheet markup prefills the same draft. Phone photo attaches as a data URL on the draft. |
| Voice (Grok) | Server-side `XAI_API_KEY` → `/api/dictation` (STT) and `/api/tts` (TTS). Never `NEXT_PUBLIC_`. |
| Time (`/time`) | Maple Point **worker punch** (GPS geofence) and **foreman crew week**. Field log only — not payroll/ADP. |
| Takeoff counts | Optional placeholder panel |

## Local run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in (stub) → **Time** in the header, or pick **Maple Point Medical Office** → request room `733`.

Grok Voice (mic / read aloud) needs **`XAI_API_KEY`** on the server. Without it, the buttons still render and `/api/voice/status` reports `configured: false`.

```bash
npm run lint
npm run test
npm run build
npm start
```

`npm install` copies the pdf.js worker into `public/pdf.worker.min.mjs`.

## Deploy (Vercel + HostGator DNS)

Production host is **gcfieldlog.com**.

1. Import this GitHub repo in [Vercel](https://vercel.com/new) (framework preset: **Next.js**).
2. Build command: `npm run build`. `postinstall` copies `pdf.worker.min.mjs`.
3. **Env:** the Maple Point demo needs **no** secrets. Production reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` for live `room_packs`. Live sheet PDFs (Google Drive links in `sheets[].pdf`) need **`GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`** (or **`GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`**) so `/api/sheet-pdf` can stream files the browser cannot fetch. Procore **user** OAuth (Connect Procore) uses **`PROCORE_CLIENT_ID` / `PROCORE_CLIENT_SECRET`** and **`SUPABASE_SERVICE_ROLE_KEY`** on Vercel (server-only, never `NEXT_PUBLIC_`). **Grok Voice** (RFI/materials dictation + RFI read-aloud) uses **`XAI_API_KEY`** (server-only, never `NEXT_PUBLIC_`). Copy OAuth id/secret from `/home/box/.secrets/procore_client_id` and `procore_client_secret` — do not commit. Do **not** restore `procore_room_pack_webhook_url` / `procore_room_pack_webhook_authorization` for this live path — that routine is deleted. Stripe Checkout (optional until you sell) uses the keys in **Stripe Checkout (Vercel + Dashboard)** below.
4. **DNS (ops, not this repo):** at HostGator, point `gcfieldlog.com` / `www` to Vercel (A / CNAME per Vercel’s domain docs). Do not upload files to HostGator for this app.

### Procore OAuth (Connect Procore)

Pullers click **Connect Procore** → Procore authorize → they sign in with **their own** Procore credentials and approve → callback exchanges the code for tokens → tokens are stored **per user** in Supabase (service role writes). End users do **not** create a Developer Portal app. After a successful callback the server also sets `gcfieldlog_procore_linked=1` so pack pull routes treat the session as a puller.

**Redirect URI** allowlisted on Greg’s Procore developer app (exact):

`https://www.gcfieldlog.com/api/procore/callback`

That is the default `redirect_uri`. Preview hosts will not match unless `PROCORE_REDIRECT_URI` is set **and** that URI is added in the developer app.

**Vercel (server-only, never `NEXT_PUBLIC_`):**

| Key | Role |
| --- | --- |
| `PROCORE_CLIENT_ID` | OAuth client id (`procore_client_id` alias also read) |
| `PROCORE_CLIENT_SECRET` | OAuth client secret (`procore_client_secret` alias also read) |
| `PROCORE_REDIRECT_URI` | Optional. Default: `https://www.gcfieldlog.com/api/procore/callback` |
| `PROCORE_OAUTH_BASE` | Optional login host. Default **`https://login-sandbox.procore.com`** (Developer Sandbox). Production / on-demand: `https://login.procore.com`. |
| `PROCORE_API_BASE` | Optional API host. Default follows the login host. |
| `SUPABASE_URL` | Supabase project URL (same project as `room_packs`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required to write tokens.** Anon key must not read or write `procore_connections`. |
| `SUPABASE_ANON_KEY` | Live `room_packs` reads (not token storage) |
| `XAI_API_KEY` | **Grok Voice.** Server-only. Batch STT (`POST https://api.x.ai/v1/stt`) and TTS (`POST https://api.x.ai/v1/tts`). Never `NEXT_PUBLIC_`. Alias `xai_api_key` also read. |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` | **Live sheet PDFs.** Preferred. Full Google service account JSON. Server-only. Share the Procore bot Drive folder with `client_email`. |
| `GOOGLE_CLIENT_EMAIL` | Alternate to JSON. Service account email (`…@….iam.gserviceaccount.com`). |
| `GOOGLE_PRIVATE_KEY` | Alternate to JSON. PEM private key (`-----BEGIN PRIVATE KEY-----`; `\n` escapes are fine). |
| `GOOGLE_DRIVE_API_KEY` | Optional. Only works for Drive files shared “Anyone with the link”. Live bot packs are typically private. |
| `GOOGLE_DRIVE_FOLDER_ID` | Optional ops note (not required for download). Folder the Procore bot writes pack PDFs into — share that folder with the service account as **Viewer**. |

This app does **not** use the Vercel AI SDK / AI Gateway for voice. The key is forwarded only from Next.js API routes. Do not put the key in the client bundle.

#### Grok Voice (dictation + read-aloud)

Hands-free field controls on the existing Generate RFI / Order materials / pack viewer flows. Drafts still go to foreman Pat Nguyen. Never a Procore submit.

| Control | Where | Behavior |
| --- | --- | --- |
| **Dictate RFI** | `/pack/[requestId]/rfi/new` | Mic → Grok STT → fills subject, question, and location if spoken. Say “send draft” to create the localStorage draft (optional `/api/rfis`). |
| **Read aloud / Speak** | Pack viewer RFI list; new-RFI form; draft confirmation | Grok TTS reads number + title + status. On the new-RFI page it also reads the draft body. |
| **Dictate items** | `/pack/[requestId]/materials` | Mic adds/adjusts line items or the order note for the foreman draft. |
| **Voice command** (stub) | `/jobs` and the room-pack request form | “open Maple Point pack” / “pull room 101” uses the existing open/pull path. Viewers open; connected pullers refresh. Does not rebuild Procore. |

**How to try (Maple Point demo):**

1. Stub login at `/` (any email; password ignored).
2. Jobs → **Maple Point Medical Office** → Open pack (room `101` or `733`).
3. **Generate RFI** → **Dictate RFI** (tap mic, speak, tap stop). Example: *“Subject panel feed. Question is the feeder three phase in closet 101?”* Fields fill. Still **Send draft to Pat Nguyen** — not Procore.
4. On the confirmation card, **Read draft**. On the pack viewer RFI list, **Speak** / **Read all**.
5. **Order materials** → **Dictate items**. Example: *“add 4 junction boxes”* or *“note need by Friday”*.
6. Optional: on Jobs, **Voice command** → *“open Maple Point pack”* or *“pull room 101”*.

**Smoke without a live key** (expected):

```bash
curl -s http://localhost:3000/api/voice/status
# {"ok":true,"configured":false,"provider":"xai","stt":"/api/dictation","tts":"/api/tts"}

curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"RFI-001. Panel feed clarification. Status open."}'
# 503

curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/dictation
# 503
```

**When `XAI_API_KEY` is set** (server / Vercel env):

```bash
curl -s http://localhost:3000/api/voice/status
# configured: true

# Optional direct xAI checks (key stays in your shell, not the browser):
curl -X POST https://api.x.ai/v1/stt \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -F language=en -F format=true -F file=@short.wav

curl -X POST https://api.x.ai/v1/tts \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"RFI-001. Panel feed clarification. Status open.","voice_id":"eve","language":"en"}' \
  --output /tmp/rfi.mp3
```

Mic capture happens in the **browser** (this IDE has no mic). Use earbuds on site; large tap targets are for gloves.

### Markup → Create RFI (vector overlay)

Hands-in-gloves markup on the pack viewer. Vectors stay as SVG/JSON — **not** a flattened raster bake. Drafts still go to foreman Pat Nguyen. Never a Procore submit.

1. Stub login at `/` (any email; password ignored).
2. Jobs → **Maple Point Medical Office** → Open pack (room `101` or `733`).
3. On the floor plan (or any sheet), tap **Box**, **Circle**, **Arrow**, or **Note**. Pan stays for zooming.
4. Drag on the sheet (or tap to place a text note). The new markup stays selected.
5. Tap **Create RFI**. `/pack/[requestId]/rfi/new` opens with subject, question, location, and sheet/rev pin filled from the markup.
6. Optional: **Take photo** (camera) or **Choose photo**. The image is stored as a data URL on the draft — not uploaded to Procore.
7. **Send draft to Pat Nguyen**.

Markups persist to Supabase `public.markup_overlays` (`request_id`, `sheet_id`, `vectors` jsonb, `user_id`, `updated_at`) via service-role `/api/markups` under the stub session — same write path as `rfis` / `procore_connections`. Schema is on main ([PR #9](https://github.com/gregorydcastro-cpu/RFI-iphone/pull/9)): `supabase/migrations/20260918020000_share_markup_rfi_trial.sql` plus `20260918130000_rfis_markup_overlay_fk.sql`. Types: `lib/schema.ts`. **localStorage** (`gcfieldlog.markup:request_id:sheet_id`) is only the offline/demo fallback when `SUPABASE_SERVICE_ROLE_KEY` is missing.

The RFI row’s optional `markup_id` points at the overlay. The draft packet also keeps a vector snapshot + sheet id/rev. Share-folder portal, weekly rev re-pull, and trial-link gating are out of scope.

```bash
curl -s "http://localhost:3000/api/markups?request_id=maple-point&sheet_id=A-101"
# {"ok":true,"persisted":false,"storage":"unconfigured","row":null}
```

Never commit secrets. Search the client bundle for `XAI_API_KEY` — the secret must not appear there.

Never commit secrets. Never log them. Sandbox id/secret live on the shared box at `/home/box/.secrets/procore_client_id` and `/home/box/.secrets/procore_client_secret` — copy those values into Vercel env; do not put them in git. If those files are present at runtime and Vercel env is unset, the server will read them as a fallback.

[Procore OAuth docs](https://procore.github.io/documentation/oauth-auth-grant-flow): authorize `GET {login}/oauth/authorize`, token `POST {login}/oauth/token`. Developer Sandbox login host is `login-sandbox.procore.com`. Access tokens last ~1.5 hours; refresh tokens are stored for later.

**Company id** is dynamic per project (Maple Point demos only in this app). Do not hardcode a company. `procore_connections.company_id` is last-known from `/me` only. Later API calls must use `resolveCompanyIdForProject` against the selected demo job name.

#### Token table (`public.procore_connections`)

Applied on the gc-field-log Supabase project. SQL: `supabase/migrations/20260918010000_procore_connections.sql`.

| Column | Notes |
| --- | --- |
| `user_id` | Primary key. Stub: `stub:` + sha256(email). Replace with `auth.uid()` when real auth lands. |
| `email` | Stub session email |
| `access_token` | Never returned to the browser |
| `refresh_token` | Never returned to the browser |
| `expires_at` | Access token expiry |
| `company_id` | Last-known from `/me` only. **Not** a hardcoded Field Log company. Resolve per project. |
| `procore_user_id` | From `/rest/v1.0/me` when available |
| `created_at` / `updated_at` | Timestamps |

RLS is on. `anon` has no grants. `authenticated` may **SELECT own row** only (`auth.uid()` or JWT email). Service role upserts. Status API selects non-secret columns only.

If `SUPABASE_SERVICE_ROLE_KEY` is missing, Connect still redirects through Procore but the callback cannot persist tokens (`storage_unconfigured`). Do not use `SUPABASE_ANON_KEY` for this table.

### Stripe Checkout (Vercel + Dashboard)

Go-live operator checklist: **[STRIPE_GO_LIVE.md](STRIPE_GO_LIVE.md)**.

60-day free trial that **auto-converts** to the monthly Price because Checkout collects a payment method (`payment_method_collection: always`). Hosted Checkout is used — no Stripe.js on the pricing page. Maple Point local demo does **not** need these keys.

**Vercel env (Production / Preview as needed):**

| Key | Role |
| --- | --- |
| `STRIPE_SECRET_KEY` | Server-only secret (`sk_test_…` / `sk_live_…`). Creates Checkout Sessions and verifies webhooks. **Never** `NEXT_PUBLIC_`. |
| `STRIPE_WEBHOOK_SECRET` | Server-only signing secret (`whsec_…`) from the webhook endpoint. **Never** `NEXT_PUBLIC_`. |
| `STRIPE_PRICE_ID` | Recurring Price id (`price_…`) for the monthly subscription. **Never** `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publishable only (`pk_test_…` / `pk_live_…`). Not required for hosted Checkout; set it anyway for later Stripe.js. Safe to expose. |
| `SUPABASE_URL` | Same project as `room_packs` / `procore_connections` |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhook upserts `public.billing_customers`. Anon key must not write this table. |

Never commit secret values. Never log them.

**Dashboard — Product / Price**

1. [Products](https://dashboard.stripe.com/products) → **Add product** (e.g. GC Field Log monthly).
2. Add a **recurring** Price (monthly, USD or your currency). Copy the Price id (`price_…`) into Vercel `STRIPE_PRICE_ID`.
3. Do not put the amount in git — Checkout reads it from the Price.

**Dashboard — payment methods (cards + Apple Pay + PayPal)**

1. [Payment methods](https://dashboard.stripe.com/settings/payment_methods) — enable **Cards**. Checkout then shows Apple Pay / Google Pay as wallets on eligible devices with no extra app code.
2. [Payment method domains](https://dashboard.stripe.com/settings/payment_method_domains) — add **`gcfieldlog.com`** and **`www.gcfieldlog.com`** (and `localhost` for test). Apple Pay domain registration is required for wallets on your own pages; hosted Checkout also presents Apple Pay on Stripe’s domain.
3. Enable **PayPal** on the same Payment methods page if your Stripe account country supports it ([PayPal via Stripe](https://docs.stripe.com/payments/paypal)). US/other countries may need Stripe’s PayPal onboarding. Do **not** pass `payment_method_types` in code — Dashboard configuration is the source of truth.

**Optional later — crypto / stablecoins**

No crypto or stablecoin code in this app. Later you can turn on Stripe’s crypto/stablecoin payment methods in the Dashboard (or a separate Payment method configuration) without changing Checkout code, as long as `payment_method_types` stays unset.

**Dashboard — webhook**

1. [Webhooks](https://dashboard.stripe.com/webhooks) → **Add endpoint**.
2. Endpoint URL: **`https://gcfieldlog.com/api/stripe/webhook`** (use the Preview URL + `/api/stripe/webhook` for Vercel previews).
3. Events (at least): `checkout.session.completed`, `customer.subscription.updated`, `invoice.paid`.
4. Copy the endpoint **Signing secret** into Vercel `STRIPE_WEBHOOK_SECRET`.
5. Apply the SQL in `supabase/migrations/20260918120000_billing_customers.sql` on the gc-field-log Supabase project so the webhook can upsert rows.

**App routes**

- `POST /api/stripe/checkout` — creates a subscription Checkout Session (`trial_period_days: 60`, promotion codes allowed). Redirects the browser to Stripe-hosted Checkout. `success_url` / `cancel_url` return to `/pricing` on gcfieldlog.com (localhost and `*.vercel.app` use the request origin).
- `POST /api/stripe/webhook` — verifies `Stripe-Signature`, logs the event, upserts `billing_customers`. Does **not** send email yet (TODO in the handler).
- `/pricing` — Subscribe CTA.

If Stripe env is missing, `/pricing` still renders and Checkout returns `billing_unconfigured` (503). Pack viewer and Procore OAuth are unchanged.

#### Billing table (`public.billing_customers`)

SQL: `supabase/migrations/20260918120000_billing_customers.sql`.

| Column | Notes |
| --- | --- |
| `email` | Checkout / Customer email (nullable until Stripe provides it) |
| `stripe_customer_id` | Unique. Upsert key from webhooks |
| `stripe_subscription_id` | Latest subscription id |
| `status` | `trialing` \| `active` \| `canceled` \| `past_due` |
| `trial_end` | From the Stripe Subscription |
| `created_at` / `updated_at` | Timestamps |

RLS is on. `anon` has no grants. `authenticated` may **SELECT own row** by JWT email. Service role upserts.

#### Stub user until real auth

1. Login POSTs `/api/session` with email + role. Password is ignored.
2. Server sets httpOnly `gcfieldlog_stub_user` = `{ userId, email, role }`. Same email → same `userId`.
3. Pullers see Connect Procore on `/jobs`, the job request page, and `/account`. Viewers do not need it.
4. After OAuth, `gcfieldlog_procore_linked=1` is set (puller linked). Sign out (`/api/session/logout`) clears the stub cookie; tokens stay in Supabase until Disconnect.
5. Upgrade path: replace the stub cookie with real Supabase/Auth.js session and store `auth.uid()` as `user_id`. Keep RLS as written.

### Roles (stub MVP)

Auth is still stubby. Default is **read-only viewer**. Only a **connected Procore account** (the puller after OAuth) can trigger pulls.

| Mark a puller | How |
| --- | --- |
| Login role | Choose **Puller**, then **Connect Procore** |
| Cookie | `gcfieldlog_procore_linked=1` (httpOnly; set by `/api/procore/callback`) |
| Header (API) | `x-procore-linked: true` (also `1` / `yes` / `puller`) |

Viewers can open `/pack/[requestId]` and see sheets, RFIs, and revision stamps. Pull / file-pull controls are hidden. `POST /api/room-pack` and `POST /api/room-pack/refresh` return **403** for viewers and unconnected pullers.

This is not real auth. Anyone who can set the cookie or header is a puller. Replace with a real Procore-linked session later.

### Supabase + Procore bot (Vercel)

Read **only** these exact keys from `process.env` on the server. Never commit values, never `NEXT_PUBLIC_` them, never log them.

| Key | Role |
| --- | --- |
| `SUPABASE_URL` | `https://aejevzkqvlwbmjbqdxuu.supabase.co` |
| `SUPABASE_ANON_KEY` | Anon / publishable key for the gc-field-log project |

```ts
process.env.SUPABASE_URL
process.env.SUPABASE_ANON_KEY
```

- **Both set (Production):** website live view GETs the latest `public.room_packs` row with `cache: "no-store"`. Connected pullers POST a refresh that coordinates the **Procore bot** (`969a9d8e-c07f-44c3-ae9d-862704cd60c7`). The bot owns the Procore pull and upserts `room_packs`. The website then re-reads the latest row. No expiry timers.
- **Missing / local:** Maple Point JSON, **no** Supabase call, **no** bot pull.
- **Hard rule:** never display another job’s pack. Match project slug or exact job name.

The deleted webhook keys (`procore_room_pack_webhook_url`, `procore_room_pack_webhook_authorization`) are **not** used.

### `public.room_packs` (project `aejevzkqvlwbmjbqdxuu`)

Inspected live. Columns:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK, `gen_random_uuid()` |
| `project_name` | text | Job name from the bot / row |
| `pack_data` | jsonb | Full `gcpullog.room_pack.v1` document (`request_id`, `room`, `sheets[].id` / `sheets[].rev`, `layout` / `wall_bounds`, `pulled_at`, …) |
| `created_at` | timestamptz | Row insert time |

`request_id`, `room`, and `pulled_at` live **inside** `pack_data` (not table columns). The website looks up `pack_data->>request_id` with `cache: "no-store"`, then `project_name`, newest `created_at` first.

Bot/ops persist: insert `{ project_name, pack_data }` (history). Latest row is source of truth.

Production verification pack: open **`/pack/sample-arch-bounds-733`** when `SUPABASE_URL` + `SUPABASE_ANON_KEY` are set. That row is a live Procore-bot field test (architectural sheet `A207_N` first, `layout.wall_bounds` in pdf points). Do not copy that job’s name into Maple Point demo files or marketing copy.

Local `npm run dev` without Supabase env cannot load that request id — it is not a Maple Point JSON file.

### Live sheet PDFs (Google Drive proxy)

The Procore bot stores drawing files in **Google Drive**. Inspected live `sample-arch-bounds-733` `sheets[]` **as stored in `room_packs`**:

| Field | Production value |
| --- | --- |
| `pdf` | `""` (empty string) |
| `crop` / `preview` | `https://drive.google.com/file/d/<FILE_ID>/view` (Drive **view** URL, not PDF bytes) |
| empty sheet | `pdf` / `crop` / `preview` all `""` (viewer: “No PDF attached”) |

Example: `A207_N` crop/preview file id `1-UluTsR9__FBCyfiQay_A3k_ulGW5rmx`. `A257_N` has no crop/preview.

The website resolves a sheet PDF as: non-empty same-origin or absolute `pdf` first; otherwise extract a Drive file id from `crop`, then `preview`. pdf.js is never pointed at Drive. Maple Point demo paths (`/packs/*.pdf`) are same-origin and still load **directly**.

**Website path:** `GET /api/sheet-pdf?requestId=&sheetId=` uses the same `room_packs` lookup as the pack viewer, resolves crop/preview Drive ids, downloads the file (Drive export/API), and streams `application/pdf` (`Cache-Control: private, max-age=300`). Drive tokens never go to the client.

**Fetch order (server):**

1. Local `/packs/*.pdf` from `public/packs` (Maple Point).
2. **Google Drive** file id → Drive API `files.get?alt=media&supportsAllDrives=true` when a service account or API key is configured. If credentials are missing, try an unauthenticated download; a login wall returns **503** `{ code: "drive_auth_missing" }`.
3. Other **https** public/signed URLs (private IPs blocked).
4. **procore.com** URLs are **not** fetched (bot owns the Procore pull). **502** `{ code: "procore_pdf_unsupported" }` — store a Drive or public/signed URL in `sheets[].pdf`.

**Ops — share the bot folder with the website service account:**

1. Google Cloud → create a service account with no extra roles required beyond Drive file access via sharing.
2. Paste the JSON into Vercel **`GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`** (Production; Preview if you test live packs there). Never `NEXT_PUBLIC_`. Never commit.
3. In Drive, share the folder the Procore bot writes pack PDFs into with that `client_email` as **Viewer** (same folder as the `A207_N` / lighting sheet files). Optional: set `GOOGLE_DRIVE_FOLDER_ID` to that folder id as an ops reminder — the download uses the file id already in `sheets[].pdf`.
4. Without these keys, the viewer shows the 503 message instead of **Failed to fetch**. With keys but a file not shared, expect **502** `{ code: "drive_forbidden" }`.

```bash
# Missing requestId/sheetId
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/sheet-pdf"
# 400

# Maple Point local PDF (no Drive keys needed)
curl -s -o /tmp/a101.pdf -w "%{http_code} %{content_type}\n" \
  "http://localhost:3000/api/sheet-pdf?requestId=maple-point&sheetId=A-101"
# 200 application/pdf

# Live Drive sheet without Vercel Drive credentials (after deploy, or locally with Supabase):
curl -s "https://www.gcfieldlog.com/api/sheet-pdf?requestId=sample-arch-bounds-733&sheetId=A207_N"
# 503 {"ok":false,"code":"drive_auth_missing",...}  until GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is set + folder shared
```

**RLS is currently disabled** on `public.room_packs`, so the anon key can read and write every row. Enabling RLS without a SELECT policy would block the website. Suggested later (do not apply blindly):

```sql
ALTER TABLE public.room_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_packs_read_anon ON public.room_packs
  FOR SELECT TO anon, authenticated USING (true);
-- Keep INSERT/UPDATE for the Procore bot / service role, not the browser.
```

Local `npm run dev` does not need any of these variables.

### Share / viewer portal (schema + API stubs)

SQL: `supabase/migrations/20260918020000_share_markup_rfi_trial.sql` plus overlay FK `20260918130000_rfis_markup_overlay_fk.sql`. Types: `lib/schema.ts`. Apply those migrations on the gc-field-log Supabase project when ready; this repo does not auto-apply them.

**Overlap with tables already on main — do not duplicate:**

| Existing migration | Table | This PR |
| --- | --- | --- |
| `20260918021000_rfis.sql` (PR #12) | `public.rfis` | Left as-is. `create table` is **not** repeated here. Additive FK `rfis.markup_id` → `markup_overlays` only (`on delete set null`). Generate RFI types stay in `lib/rfiSchema.ts` (re-exports `lib/schema.ts`). |
| `20260918120000_billing_customers.sql` (Stripe) | `public.billing_customers` | Untouched. `trial_link_tokens` is a separate share-portal token table, not Stripe billing. |
| `20260918093000_time_tracking.sql` | `job_sites` / `workers` / `time_punches` | Untouched. |
| `20260918010000_procore_connections.sql` | `procore_connections` | Untouched. `room_packs` RLS stays off. |

**Pack viewer markup** (this app) writes `markup_overlays` through `/api/markups` and links drafts with `rfis.markup_id`. Share-folder UI, weekly re-pull, and trial-link redeem stay later. Architectural floor plan first and the oversized red room highlight are already on the Field Log viewer.

These tables do **not** replace `procore_connections`, `room_packs`, `rfis`, or `billing_customers`.

| Table | Purpose | Who writes |
| --- | --- | --- |
| `share_folders` | Owner's named pin set | Owner (or **service role** until real auth) |
| `pinned_sheets` | Sheet in a folder + `discipline` (electrical / lighting / architectural / room) + last seen rev | Folder owner / service role |
| `sheet_revision_cache` | Rev-only bump metadata: `project_name` + `sheet_id` + `rev` + `checked_at` | **Service role only** |
| `markup_overlays` | Vector overlay JSON (circle / box / arrow / text) on a pack sheet | Owning `user_id` / service role |
| `rfis` | Draft RFI (existing PR #12 table; optional `markup_id` FK added here) | Owning `user_id` / service role |
| `trial_link_tokens` | Trial URL token + `expires_at` + `plan` `free` \| `paid` | Owning `user_id` / service role |

**Weekly rev-only re-pull (future job, not this PR):** a scheduled worker reads `pinned_sheets`, compares each sheet's current Procore top revision to `sheet_revision_cache.rev`, and **re-downloads only when `rev` bumped**. On a bump it updates `sheet_revision_cache` (`rev`, `checked_at`) and `pinned_sheets.last_seen_rev` / `last_pulled_at`. Unchanged revs are metadata-only (no PDF fetch). Notify-on-bump is later.

**Manual force refresh (this PR, stub only):** `POST /api/share/refresh-all` is puller-gated and returns `{ accepted: true, stub: true }`. It does **not** walk pins or call Procore yet.

**RLS (restrictive defaults):** enabled on the new share/markup/trial tables. `anon` has no grants (no public share-folder read until a later PR adds an explicit public flag). `authenticated` may CRUD **own** folders, pins, markups, and trial tokens (`user_id` / folder owner = `auth.uid()::text`). `sheet_revision_cache` has no anon/authenticated policies. `rfis` RLS stays the PR #12 owner policies.

**`SUPABASE_SERVICE_ROLE_KEY` is required for writes** that must succeed under the stub session (`stub:` + sha256 email does not match `auth.uid()`). Same rule as `procore_connections`. Never `NEXT_PUBLIC_` the service role key. Token lookup for expired trial links should also use the service role, not the anon key.

`user_id` / `owner_user_id` are `text` so stub ids and later `auth.uid()::text` both fit. Maple Point demos only in the app; these tables are job-name strings, not a hardcoded company id.

**Cloudflare Pages** can host Next.js later. Keep Vercel as the primary.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Stub **login** (creates session cookie) |
| `/jobs` | Fictional **job selection** + Connect Procore (puller) |
| `/jobs/[projectSlug]` | **Pull / open room pack** (connected puller POSTs `/api/room-pack`; viewer opens `/pack/[requestId]` only) |
| `/jobs/[projectSlug]/rooms/[room]` | Alias → `/pack/{slug}-{room}` (no pull; use the request form) |
| `/account` | Stub account + Procore connected state + billing link |
| `/pricing` | Subscribe CTA → Stripe-hosted Checkout (60-day trial) |
| `/time` | **Time tab** — worker punch + foreman crew week (Maple Point geofence) |
| `/api/session` | POST stub login |
| `/api/session/logout` | Clear stub session |
| `/api/procore/connect` | Redirect to Procore OAuth authorize |
| `/api/procore/callback` | Exchange code, store per-user tokens |
| `/api/procore/status` | Connected state (no tokens) |
| `/api/procore/disconnect` | Revoke + delete this user’s tokens |
| `/api/room-pack` | Puller POST. Requests a Procore bot refresh + reads `room_packs`. Demo when Supabase unset. |
| `/api/room-pack/refresh` | Puller POST. Bot refresh, optional `{ pack }` upsert, then latest `room_packs` row. |
| `/api/room-pack/live` | Anyone GET/POST. Latest `room_packs` row, `no-store`. Does not pull. |
| `/api/room-pack/status` | Alias of live read (no Drive poll, no webhook). |
| `/api/sheet-pdf` | GET `?requestId=&sheetId=`. Streams a sheet PDF (Drive proxy or local `/packs`). Secrets stay on the server. |
| `/api/share/refresh-all` | Puller POST stub. Mike force-refresh of pinned sheets; no Procore pull yet. |
| `/api/time` | GET Maple Point site, workers, week punches (memory demo or service-role Supabase) |
| `/api/time/punches` | POST worker punch (GPS + geofence) or `{ foreman: true }` missed-punch override |
| `/api/voice/status` | GET. `{ configured }` for Grok Voice — never returns the key |
| `/api/dictation` | POST multipart `file`. Server-side Grok STT (`XAI_API_KEY`) |
| `/api/tts` | POST `{ text }`. Server-side Grok TTS MP3 (`XAI_API_KEY`) |
| `/api/markups` | GET/PUT vector overlay for a pack sheet (`request_id` + `sheet_id`). Service-role upsert into `markup_overlays`. localStorage only if service role is missing. |
| `/api/stripe/checkout` | POST. Creates a subscription Checkout Session (60-day trial). |
| `/api/stripe/webhook` | POST. Stripe signature + `billing_customers` upsert. |
| `/pack/[requestId]` | Live pack viewer. Re-reads on open. Unknown IDs fall back to local Maple Point demo |
| `/pack/[requestId]/rfi/new?sheet=&markup=&item=` | Generate RFI — draft to foreman (not Procore). Markup query prefills from a selected overlay. |
| `/pack/[requestId]/materials` | Order materials — draft to foreman (not Procore) |

## Time tab (Maple Point geofence)

Field log only. No new env keys for the local demo. If `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set **and** `supabase/migrations/20260918093000_time_tracking.sql` is applied, punches persist in Supabase; otherwise the Node process keeps an in-memory copy of the seeded week.

**Demo site fence (Maple Point Medical Office, Cedar Falls):**

| | |
| --- | --- |
| Latitude | `42.5349` |
| Longitude | `-92.4450` |
| Radius | `300` m |
| Timezone | `America/Chicago` |

These coords are a public downtown Cedar Falls point so GPS can be tested. The job is fictional. Live jobs must **not** hardcode a name → lat/lng map; they read `job_sites.lat` / `lng` / `radius_m` (config row keyed by slug). Maple Point is the only fictional UI demo. Danoff is live field tests only — never put Danoff, Brown, or Rossi in demo UI or seed copy.

**Worker punch:** phone is punch in/out. Shared iPad: pick a worker, enter PIN to switch, then punch. Punch-in stays **locked** without GPS permission, without the matching PIN, and when the device is outside the site radius. Punch-out may run off-site. The API rejects off-site punch-in (`403`, `code: "off_site"`) unless `{ "foreman": true }`.

**Foreman crew week:** Mon–Sun grid for the Maple Point roster (Pat Nguyen foreman, Alex Rivera, Jordan Hale, Sam Ortiz, Casey Brooks, Riley Chen). Seed week is **Mon 14 Sep 2026**. Daily hours over 8 and week totals over 40 render in racing red (`#e10600`). Click a cell, then save a missed in/out pair or correct a time.

**Manual check (no live GPS needed for the lock + grid):**

1. Sign in (stub) → header **Time**.
2. Leave PIN blank, or deny location / keep real GPS (not in Cedar Falls): **Punch in** stays disabled.
3. Enter the Maple Point demo PIN shown on the card. Chrome DevTools → More tools → Sensors → Location override `42.5349`, `-92.4450` → Retry location → Punch in unlocks.
4. Open **Crew week**: Alex Thursday `10.0` and Riley week `41.5` are red; Jordan Friday is empty on a fresh seed — add a missed punch as foreman.

Paper scan is phase 2 (disabled stub). Not payroll. No Stripe changes.

## Theme tokens (GlineRacing, adapted)

Observed on [glineracing.com](https://glineracing.com) live CSS (`/_next/static/css/f2c975d8c7508e2f.css`, 2026-09-17). Field dashboard keeps those surfaces and uses a **racing red CTA** so primary buttons stay high-contrast on dark panels.

| Token | Value | Use |
| --- | --- | --- |
| `--color-primary` | `#191616` | Header, cards, side panel |
| `--color-secondary` | `#f5f1eb` | Primary type |
| `--color-accent-1` | `#673b2f` | Warm brown-red (badges / deep fill) |
| `--color-accent-2` | `#6d9ca5` | Muted labels |
| `--color-accent-3` | `#4d7798` | Answered / steel info |
| `--color-tan` | `#c8bdac` | Secondary type / metal |
| gray-900 | `#111827` | Page background, sheet well |
| gray-800 | `#1f2937` | Raised charcoal |
| `--color-cta` | `#e10600` | Primary buttons, active tabs, room highlight |
| `--color-cta-hover` | `#ff2b1a` | Button hover |
| Display font | Oswald | Clean **GC Field Log** wordmark |
| UI font | Geist | Body |

Defined in `app/globals.css`.

## Where production packs come from

Live packs are produced by the **Procore bot** (`969a9d8e-c07f-44c3-ae9d-862704cd60c7`) and stored in Supabase **`public.room_packs`**, schema `gcpullog.room_pack.v1`.

**Request (this app, Production, connected puller):** `POST /api/room-pack` or `POST /api/room-pack/refresh` asks that bot to pull, then reads the latest matching `room_packs` row with `SUPABASE_URL` + `SUPABASE_ANON_KEY` (`cache: "no-store"`). Opening `/pack/[requestId]` does the same read every time (pullers also trigger refresh). The website does **not** call the deleted Room pack webhook.

**Viewer:** GET `/api/room-pack/live` / open `/pack/[requestId]` only. No pull.

**Local demo:** `SUPABASE_URL` / `SUPABASE_ANON_KEY` unset → local Maple Point JSON.

The bot (or ops) persists by inserting a `room_packs` row (`project_name`, `request_id`, `room`, `pulled_at`, `pack_data`). Optional website callback: `POST /api/room-pack/refresh` with `{ pack }` and a puller cookie/header.

## Pack JSON contract (`gcpullog.room_pack.v1`)

Coordinate-ready: drop a JSON file at `public/packs/<requestId>.json` and open `/pack/<requestId>`. Demo packs are those local files. Production bot output uses this same shape in `room_packs.pack_data`.

```json
{
  "schema": "gcpullog.room_pack.v1",
  "status": "ready",
  "request_id": "maple-point",
  "pulled_at": "2026-09-18T00:15:17.277Z",
  "revision_stamp": { "drawing": "A-101", "rev": "A" },
  "project": { "id": "proj-maple-point", "name": "Maple Point Medical Office", "slug": "maple-point" },
  "room": { "id": "room-e101", "name": "Electrical Closet 101", "number": "101" },
  "sheets": [
    { "id": "A-101", "rev": "A", "title": "Level 1 Floor Plan", "discipline": "architectural", "pdf": "/packs/maple-point-a101.pdf", "preview": null, "crop": null },
    { "id": "E-101", "rev": "A", "title": "Level 1 Power Plan", "discipline": "electrical", "pdf": "/packs/maple-point-e101.pdf", "preview": null, "crop": null }
  ],
  "rfis": [
    { "id": "r1", "number": "RFI-001", "title": "Panel feed clarification", "status": "open", "url": null }
  ],
  "layout": {
    "sheet": "A-101",
    "type": "polygon",
    "locator": "Electrical Closet 101",
    "points": [[0.2, 0.2], [0.5, 0.2], [0.5, 0.5], [0.2, 0.5]],
    "bbox": { "x": 0.2, "y": 0.2, "w": 0.3, "h": 0.3 },
    "bbox_pdf_pts": { "x": 244.8, "y": 396, "w": 367.2, "h": 237.6 },
    "page_width_pts": 1224,
    "page_height_pts": 792
  },
  "actions": [
    { "id": "generate-rfi", "label": "Generate RFI", "href": "/pack/maple-point/rfi/new?sheet=A-101", "enabled": true, "note": "Draft to foreman — not a Procore submit" },
    { "id": "order-materials", "label": "Order materials", "href": "/pack/maple-point/materials", "enabled": true, "note": "Draft to foreman — not a Procore PO" }
  ]
}
```

| Field | Notes |
| --- | --- |
| `status` | e.g. `ready` / `pending` — shown in the top bar |
| `pulled_at` | ISO timestamp of this pull. Shown in the pack viewer. Not a cache expiry. |
| `revision_stamp` | `{ drawing, rev }` for the primary sheet at pull time |
| `project` | `{ id, name, slug }` |
| `room` | `{ id, name, number? }` |
| `request_id` | URL key for `/pack/[requestId]` |
| `sheets[]` | `{ id, rev, pdf, preview?, crop?, title?, name?, discipline? }` — `id` is the drawing number, `rev` is the revision letter. Viewer stamps show `A-101 Rev A`. Optional `title` / `discipline` help pick the architectural floor plan first. Demo `pdf` is a same-origin `/packs/….pdf`. Live bot rows often have `pdf: ""` with Drive **view** URLs on `crop` / `preview` (`/file/d/<id>/view`); the viewer resolves a file id and loads the PDF through `/api/sheet-pdf`. |
| `rfis[]` | `{ id, number, title, status, url? }` |
| `layout` | Room locator on the sheet |
| `actions` | Dashboard buttons. **Generate RFI** and **Order materials** are live (drafts to foreman, not Procore — [PR #12](https://github.com/gregorydcastro-cpu/RFI-iphone/pull/12)). Pack JSON `"Coming soon"` / `enabled: false` for those two is ignored. |
| `takeoff` | **Optional.** If missing, Takeoff counts is empty |

### Highlight (coordinate-ready)

The overlay is an **SVG** on the sheet (racing-red CTA `#e10600` stroke), not a baked highlight image. The crew sees an **oversized box around the room walls** (~8% pad, min ~1.2% of the page) so the target room is easy to find on a phone or iPad.

Resolution order:

1. `layout.wall_bounds` (live bot) — `polygon` and/or `bbox` `[x1,y1,x2,y2]`, `units: "pdf_pts"` (PDF user-space, origin **bottom-left**) or normalized 0–1. `sheet_id` tags the architectural sheet. Page size comes from the rendered PDF when possible, else `page_width_pts` / `page_height_pts`.
2. Else `layout.points` — wall outline in **normalized 0–1** coordinates, origin **top-left**.
3. Else `layout.bbox` `{x,y,w,h}` — same normalized space.
4. Else `layout.bbox_pdf_pts` — object `{x,y,w,h}` **or** `[x1,y1,x2,y2]`, origin **bottom-left**, mapped with page size, then padded outward.

Example live `wall_bounds` (fictional coords shown in Maple Point demo; production bot may send the same shape):

```json
"layout": {
  "sheet": "A-101",
  "wall_bounds": {
    "sheet_id": "A-101",
    "units": "pdf_pts",
    "bbox": [244.8, 396, 612, 633.6],
    "polygon": [[244.8, 396], [612, 396], [612, 633.6], [244.8, 633.6]]
  },
  "bbox_pdf_pts": [244.8, 396, 612, 633.6],
  "page_width_pts": 1224,
  "page_height_pts": 792
}
```

`project` and `room` may be strings (`"733"`) or objects; the website coerces them. Empty `sheets[].rev` shows the drawing number without `Rev ?`.

The viewer prefers a clean **architectural floor plan** as the first (highlighted) page when the pack includes one (`A*` id such as `A207_N` / `A-101`, `architectural` discipline, or “floor plan” in the title). Remaining detailed sheets stack below. If none match, the current primary (`layout.sheet` / `wall_bounds.sheet_id`, else `sheets[0]`) stays first.

### Optional takeoff counts (placeholder)

Always shown. Empty without `takeoff`. When present, renders `by_room`:

```json
{
  "project": "Maple Point Medical Office",
  "scope": "Electrical Closet 101 — Level 1 power",
  "sheets": ["E-101"],
  "units": "each",
  "by_room": [
    {
      "room": "101",
      "name": "Electrical Closet 101",
      "sheet": "E-101",
      "fixtures": [{ "type": "Junction box 4sq", "qty": 6 }]
    }
  ],
  "by_type": [{ "type": "Junction box 4sq", "qty": 6 }],
  "by_sheet": [{ "sheet": "E-101", "qty": 6 }],
  "confidence": "demo",
  "flags": ["fictional-project"]
}
```

## Later (not implemented)

- Real crew **login** (replace stub session cookie with Supabase Auth / Auth.js; keep `procore_connections.user_id` = `auth.uid()`)
- Use stored per-user Procore tokens for live pulls (Connect Procore only **stores** tokens today; pack refresh still goes through the Procore bot)
- Stripe **Customer Portal**, entitlement gating, and receipt / trial emails (Checkout + webhook scaffold is in this PR; no email send yet)
- Stripe **crypto / stablecoin** payment methods (Dashboard-only later — no app code)
- **Tools** nav
- Paper timesheet **photo scan / OCR** (Time tab has a disabled stub)
- Realtime Grok speech-to-speech on site (this PR is batch STT + TTS)
- Payroll export / ADP
- Sent pack **snapshots** (text/email frozen copies — not in this PR)
- Share folder / pinned-sheet UI, weekly rev-only re-pull job, trial-link redeem
- Weekly rev-only re-pull job (read `sheet_revision_cache`, download only on bump) and a real `POST /api/share/refresh-all` implementation
- RLS policies on `public.room_packs` (table is currently wide open to the anon key)
- HostGator DNS cutover to Vercel for gcfieldlog.com
- No Apple / native iOS

## Demo data

**Maple Point / fictional only.** Do not use Brown, Rossi, ILSB, EL107, Danoff, Suffolk, or any real client names or production sheet IDs. Danoff is live field tests only — never in demo UI or seed copy.

Sample files:

- `public/packs/maple-point.json`
- `public/packs/maple-point-a101.pdf`
- `public/packs/maple-point-e101.pdf`
- `public/packs/maple-point-e102.pdf`

Time demo roster + sample week: `lib/timeDemo.ts` and `supabase/migrations/20260918093000_time_tracking.sql`.
