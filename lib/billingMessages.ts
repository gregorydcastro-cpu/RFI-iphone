/**
 * Client-safe Stripe billing copy. Names env keys only.
 * Never include secret values, key prefixes with payloads, or host allowlists.
 */

export const BILLING_UNCONFIGURED_ERROR = "billing_unconfigured" as const;

export const BILLING_PRODUCTION_ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
] as const;

export type BillingProductionEnvKey = (typeof BILLING_PRODUCTION_ENV_KEYS)[number];

const ALLOWED_MISSING = new Set<string>(BILLING_PRODUCTION_ENV_KEYS);

export const BILLING_UNCONFIGURED_MESSAGE =
  "Missing Vercel Production Stripe env (STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET). Not a host allowlist.";

export function billingEnvNames(missing?: readonly string[]): BillingProductionEnvKey[] {
  if (!missing) return [];
  const names: BillingProductionEnvKey[] = [];
  for (const key of missing) {
    if (!ALLOWED_MISSING.has(key)) continue;
    if (names.includes(key as BillingProductionEnvKey)) continue;
    names.push(key as BillingProductionEnvKey);
  }
  return names;
}

/** Operator copy for /pricing and checkout errors. Lists known unset keys when present. */
export function formatBillingUnconfigured(missing?: readonly string[]): string {
  const names = billingEnvNames(missing);
  if (names.length === 0) return BILLING_UNCONFIGURED_MESSAGE;
  return `Missing Vercel Production Stripe env: ${names.join(", ")}. Not a host allowlist.`;
}

export function billingUnconfiguredBody(missing: readonly string[] = []): {
  ok: false;
  error: typeof BILLING_UNCONFIGURED_ERROR;
  missing: BillingProductionEnvKey[];
  message: string;
} {
  const names = billingEnvNames(missing);
  return {
    ok: false,
    error: BILLING_UNCONFIGURED_ERROR,
    missing: names,
    message: formatBillingUnconfigured(names),
  };
}
