import {
  fetchProcoreConnectionStatus,
  isProcoreTokenStorageConfigured,
  type ProcoreConnectionStatus,
} from "./procoreConnections";
import { isProcoreOAuthConfigured } from "./procoreOAuth";
import type { StubSession } from "./stubSession";

export type ProcoreConnectionView = {
  signedIn: boolean;
  role: "puller" | "viewer" | null;
  email: string | null;
  userId: string | null;
  connected: boolean;
  companyId: string | null;
  expiresAt: string | null;
  oauthConfigured: boolean;
  storageConfigured: boolean;
  connection: ProcoreConnectionStatus | null;
};

export async function getProcoreConnectionView(
  session: StubSession | null,
): Promise<ProcoreConnectionView> {
  const oauthConfigured = isProcoreOAuthConfigured();
  const storageConfigured = isProcoreTokenStorageConfigured();
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
      connection: null,
    };
  }

  const connection = storageConfigured
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
    connection,
  };
}

export function procoreErrorMessage(reason: string | undefined): string | null {
  switch (reason) {
    case "viewer_only":
      return "View-only sessions do not connect Procore. Sign in as a puller to connect.";
    case "missing_oauth_config":
      return "Procore OAuth is not configured. Set procore_client_id and procore_client_secret on the server.";
    case "missing_code":
      return "Procore did not return an authorization code.";
    case "invalid_state":
      return "Procore sign-in could not be verified. Try Connect Procore again.";
    case "missing_session":
      return "Sign in to GC Field Log first, then connect Procore.";
    case "token_exchange_failed":
      return "Procore did not accept the authorization code. Try connecting again.";
    case "storage_unconfigured":
      return "Tokens could not be stored. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (anon key cannot write tokens).";
    case "denied":
      return "Procore access was not approved.";
    default:
      return reason ? "Could not connect Procore." : null;
  }
}
