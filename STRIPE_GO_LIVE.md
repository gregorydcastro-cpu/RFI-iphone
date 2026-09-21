# Stripe go-live checklist (Greg)

Operator steps to take **GC Field Log** Checkout live on [www.gcfieldlog.com](https://www.gcfieldlog.com) (issue [#26](https://github.com/gregorydcastro-cpu/RFI-iphone/issues/26)). Maple Point local demos do **not** need these keys. Do not put secret values in git.

Without `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID`, `POST /api/stripe/checkout` returns `{ ok: false, error: "billing_unconfigured" }` with **503**. `/pricing` still renders. That 503 means **Vercel Production is missing Stripe keys**, not a host allowlist.

## When keys arrive

1. Product + recurring Price → Vercel `STRIPE_PRICE_ID`
2. `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test keys first, then live)
3. Payment method domains: `gcfieldlog.com`, `www.gcfieldlog.com` (+ `localhost` for test)
4. Enable Cards (Apple Pay / Google Pay wallets follow). PayPal if the account country supports it.
5. Webhook URL **`https://www.gcfieldlog.com/api/stripe/webhook`** — **www, not apex** (apex may 308; Stripe does not follow redirects)
6. Events: `checkout.session.completed`, `customer.subscription.updated`, `invoice.paid`
7. Signing secret → Vercel `STRIPE_WEBHOOK_SECRET`
8. Confirm `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` on Production (`billing_customers` is already live on gc-field-log)
9. **Redeploy Production** after saving env
10. `POST /api/stripe/checkout` is no longer `billing_unconfigured` 503; complete a test Checkout, then switch to live keys + a live webhook endpoint

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

Without `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET`, the webhook route also returns `billing_unconfigured` (503).

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

## 8. Confirm unconfigured behavior

With keys unset (Maple Point demo / Vercel Production before Stripe env is set):

- `/pricing` still renders.
- `POST /api/stripe/checkout` returns **`billing_unconfigured`** with **HTTP 503**.
- Pack viewer, Time, Voice, and Procore OAuth are unchanged.

Checkout is a 60-day trial that auto-converts to the monthly Price because Checkout collects a payment method (`payment_method_collection: always`).
