# GC Field Log — crew dashboard (web)

Browser **dashboard for field crews** on **[gcfieldlog.com](https://gcfieldlog.com)**. Foremen and supers sign in (stub), pick a job, request a room pack, then work the sheet: zoomable floor plans, room highlight, linked RFIs, and Generate RFI / Order materials.

This is the product surface. **Native iOS is paused. No Apple.** Real login and **Stripe monthly billing** are later — the login page is a **stub session** (httpOnly cookie with user id + email + role). Wordmark is clean text: **GC Field Log** (no extra logo).

Host: **Vercel (primary)** with **HostGator DNS** for `gcfieldlog.com` (document only; this PR does not change DNS). Cloudflare Pages is a possible later target.

No real crew auth, Stripe, HostGator uploads, or live Procore REST API in this MVP. The **Room pack webhook routine is deleted** — this app does **not** call `procore_room_pack_webhook_url` / webhook Authorization.

**Pullers** can **Connect Procore** with their own Procore login (OAuth authorization code). Tokens are stored per stub user in Supabase `procore_connections`. Viewers do not need to connect and cannot trigger a pull.

**Live path:** the Procore bot (`969a9d8e-c07f-44c3-ae9d-862704cd60c7`) owns the Procore pull and upserts `public.room_packs` on Supabase project `aejevzkqvlwbmjbqdxuu`. The website reads that table with `SUPABASE_URL` + `SUPABASE_ANON_KEY` (`cache: "no-store"`) on every pack open. Pullers who have connected Procore can request a refresh; viewers only read. Local demo leaves Supabase unset: Maple Point JSON, no pull.

## Locked nav (MVP)

Must match this path — nothing else in the primary nav:

**Login (stub) → Jobs → Room pack request → Pack viewer (plan + sheets + RFIs) → Generate RFI / Materials stubs.**

**Tools** and **Time** appear in the header as later (not wired). No Apple.

## What the dashboard shows (MVP)

| Area | Behavior |
| --- | --- |
| Login (`/`) | Email/password form UI. Submit creates a stub session cookie (`gcfieldlog_stub_user`) with `userId` + email + role (`viewer` default, or `puller`). Password is not checked. |
| Jobs (`/jobs`) | Fictional jobs only (Maple Point and similar). Header shows **Puller** / **Procore connected** / **View only**. Pullers get **Connect Procore**. |
| Account (`/account`) | Stub session + Procore connected / disconnected state. |
| Room pack request | Room number (e.g. `733`). **Connected puller:** `POST /api/room-pack` asks the Procore bot to refresh, then opens `/pack/[requestId]`. **Viewer / unconnected puller:** **Open pack** only — no pull. Local demo (no `SUPABASE_URL`) loads Maple Point JSON. |
| Pack viewer | Field stack on `/pack/[requestId]`: **architectural floor plan first** (A-*, architectural, floor plan heuristics; else current primary), oversized crimson SVG box around the room walls, then remaining sheets (power, lighting, …) and linked RFIs. Drawing number + revision letter stamps stay on the top bar and each sheet (`A-101 Rev A`). Website open always re-reads `room_packs` (no-store). Connected pullers also trigger a bot refresh; viewers cannot. |
| Generate RFI / Materials | Stub pages from the pack action buttons |
| Takeoff counts | Optional placeholder panel |

## Local run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in (stub) → pick **Maple Point Medical Office** → request room `733`.

```bash
npm run lint
npm run build
npm start
```

`npm install` copies the pdf.js worker into `public/pdf.worker.min.mjs`.

## Deploy (Vercel + HostGator DNS)

Production host is **gcfieldlog.com**.

1. Import this GitHub repo in [Vercel](https://vercel.com/new) (framework preset: **Next.js**).
2. Build command: `npm run build`. `postinstall` copies `pdf.worker.min.mjs`.
3. **Env:** the Maple Point demo needs **no** secrets. Production reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` for live `room_packs`. Procore **user** OAuth (Connect Procore) uses **`PROCORE_CLIENT_ID` / `PROCORE_CLIENT_SECRET`** and **`SUPABASE_SERVICE_ROLE_KEY`** on Vercel (server-only, never `NEXT_PUBLIC_`). Copy OAuth id/secret from `/home/box/.secrets/procore_client_id` and `procore_client_secret` — do not commit. Do **not** restore `procore_room_pack_webhook_url` / `procore_room_pack_webhook_authorization` for this live path — that routine is deleted.
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

**RLS is currently disabled** on `public.room_packs`, so the anon key can read and write every row. Enabling RLS without a SELECT policy would block the website. Suggested later (do not apply blindly):

```sql
ALTER TABLE public.room_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_packs_read_anon ON public.room_packs
  FOR SELECT TO anon, authenticated USING (true);
-- Keep INSERT/UPDATE for the Procore bot / service role, not the browser.
```

Local `npm run dev` does not need any of these variables.

**Cloudflare Pages** can host Next.js later. Keep Vercel as the primary.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Stub **login** (creates session cookie) |
| `/jobs` | Fictional **job selection** + Connect Procore (puller) |
| `/jobs/[projectSlug]` | **Pull / open room pack** (connected puller POSTs `/api/room-pack`; viewer opens `/pack/[requestId]` only) |
| `/jobs/[projectSlug]/rooms/[room]` | Alias → `/pack/{slug}-{room}` (no pull; use the request form) |
| `/account` | Stub account + Procore connected state |
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
| `/pack/[requestId]` | Live pack viewer. Re-reads on open. Unknown IDs fall back to local Maple Point demo |
| `/pack/[requestId]/rfi/new?sheet=` | Stub Generate RFI form |
| `/pack/[requestId]/materials` | Stub Order materials |

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
    { "id": "generate-rfi", "label": "Generate RFI", "href": "/pack/maple-point/rfi/new?sheet=A-101", "enabled": false },
    { "id": "order-materials", "label": "Order materials", "href": "/pack/maple-point/materials", "enabled": false }
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
| `sheets[]` | `{ id, rev, pdf, preview?, crop?, title?, name?, discipline? }` — `id` is the drawing number, `rev` is the revision letter. Viewer stamps show `A-101 Rev A`. Optional `title` / `discipline` help pick the architectural floor plan first. |
| `rfis[]` | `{ id, number, title, status, url? }` |
| `layout` | Room locator on the sheet |
| `actions` | Dashboard buttons |
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
- **Stripe** monthly billing
- **Tools** and **Time** nav
- Sent pack **snapshots** (text/email frozen copies — not in this PR)
- RLS policies on `public.room_packs` (table is currently wide open to the anon key)
- HostGator DNS cutover to Vercel for gcfieldlog.com
- No Apple / native iOS

## Demo data

**Maple Point / fictional only.** Do not use Brown, Rossi, ILSB, EL107, Danoff, Suffolk, or any real client names or production sheet IDs.

Sample files:

- `public/packs/maple-point.json`
- `public/packs/maple-point-a101.pdf`
- `public/packs/maple-point-e101.pdf`
- `public/packs/maple-point-e102.pdf`
