/**
 * `public.billing_customers` — Stripe subscription rows.
 *
 * Writes use SUPABASE_SERVICE_ROLE_KEY. Anon has no access. Do not expose
 * this table to the browser. Webhooks are the source of status updates.
 */

import { readEnvAlias } from "./env";

export const BILLING_CUSTOMERS_TABLE = "billing_customers";

export const BILLING_STATUSES = [
  "trialing",
  "active",
  "canceled",
  "past_due",
] as const;

export type BillingStatus = (typeof BILLING_STATUSES)[number];

export type BillingCustomer = {
  email: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: BillingStatus;
  trialEnd: string | null;
};

type SupabaseServiceConfig = {
  url: string;
  serviceRoleKey: string;
};

const FETCH_TIMEOUT_MS = 8_000;

function getSupabaseServiceConfig(): SupabaseServiceConfig | null {
  const url = readEnvAlias("SUPABASE_URL", "supabase_url");
  const serviceRoleKey = readEnvAlias(
    "SUPABASE_SERVICE_ROLE_KEY",
    "supabase_service_role_key",
  );
  if (!url || !serviceRoleKey) return null;
  return { url: url.replace(/\/$/, ""), serviceRoleKey };
}

export function isBillingStorageConfigured(): boolean {
  return getSupabaseServiceConfig() !== null;
}

export function mapStripeSubscriptionStatus(
  status: string | null | undefined,
): BillingStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    default:
      return "past_due";
  }
}

export async function fetchBillingCustomerByEmail(
  email: string,
): Promise<BillingCustomer | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const params = new URLSearchParams();
  params.set("email", `eq.${normalized}`);
  params.set(
    "select",
    "email,stripe_customer_id,stripe_subscription_id,status,trial_end",
  );
  params.set("limit", "1");

  const response = await restFetch(
    config,
    `${BILLING_CUSTOMERS_TABLE}?${params.toString()}`,
    { method: "GET" },
  );
  if (!response || !response.ok) {
    if (response && !response.ok) {
      console.error("[gcfieldlog] billing_customers email read was not ok", {
        status: response.status,
      });
    }
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : null;
  return parseBillingCustomer(row);
}

export async function upsertBillingCustomer(
  input: BillingCustomer,
): Promise<boolean> {
  const config = getSupabaseServiceConfig();
  if (!config) return false;

  const now = new Date().toISOString();
  const body = {
    email: input.email?.trim().toLowerCase() || null,
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.stripeSubscriptionId,
    status: input.status,
    trial_end: input.trialEnd,
    updated_at: now,
  };

  const response = await restFetch(
    config,
    `${BILLING_CUSTOMERS_TABLE}?on_conflict=stripe_customer_id`,
    {
      method: "POST",
      headers: {
        Prefer: "return=minimal,resolution=merge-duplicates",
      },
      body: JSON.stringify(body),
    },
  );
  if (!response) return false;
  if (!response.ok) {
    console.error("[gcfieldlog] billing_customers upsert was not ok", {
      status: response.status,
    });
    return false;
  }
  return true;
}

function parseBillingCustomer(row: unknown): BillingCustomer | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (typeof record.stripe_customer_id !== "string") return null;
  const status = record.status;
  return {
    email: asStringOrNull(record.email),
    stripeCustomerId: record.stripe_customer_id,
    stripeSubscriptionId: asStringOrNull(record.stripe_subscription_id),
    status: isBillingStatus(status) ? status : "trialing",
    trialEnd: asStringOrNull(record.trial_end),
  };
}

function isBillingStatus(value: unknown): value is BillingStatus {
  return (
    typeof value === "string" &&
    (BILLING_STATUSES as readonly string[]).includes(value)
  );
}

function restHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function restFetch(
  config: SupabaseServiceConfig,
  pathAndQuery: string,
  init?: RequestInit,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${config.url}/rest/v1/${pathAndQuery}`, {
      ...init,
      headers: {
        ...restHeaders(config.serviceRoleKey),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[gcfieldlog] billing_customers request failed", {
      aborted,
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
