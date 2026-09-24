/**
 * Server-only Google Drive credentials for live sheet PDFs.
 * Never NEXT_PUBLIC_. Never log the JSON or private key.
 *
 * Preferred Vercel key: GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
 * Alternate: GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY
 * Optional public-file fallback: GOOGLE_DRIVE_API_KEY
 */

import { createSign } from "node:crypto";
import {
  normalizePrivateKey,
  parseDriveServiceAccountJson,
  type DriveServiceAccount,
} from "./driveCredentials.ts";
import { readEnvAlias } from "./env.ts";
import {
  DriveTokenError,
  DRIVE_AUTH_MISSING_MESSAGE,
  mapDriveTokenStatus,
} from "./sheetPdfErrors.ts";
import {
  fetchWithBoundedRetry,
  SHEET_PDF_RETRY_ATTEMPTS,
  SHEET_PDF_TOKEN_TIMEOUT_MS,
} from "./sheetPdfFetch.ts";

export { DRIVE_AUTH_MISSING_MESSAGE };

export const GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_KEY =
  "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON" as const;
export const GOOGLE_CLIENT_EMAIL_KEY = "GOOGLE_CLIENT_EMAIL" as const;
export const GOOGLE_PRIVATE_KEY_KEY = "GOOGLE_PRIVATE_KEY" as const;
export const GOOGLE_DRIVE_API_KEY_KEY = "GOOGLE_DRIVE_API_KEY" as const;
export const GOOGLE_DRIVE_FOLDER_ID_KEY = "GOOGLE_DRIVE_FOLDER_ID" as const;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export type { DriveServiceAccount };

export type GoogleDriveAuth =
  | { kind: "service_account"; account: DriveServiceAccount }
  | { kind: "api_key"; apiKey: string };

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
  clientEmail: string;
};

let cachedToken: CachedToken | null = null;

export function readDriveServiceAccount(): DriveServiceAccount | null {
  const json = readEnvAlias(
    GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_KEY,
    "GOOGLE_SERVICE_ACCOUNT_JSON",
    "google_drive_service_account_json",
  );
  if (json) {
    const fromJson = parseDriveServiceAccountJson(json);
    if (fromJson) return fromJson;
  }
  const clientEmail = readEnvAlias(
    GOOGLE_CLIENT_EMAIL_KEY,
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_DRIVE_CLIENT_EMAIL",
    "google_client_email",
  );
  const privateKeyRaw = readEnvAlias(
    GOOGLE_PRIVATE_KEY_KEY,
    "GOOGLE_DRIVE_PRIVATE_KEY",
    "google_private_key",
  );
  if (!clientEmail || !privateKeyRaw) return null;
  const privateKey = normalizePrivateKey(privateKeyRaw);
  if (!privateKey.includes("BEGIN")) return null;
  return { clientEmail, privateKey };
}

export function readDriveApiKey(): string | undefined {
  return readEnvAlias(
    GOOGLE_DRIVE_API_KEY_KEY,
    "GOOGLE_API_KEY",
    "google_drive_api_key",
  );
}

export function readGoogleDriveAuth(): GoogleDriveAuth | null {
  const account = readDriveServiceAccount();
  if (account) return { kind: "service_account", account };
  const apiKey = readDriveApiKey();
  if (apiKey) return { kind: "api_key", apiKey };
  return null;
}

export function googleDriveAuthConfigured(): boolean {
  return readGoogleDriveAuth() !== null;
}

function signServiceAccountJwt(account: DriveServiceAccount): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({
      iss: account.clientEmail,
      scope: DRIVE_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(account.privateKey, "base64url");
  return `${unsigned}.${signature}`;
}

type TokenFetchOptions = {
  fetchImpl?: (input: string, init: RequestInit) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  attempts?: number;
};

export async function getDriveAccessToken(
  account: DriveServiceAccount,
  options?: TokenFetchOptions,
): Promise<string> {
  const now = Date.now();
  if (
    cachedToken &&
    cachedToken.clientEmail === account.clientEmail &&
    cachedToken.expiresAtMs - 60_000 > now
  ) {
    return cachedToken.accessToken;
  }

  const assertion = signServiceAccountJwt(account);
  const fetched = await fetchWithBoundedRetry(
    () => ({
      url: TOKEN_URL,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }),
        cache: "no-store",
        redirect: "manual",
      },
    }),
    {
      fetchImpl: options?.fetchImpl,
      sleep: options?.sleep,
      timeoutMs: options?.timeoutMs ?? SHEET_PDF_TOKEN_TIMEOUT_MS,
      attempts: options?.attempts ?? SHEET_PDF_RETRY_ATTEMPTS,
    },
  );
  if (!fetched.ok) {
    throw new DriveTokenError(
      fetched.kind === "timeout" ? "timeout" : "upstream_failed",
    );
  }

  const response = fetched.response;
  if (response.status >= 300 && response.status < 400) {
    throw new DriveTokenError("upstream_failed");
  }
  const json: unknown = await response.json().catch(() => null);
  const rec =
    json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  const accessToken =
    typeof rec?.access_token === "string" ? rec.access_token : "";
  const expiresIn =
    typeof rec?.expires_in === "number" ? rec.expires_in : 3600;
  if (!response.ok || !accessToken) {
    throw new DriveTokenError(mapDriveTokenStatus(response.status).code);
  }
  cachedToken = {
    accessToken,
    expiresAtMs: now + expiresIn * 1000,
    clientEmail: account.clientEmail,
  };
  return accessToken;
}

/** Test helper — do not call from production paths. */
export function resetDriveTokenCache(): void {
  cachedToken = null;
}
