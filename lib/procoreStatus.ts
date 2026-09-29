import type { FieldRoleName } from "./auth";
import {
  diagnoseSupabaseServiceRoleKey,
  fetchProcoreConnectionStatus,
  isProcoreTokenStorageConfigured,
  isSupabaseServiceRoleKeyValid,
  type ProcoreConnectionStatus,
} from "./procoreConnections";
import { isProcoreOAuthConfigured } from "./procoreOAuth";
import type { AppSession } from "./session.server";

export type ProcoreConnectionView = {
  signedIn: boolean;
  role: FieldRoleName | null;
  email: string | null;
  userId: string | null;
  connected: boolean;
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
      companyId: null,
      expiresAt: null,
      oauthConfigured,
      storageConfigured,
      storageKeyValid,
      storageKeyProblem,
      connection: null,
    };
  }

  const connection =
    storageConfigured && storageKeyValid
      ? await fetchProcoreConnectionStatus(session.userId)
      : null;

  return {
    signedIn: true,
    role: session.role,
    email: session.email,
    userId: session.userId,
    connected: Boolean(connection),
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
