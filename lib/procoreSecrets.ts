/**
 * Server-only Procore OAuth credentials.
 *
 * Vercel: PROCORE_CLIENT_ID / PROCORE_CLIENT_SECRET (never NEXT_PUBLIC_).
 * Ops copy from the shared box files — never commit those values.
 */

import { readFileSync } from "node:fs";
import { readEnvAlias } from "./env";

/** Greg’s Procore developer app allowlist (exact). */
export const DEFAULT_PROCORE_REDIRECT_URI =
  "https://www.gcfieldlog.com/api/procore/callback";

const BOX_CLIENT_ID_PATH = "/home/box/.secrets/procore_client_id";
const BOX_CLIENT_SECRET_PATH = "/home/box/.secrets/procore_client_secret";

export function readProcoreClientId(): string | undefined {
  return (
    readEnvAlias("PROCORE_CLIENT_ID", "procore_client_id") ??
    readSecretFile(BOX_CLIENT_ID_PATH)
  );
}

export function readProcoreClientSecret(): string | undefined {
  return (
    readEnvAlias("PROCORE_CLIENT_SECRET", "procore_client_secret") ??
    readSecretFile(BOX_CLIENT_SECRET_PATH)
  );
}

export function readProcoreRedirectUri(): string {
  return (
    readEnvAlias("PROCORE_REDIRECT_URI", "procore_redirect_uri") ??
    DEFAULT_PROCORE_REDIRECT_URI
  );
}

function readSecretFile(path: string): string | undefined {
  try {
    const value = readFileSync(path, "utf8").trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}
