# Stripe go-live checklist (Greg)

Operator steps to take **GC Field Log** Checkout live on [www.gcfieldlog.com](https://www.gcfieldlog.com) (issue [#26](https://github.com/gregorydcastro-cpu/RFI-iphone/issues/26)). Maple Point local demos do **not** need these keys. Do not put secret values in git.

Until those keys are set, `POST /api/stripe/checkout` and `POST /api/stripe/webhook` return **HTTP 503** `{ ok: false, error: "billing_unconfigured" }` plus `missing` (env **names** only) and a `message`. `/pricing` still renders and shows the same sentence. That 503 means **Vercel Production is missing Stripe keys**, not a host allowlist and not a rejected Price.

## One-pass (live keys on Production)

1. **Paste on Vercel → Production** (do not commit values). Server-only except the publishable key:
   - `STRIPE_SECRET_KEY` (`sk_live_…`)
   - `STRIPE_PRICE_ID` (`price_…`)
   - `STRIPE_WEBHOOK_SECRET` (`whsec_…` from step 3 — if you create the endpoint after this paste, save the signing secret and redeploy again)
   - optional `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`). Hosted Checkout does not require it.
2. **Redeploy Production** so the running build picks up the env.
3. **Register the webhook** in Stripe **live** mode at **`https://www.gcfieldlog.com/api/stripe/webhook`** — **www, not apex** (apex may 308; Stripe does not follow redirects). Events: `checkout.session.completed`, `customer.subscription.updated`, `invoice.paid`.
4. **Hit checkout once** on [https://www.gcfieldlog.com/pricing](https://www.gcfieldlog.com/pricing) (or `POST /api/stripe/checkout`):
   - Page names unset Production env, and checkout/webhook return **503** `billing_unconfigured` → keys did not land. Confirm the Vercel scope is **Production**, save, redeploy.
   - Browser redirects to Stripe Checkout (API **200** `{ ok: true, url }`) → `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` are live. Finish or cancel.
   - Checkout can succeed while the page still names `STRIPE_WEBHOOK_SECRET`. A no-signature `POST /api/stripe/webhook` stays **503** until that secret is set, then returns **400** `missing_signature` (keys present; no Stripe API call).

`bash scripts/smoke-go-live.sh` prints the same split. Sections below are the same setup in more detail (domains, PayPal, test keys). `billing_customers` is already applied on gc-field-log.

## 1. Product + recurring Price → `STRIPE_PRICE_ID`

1. Stripe Dashboard → [Products](https://dashboard.stripe.com/products) → **Add product** (e.g. GC Field Log monthly).
2. Add a **recurring** Price (monthly). Copy the Price id (`price_…`).
3. Set Vercel **`STRIPE_PRICE_ID`**. Never commit the amount — Checkout reads it from the Price.

## 2. API keys → `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

| Key | Where | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Vercel, server-only | `sk_test_…` then `sk_live_…`. **Never** `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Vercel | `pk_test_…` / `pk_live_…`. Hosted Checkout does not require it; set it anyway for later Stripe.js. Safe to expose. |

Use test keys until you are ready to charge. Never log secret values.

## 3. Cards + Apple Pay (payment method domains)

1. [Payment methods](https://dashboard.stripe.com/settings/payment_methods) — enable **Cards**. Apple Pay / Google Pay then appear as wallets on eligible devices with no extra app code.
2. [Payment method domains](https://dashboard.stripe.com/settings/payment_method_domains) — register:
   - `gcfieldlog.com`
   - `www.gcfieldlog.com`
   - `localhost` (test only)

Apple Pay domain registration is required for wallets on your own pages. Hosted Checkout also presents Apple Pay on Stripe’s domain.

Do **not** pass `payment_method_types` in app code — Dashboard configuration is the source of truth.

## 4. PayPal (if the account country supports it)

On the same Payment methods page, enable **PayPal** if Stripe supports it for the account country ([PayPal via Stripe](https://docs.stripe.com/payments/paypal)). US and other countries may need Stripe’s PayPal onboarding. Skip this step if the country does not support it.

## 5. Webhook → `STRIPE_WEBHOOK_SECRET`

1. [Webhooks](https://dashboard.stripe.com/webhooks) → **Add endpoint**.
2. Endpoint URL: **`https://www.gcfieldlog.com/api/stripe/webhook`**
   - Use **www**, not apex. Stripe does not follow redirects; `https://gcfieldlog.com/api/stripe/webhook` may **308** to www and delivery will fail.
   - Preview hosts: `{preview-url}/api/stripe/webhook`
   - Test vs live: create the endpoint in the **same Dashboard mode** as the secret key. Live keys need a separate live endpoint and a new `whsec_…`.
3. Events (at least):
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `invoice.paid`
4. Copy the endpoint **Signing secret** (`whsec_…`) into Vercel **`STRIPE_WEBHOOK_SECRET`** (server-only, never `NEXT_PUBLIC_`).

Without `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET`, the webhook route also returns `billing_unconfigured` (503) and `missing` lists those key names. After both are set, a request with no `Stripe-Signature` returns **400** `missing_signature`.

## 6. Vercel env (Production / Preview as needed)

| Key | Required for |
| --- | --- |
| `STRIPE_PRICE_ID` | Checkout Session line item |
| `STRIPE_SECRET_KEY` | Checkout + webhook |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public publishable key (optional for hosted Checkout) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verify |
| `SUPABASE_URL` | Same project as `room_packs` / `procore_connections` |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhook upserts `public.billing_customers`. Anon key must **not** write this table. |

Never commit these values. After saving Production env, **Redeploy** so Checkout and the webhook pick up the keys.

## 7. Apply the `billing_customers` migration

On the gc-field-log Supabase project, apply:

`supabase/migrations/20260918120000_billing_customers.sql`

That creates `public.billing_customers` (RLS on; anon has no grants; service role upserts). The webhook cannot persist rows until this SQL has run. **Already applied** on gc-field-log — re-run only if a new project needs the table.

## 8. Confirm still-unconfigured vs live

With keys unset (Maple Point demo / Vercel Production before the one-pass above):

- `/pricing` still renders and names the unset Production env (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`). Not a host allowlist.
- `POST /api/stripe/checkout` returns **HTTP 503** `{ ok: false, error: "billing_unconfigured" }`. `missing` is the unset checkout keys (secret and/or price). No Stripe API call.
- `POST /api/stripe/webhook` with no signature returns the same 503 until `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are both set, then **400** `missing_signature`.
- Pack viewer, Time, Voice, and Procore OAuth are unchanged.

After redeploy, success is a redirect to Stripe Checkout. A 503 on that same POST means Production env still did not land.

Checkout is a 60-day trial that auto-converts to the monthly Price because Checkout collects a payment method (`payment_method_collection: always`).
