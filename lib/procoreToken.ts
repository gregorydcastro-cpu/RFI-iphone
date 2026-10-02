/**
 * Server-only valid Procore access token for a stored connection.
 *
 * Access tokens last ~1.5 hours. Refresh with refresh_token before
 * expiry (2 minute skew) or after a 401. A rejected refresh marks the
 * row for reconnect and does not keep using the dead access token.
 * Tokens never go to the browser.
 */

import {
  fetchProcoreConnectionSecrets,
  markProcoreReconnectNeeded,
  upsertProcoreConnection,
  type ProcoreConnectionSecrets,
} from "./procoreConnections";
import {
  expiresAtFromToken,
  getProcoreOAuthConfig,
  refreshAccessToken,
  type ProcoreOAuthConfig,
} from "./procoreOAuth";
import {
  ACCESS_TOKEN_REFRESH_SKEW_MS,
  accessTokenNeedsRefresh,
} from "./procoreTokenExpiry";

export { ACCESS_TOKEN_REFRESH_SKEW_MS, accessTokenNeedsRefresh };

export type ValidProcoreAccess = {
  config: ProcoreOAuthConfig;
  accessToken: string;
  secrets: ProcoreConnectionSecrets;
  refreshed: boolean;
};

export type ProcoreAccessFailure =
  | "missing_oauth"
  | "missing_tokens"
  | "reconnect_needed"
  | "refresh_unavailable";

export type ProcoreAccessResult =
  | { ok: true; access: ValidProcoreAccess }
  | { ok: false; reason: ProcoreAccessFailure };

export type StoredRefreshResult =
  | { ok: true; access: ValidProcoreAccess }
  | { ok: false; reason: "reconnect_needed" | "refresh_unavailable" };

export async function getValidProcoreAccess(
  userId: string,
  options?: { forceRefresh?: boolean },
): Promise<ValidProcoreAccess | null> {
  const resolved = await resolveProcoreAccess(userId, options);
  return resolved.ok ? resolved.access : null;
}

export async function resolveProcoreAccess(
  userId: string,
  options?: { forceRefresh?: boolean },
): Promise<ProcoreAccessResult> {
  const config = getProcoreOAuthConfig();
  if (!config) return { ok: false, reason: "missing_oauth" };

  const secrets = await fetchProcoreConnectionSecrets(userId);
  if (!secrets?.accessToken) return { ok: false, reason: "missing_tokens" };

  const shouldRefresh =
    Boolean(options?.forceRefresh) ||
    accessTokenNeedsRefresh(secrets.expiresAt);

  if (!shouldRefresh) {
    return {
      ok: true,
      access: { config, accessToken: secrets.accessToken, secrets, refreshed: false },
    };
  }

  if (!secrets.refreshToken) {
    await markProcoreReconnectNeeded(userId);
    return { ok: false, reason: "reconnect_needed" };
  }

  const refreshed = await refreshStoredProcoreAccess(config, secrets);
  if (!refreshed.ok) {
    return {
      ok: false,
      reason:
        refreshed.reason === "reconnect_needed"
          ? "reconnect_needed"
          : "refresh_unavailable",
    };
  }
  return { ok: true, access: refreshed.access };
}

export async function refreshStoredProcoreAccess(
  config: ProcoreOAuthConfig,
  secrets: ProcoreConnectionSecrets,
): Promise<StoredRefreshResult> {
  if (!secrets.refreshToken) {
    await markProcoreReconnectNeeded(secrets.userId);
    return { ok: false, reason: "reconnect_needed" };
  }

  const grant = await refreshAccessToken(config, secrets.refreshToken);
  if (!grant.ok) {
    if (grant.reason === "rejected") {
      await markProcoreReconnectNeeded(secrets.userId);
      return { ok: false, reason: "reconnect_needed" };
    }
    return { ok: false, reason: "refresh_unavailable" };
  }

  const tokens = grant.token;
  const next: ProcoreConnectionSecrets = {
    ...secrets,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? secrets.refreshToken,
    expiresAt: expiresAtFromToken(tokens),
  };

  if (secrets.email) {
    await upsertProcoreConnection({
      userId: secrets.userId,
      email: secrets.email,
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
      expiresAt: next.expiresAt,
      companyId: secrets.companyId,
      procoreUserId: secrets.procoreUserId,
    });
  }

  return {
    ok: true,
    access: {
      config,
      accessToken: next.accessToken,
      secrets: next,
      refreshed: true,
    },
  };
}
