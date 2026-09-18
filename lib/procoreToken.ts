/**
 * Server-only valid Procore access token for a stored connection.
 *
 * Access tokens last ~1.5 hours. Refresh with refresh_token before
 * expiry (2 minute skew) or after a 401. Tokens never go to the browser.
 */

import {
  fetchProcoreConnectionSecrets,
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

export async function getValidProcoreAccess(
  userId: string,
  options?: { forceRefresh?: boolean },
): Promise<ValidProcoreAccess | null> {
  const config = getProcoreOAuthConfig();
  if (!config) return null;

  const secrets = await fetchProcoreConnectionSecrets(userId);
  if (!secrets?.accessToken) return null;

  const shouldRefresh =
    Boolean(options?.forceRefresh) ||
    accessTokenNeedsRefresh(secrets.expiresAt);

  if (!shouldRefresh) {
    return { config, accessToken: secrets.accessToken, secrets, refreshed: false };
  }

  const refreshed = await refreshStoredProcoreAccess(config, secrets);
  return refreshed;
}

export async function refreshStoredProcoreAccess(
  config: ProcoreOAuthConfig,
  secrets: ProcoreConnectionSecrets,
): Promise<ValidProcoreAccess | null> {
  if (!secrets.refreshToken) return null;

  const tokens = await refreshAccessToken(config, secrets.refreshToken);
  if (!tokens) return null;

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
    config,
    accessToken: next.accessToken,
    secrets: next,
    refreshed: true,
  };
}
