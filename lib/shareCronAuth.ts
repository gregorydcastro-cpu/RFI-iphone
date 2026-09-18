/**
 * Server-only cron secret + weekly-refresh flags.
 * Never NEXT_PUBLIC_. Kept free of Drive/PDF imports so unit tests can load it.
 */

import { timingSafeEqual } from "node:crypto";

function readSecretEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const CRON_SECRET_KEY = "CRON_SECRET";
export const SHARE_WEEKLY_PROCORE_REST_FLAG = "SHARE_WEEKLY_PROCORE_REST";
export const SHARE_WEEKLY_PDF_REDOWNLOAD_FLAG = "SHARE_WEEKLY_PDF_REDOWNLOAD";

export function readCronSecret(): string | undefined {
  return readSecretEnv(CRON_SECRET_KEY);
}

export function cronSecretConfigured(): boolean {
  return Boolean(readCronSecret());
}

function timingSafeEqualString(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function authorizeCronHeaders(headers: Headers): boolean {
  const secret = readCronSecret();
  if (!secret) return false;

  const authorization = headers.get("authorization");
  const bearer =
    authorization && /^Bearer\s+/i.test(authorization)
      ? authorization.replace(/^Bearer\s+/i, "").trim()
      : "";
  const headerSecret = headers.get("x-cron-secret")?.trim() ?? "";
  const provided = bearer || headerSecret;
  if (!provided) return false;
  return timingSafeEqualString(provided, secret);
}

export function weeklyProcoreRestEnabled(): boolean {
  return readSecretEnv(SHARE_WEEKLY_PROCORE_REST_FLAG) === "1";
}

/**
 * Explicit PDF flag: `1` force on, `0` force off, otherwise `null`
 * (caller may enable when Drive auth exists).
 */
export function weeklyPdfRedownloadFlag(): boolean | null {
  const flag = readSecretEnv(SHARE_WEEKLY_PDF_REDOWNLOAD_FLAG);
  if (flag === "0") return false;
  if (flag === "1") return true;
  return null;
}

export function procoreRestSummary(): {
  enabled: boolean;
  called: false;
  todo: true;
  flag: typeof SHARE_WEEKLY_PROCORE_REST_FLAG;
  issue: 25;
  note: string;
} {
  const enabled = weeklyProcoreRestEnabled();
  return {
    enabled,
    called: false,
    todo: true,
    flag: SHARE_WEEKLY_PROCORE_REST_FLAG,
    issue: 25,
    note: enabled
      ? "SHARE_WEEKLY_PROCORE_REST=1 is reserved. Live Procore REST is not wired on main (issue #25). This run compared catalog + room_packs only and did not call Procore."
      : "Live Procore REST is not called. Set SHARE_WEEKLY_PROCORE_REST=1 later when issue #25 lands; until then the cron uses the same Maple Point catalog + room_packs sources as Refresh all.",
  };
}
