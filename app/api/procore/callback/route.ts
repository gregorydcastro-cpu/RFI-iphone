import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieSecureFromRequest, procoreLinkedCookieOptions } from "@/lib/auth";
import {
  getSupabaseServiceConfig,
  jwtRoleClaim,
  upsertProcoreConnection,
} from "@/lib/procoreConnections";
import {
  PROCORE_OAUTH_REDIRECT_COOKIE,
  PROCORE_OAUTH_STATE_COOKIE,
  exchangeAuthorizationCode,
  expiresAtFromToken,
  fetchProcoreAccount,
  getProcoreOAuthConfig,
  procoreOAuthCookies,
  redirectUriForTokenExchange,
} from "@/lib/procoreOAuth";
import { readAppSession } from "@/lib/session.server";

export const dynamic = "force-dynamic";

function redirectAccount(
  request: Request,
  params: Record<string, string>,
): NextResponse {
  const url = new URL("/account", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

function clearOAuthCookies(
  response: NextResponse,
  secure: boolean,
  request: Request,
) {
  for (const cookie of procoreOAuthCookies(null, secure, request)) {
    response.cookies.set(cookie);
  }
}

/**
 * Procore OAuth callback. Exchanges `code` for tokens and stores them
 * per auth.uid(). Tokens are never returned to the browser.
 * Token `redirect_uri` is the portal www callback (same string as authorize).
 */
export async function GET(request: Request) {
  const secure = cookieSecureFromRequest(request);
  const url = new URL(request.url);
  const errorParam = url.searchParams.get("error");
  if (errorParam) {
    return redirectAccount(request, {
      procore: "error",
      reason: "denied",
    });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return redirectAccount(request, {
      procore: "error",
      reason: "missing_code",
    });
  }

  const jar = await cookies();
  const expectedState = jar.get(PROCORE_OAUTH_STATE_COOKIE)?.value;
  if (!expectedState || expectedState !== state) {
    return redirectAccount(request, {
      procore: "error",
      reason: "invalid_state",
    });
  }

  const session = await readAppSession();
  if (!session) {
    const login = new URL("/", request.url);
    login.searchParams.set("next", "/account");
    login.searchParams.set("procore", "error");
    login.searchParams.set("reason", "missing_session");
    const response = NextResponse.redirect(login);
    clearOAuthCookies(response, secure, request);
    return response;
  }

  const storedRedirect = jar.get(PROCORE_OAUTH_REDIRECT_COOKIE)?.value;
  const config = getProcoreOAuthConfig({
    request,
    redirectUri: redirectUriForTokenExchange(storedRedirect, request),
  });
  if (!config) {
    const response = redirectAccount(request, {
      procore: "error",
      reason: "missing_oauth_config",
    });
    clearOAuthCookies(response, secure, request);
    return response;
  }

  const service = getSupabaseServiceConfig();
  if (!service) {
    const response = redirectAccount(request, {
      procore: "error",
      reason: "storage_unconfigured",
    });
    clearOAuthCookies(response, secure, request);
    return response;
  }
  const jwtRole = jwtRoleClaim(service.serviceRoleKey);
  if (jwtRole !== "service_role") {
    console.error(
      "[gcfieldlog] SUPABASE_SERVICE_ROLE_KEY JWT is not service_role",
      { jwtRole },
    );
    const response = redirectAccount(request, {
      procore: "error",
      reason: "storage_key_invalid",
    });
    clearOAuthCookies(response, secure, request);
    return response;
  }

  const tokens = await exchangeAuthorizationCode(config, code);
  if (!tokens) {
    const response = redirectAccount(request, {
      procore: "error",
      reason: "token_exchange_failed",
    });
    clearOAuthCookies(response, secure, request);
    return response;
  }

  const account = await fetchProcoreAccount(config, tokens.access_token);
  const stored = await upsertProcoreConnection({
    userId: session.userId,
    email: session.email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: expiresAtFromToken(tokens),
    companyId: account.lastCompanyId,
    procoreUserId: account.procoreUserId,
  });

  if (!stored) {
    const response = redirectAccount(request, {
      procore: "error",
      reason: "storage_write_failed",
    });
    clearOAuthCookies(response, secure, request);
    return response;
  }

  const response = redirectAccount(request, { procore: "connected" });
  clearOAuthCookies(response, secure, request);
  response.cookies.set(procoreLinkedCookieOptions(true, secure));
  return response;
}
