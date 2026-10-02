import type { FieldRoleName } from "./auth";
import { procoreReconnectNeeded } from "./procoreAuthHealth";
import {
  diagnoseSupabaseServiceRoleKey,
  fetchProcoreConnectionStatus,
  isProcoreTokenStorageConfigured,
  isSupabaseServiceRoleKeyValid,
  type ProcoreConnectionStatus,
} from "./procoreConnections";
import { isProcoreOAuthConfigured } from "./procoreOAuth";
import { resolveProcoreAccess } from "./procoreToken";
import { accessTokenNeedsRefresh } from "./procoreTokenExpiry";
import type { AppSession } from "./session.server";

export type ProcoreConnectionView = {
  signedIn: boolean;
  role: FieldRoleName | null;
  email: string | null;
  userId: string | null;
  /** False when there is no row, or the refresh token can no longer sign in. */
  connected: boolean;
  /** Stored row exists, but Procore needs the same Connect flow again. */
  reconnectNeeded: boolean;
  /** Token was due for refresh and Procore did not answer. Still connected. */
  refreshDeferred: boolean;
  companyId: string | null;
  expiresAt: string | null;
  oauthConfigured: boolean;
  storageConfigured: boolean;
  storageKeyValid: boolean;
  /** Human reason when storageKeyValid is false. Never includes the key. */
  storageKeyProblem: string | null;
  connection: ProcoreConnectionStatus | null;
};

export async function getProcoreConnectionView(
  session: AppSession | null,
  options?: { probe?: boolean },
): Promise<ProcoreConnectionView> {
  const oauthConfigured = isProcoreOAuthConfigured();
  const storageConfigured = isProcoreTokenStorageConfigured();
  const storageKeyValid = isSupabaseServiceRoleKeyValid();
  const storageKeyProblem = storageKeyValid
    ? null
    : diagnoseSupabaseServiceRoleKey().message;
  if (!session) {
    return {
      signedIn: false,
      role: null,
      email: null,
      userId: null,
      connected: false,
      reconnectNeeded: false,
      refreshDeferred: false,
      companyId: null,
      expiresAt: null,
      oauthConfigured,
      storageConfigured,
      storageKeyValid,
      storageKeyProblem,
      connection: null,
    };
  }

  let connection =
    storageConfigured && storageKeyValid
      ? await fetchProcoreConnectionStatus(session.userId)
      : null;
  let refreshDeferred = false;
  let reconnectForced = false;

  if (
    options?.probe &&
    connection &&
    connection.hasRefreshToken &&
    accessTokenNeedsRefresh(connection.expiresAt)
  ) {
    const resolved = await resolveProcoreAccess(session.userId);
    if (resolved.ok || resolved.reason === "reconnect_needed") {
      connection =
        (await fetchProcoreConnectionStatus(session.userId)) ?? connection;
    }
    if (!resolved.ok && resolved.reason === "reconnect_needed") {
      reconnectForced = true;
    } else if (!resolved.ok && resolved.reason === "refresh_unavailable") {
      refreshDeferred = true;
    }
  }

  const reconnectNeeded = connection
    ? reconnectForced ||
      procoreReconnectNeeded({
        expiresAt: connection.expiresAt,
        hasRefreshToken: connection.hasRefreshToken,
      })
    : false;

  return {
    signedIn: true,
    role: session.role,
    email: session.email,
    userId: session.userId,
    connected: Boolean(connection) && !reconnectNeeded,
    reconnectNeeded,
    refreshDeferred: refreshDeferred && !reconnectNeeded,
    companyId: connection?.companyId ?? null,
    expiresAt: connection?.expiresAt ?? null,
    oauthConfigured,
    storageConfigured,
    storageKeyValid,
    storageKeyProblem,
    connection,
  };
}

export function procoreErrorMessage(reason: string | undefined): string | null {
  switch (reason) {
    case "viewer_only":
      return "View-only sessions do not connect Procore. Sign in as a puller to connect.";
    case "missing_oauth_config":
      return "Procore OAuth is not configured. Set PROCORE_CLIENT_ID and PROCORE_CLIENT_SECRET on Vercel (server-only, not NEXT_PUBLIC).";
    case "missing_code":
      return "Procore did not return an authorization code.";
    case "invalid_state":
      return "OAuth sign-in cannot be verified. Try Connect Procore again from this same site.";
    case "missing_session":
      return "Sign in to GC Field Log first, then connect Procore.";
    case "token_exchange_failed":
      return "Procore did not accept the authorization code (token service). Try Connect Procore again from this same site.";
    case "storage_unconfigured":
      return "Tokens could not be stored. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel (anon key cannot write tokens).";
    case "storage_key_invalid":
      return "The Vercel SUPABASE_SERVICE_ROLE_KEY is not the service_role secret (anon or publishable keys cannot write tokens). Paste the service_role key from Supabase → Project Settings → API for project aejevzkqvlwbmjbqdxuu (gc-field-log).";
    case "storage_write_failed":
      return "Procore token exchange succeeded, but the Supabase write failed. Check Vercel function logs and confirm SUPABASE_URL is https://aejevzkqvlwbmjbqdxuu.supabase.co.";
    case "denied":
      return "Procore access was not approved.";
    default:
      return reason ? "Could not connect Procore." : null;
  }
}
