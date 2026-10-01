# Stripe go-live checklist (Greg)

Operator steps to take **GC Field Log** Checkout live on [www.gcfieldlog.com](https://www.gcfieldlog.com) (issue [#26](https://github.com/gregorydcastro-cpu/RFI-iphone/issues/26)). Maple Point local demos do **not** need these keys. Do not put secret values in git.

## Production env Greg must set (names only)

On Vercel → project **gc-field-log** → Settings → Environment Variables → **Production**, set these three. Never commit the values. Never put them on `NEXT_PUBLIC_`.

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is optional and is not one of the three. Hosted Checkout does not need it.

After a redeploy, readiness is `GET /api/stripe/status`. The JSON is booleans and unset names only — no values and no key prefixes:

```json
{
  "ok": true,
  "checkoutConfigured": false,
  "webhookConfigured": false,
  "present": {
    "STRIPE_SECRET_KEY": false,
    "STRIPE_PRICE_ID": false,
    "STRIPE_WEBHOOK_SECRET": false
  },
  "missing": ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "STRIPE_WEBHOOK_SECRET"]
}
```

`/pricing` and Account mirror that with `data-billing-checkout` and `data-billing-webhook` (`true` or `false`). When checkout is unset, the page leads with **Billing isn't live yet** and names the unset Production env. When checkout is set, the Subscribe form says **Checkout is ready** and still does not show key values.

Until checkout env is set, `POST /api/stripe/checkout` returns **HTTP 503** `{ ok: false, error: "billing_unconfigured", checkoutConfigured: false }` plus `missing` (env **names** only), `webhookConfigured`, and a `message`. The webhook POST is the same 503 with `webhookConfigured: false` until `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are both set. Clicking Subscribe shows the notice in place. That 503 means **Vercel Production is missing Stripe keys**, not a host allowlist and not a rejected Price. `bash scripts/smoke-go-live.sh` reads the status booleans. It still POSTs checkout only while `checkoutConfigured` is false, and it never creates a Checkout Session once that boolean is true.

## One-pass (live keys on Production)

1. **Paste on Vercel → Production** (do not commit values). Server-only except the publishable key:
   - `STRIPE_SECRET_KEY` (`sk_live_…`)
   - `STRIPE_PRICE_ID` (`price_…`)
   - `STRIPE_WEBHOOK_SECRET` (`whsec_…` from step 3 — if you create the endpoint after this paste, save the signing secret and redeploy again)
   - optional `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`). Hosted Checkout does not require it.
2. **Redeploy Production** so the running build picks up the env.
3. **Register the webhook** in Stripe **live** mode at **`https://www.gcfieldlog.com/api/stripe/webhook`** — **www, not apex** (apex may 308; Stripe does not follow redirects). Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`.
4. **Read readiness, then hit checkout once** on [https://www.gcfieldlog.com/pricing](https://www.gcfieldlog.com/pricing):
   - `GET /api/stripe/status` has `checkoutConfigured: false` (and `/pricing` leads with **Billing isn't live yet**) → keys did not land. `POST /api/stripe/checkout` is **503** `billing_unconfigured` with `checkoutConfigured: false`. Confirm the Vercel scope is **Production**, save, redeploy.
   - `checkoutConfigured: true` and `present.STRIPE_SECRET_KEY` / `present.STRIPE_PRICE_ID` are true → those two names are set. The status JSON has no key values. Smoke does not open a Checkout Session. A human Subscribe click that redirects to Stripe is the live check. Finish or cancel.
   - Checkout can be ready while `missing` is still `["STRIPE_WEBHOOK_SECRET"]` and `webhookConfigured` is false. A no-signature `POST /api/stripe/webhook` stays **503** until that name is set, then returns **400** `missing_signature` (keys present; no Stripe API call).
5. **Confirm the webhook path** with `bash scripts/smoke-go-live.sh` (this script never signs and never sends `Stripe-Signature`):
   - `POST /api/stripe/webhook` **503** `billing_unconfigured` → `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` is still unset. `missing` lists those names.
   - **400** `missing_signature` → both webhook env names are set. That is the configured check. The script does not create a charge.
   - `GET /api/stripe/webhook` **405** `method_not_allowed` → the route is up; only POST is accepted.
   - After the Dashboard endpoint exists, use **Send test event** there. A signed `customer.subscription.deleted` sets `billing_customers.status` to `canceled`. Redelivery upserts the same `stripe_customer_id` and does not wipe a stored email, subscription id, or trial end when the new payload omits them. A delete for an older subscription does not overwrite a newer subscription id already stored.
   - A signed event that returns **500** is Stripe's retry signal. Vercel logs `[gcfieldlog] stripe webhook handler failed` with `code` `storage_unconfigured`, `upsert_failed`, or `lookup_failed` (no secret values). `storage_unconfigured` means `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing.

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
   - `customer.subscription.deleted` (subscription ended — row becomes `canceled`)
   - `invoice.paid`
4. Copy the endpoint **Signing secret** (`whsec_…`) into Vercel **`STRIPE_WEBHOOK_SECRET`** (server-only, never `NEXT_PUBLIC_`).

Without `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET`, `POST /api/stripe/webhook` returns `billing_unconfigured` (503) and `missing` lists those key names. After both are set, a request with no `Stripe-Signature` returns **400** `missing_signature`. `GET`, `PUT`, `PATCH`, `DELETE`, and `HEAD` return **405** `method_not_allowed` whether or not the keys are set. The route stays on the Node.js runtime so the raw body can be verified.

`invoice.paid` reads the subscription id from the current payload (`parent.subscription_details.subscription`) and from older webhook API versions (`subscription` on the invoice or its lines). A redelivered event upserts the same customer. Handler failures return **500** so Stripe retries; the log `code` is `storage_unconfigured`, `upsert_failed`, or `lookup_failed` and does not include secret values.

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

- `GET /api/stripe/status` is **200** with `checkoutConfigured: false`, `webhookConfigured: false`, and `missing` listing `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`. `present` values are booleans. No key values or prefixes.
- `/pricing` still renders, `data-billing-checkout="false"`, leads with **Billing isn't live yet**, and the operator line names unset Production env. Not a host allowlist.
- `POST /api/stripe/checkout` returns **HTTP 503** `{ ok: false, error: "billing_unconfigured", checkoutConfigured: false }`. `missing` is the unset checkout keys (secret and/or price). No Stripe API call.
- `POST /api/stripe/webhook` with no signature returns the same 503 (`webhookConfigured: false`) until `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are both set, then **400** `missing_signature`.
- `GET /api/stripe/webhook` returns **405** `method_not_allowed`.
- Pack viewer, Time, Voice, and Procore OAuth are unchanged.

After redeploy, `GET /api/stripe/status` shows `checkoutConfigured: true` without echoing keys. A human click on Subscribe is the Stripe redirect. A 503 on `POST /api/stripe/checkout` means Production env still did not land. Smoke does not create a session once the boolean is true.

Checkout is a 60-day trial that auto-converts to the monthly Price because Checkout collects a payment method (`payment_method_collection: always`).
