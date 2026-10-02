import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookieSecureFromRequest } from "@/lib/auth";
import { safeProcoreReturnPath } from "@/lib/procoreAuthHealth";
import {
  buildAuthorizeUrl,
  getProcoreOAuthConfig,
  oauthCookieDomainFromRequest,
  oauthNextCookieOptions,
  procoreConnectBounceUrl,
  procoreOAuthCookies,
  resolveProcoreRedirectUriFromRequest,
} from "@/lib/procoreOAuth";
import { readAppSession } from "@/lib/session.server";

export const dynamic = "force-dynamic";

function redirectWithError(request: Request, reason: string): NextResponse {
  const url = new URL("/account", request.url);
  url.searchParams.set("procore", "error");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

/**
 * Start Procore OAuth. Signed-in pullers / full crew are sent to
 * login.procore.com / login-sandbox.procore.com with their own Procore
 * credentials. End users do not use the developer portal.
 *
 * `redirect_uri` is always the portal www callback. If this request is on
 * another host (vercel.app / apex), 302 to www `/api/procore/connect` first
 * so the state cookie is set on www before Procore authorize.
 */
export async function GET(request: Request) {
  const redirectUri = resolveProcoreRedirectUriFromRequest(request);
  const nextPath = safeProcoreReturnPath(new URL(request.url).searchParams.get("next"));
  const bounce = procoreConnectBounceUrl(request, redirectUri);
  if (bounce) {
    if (!nextPath) return NextResponse.redirect(bounce);
    const bounced = new URL(bounce);
    bounced.searchParams.set("next", nextPath);
    return NextResponse.redirect(bounced);
  }

  const session = await readAppSession();
  if (!session) {
    const login = new URL("/", request.url);
    login.searchParams.set("next", "/api/procore/connect");
    return NextResponse.redirect(login);
  }
  if (session.role !== "puller" && session.role !== "full") {
    return redirectWithError(request, "viewer_only");
  }

  const config = getProcoreOAuthConfig({ request, redirectUri });
  if (!config) {
    return redirectWithError(request, "missing_oauth_config");
  }

  const state = randomBytes(24).toString("hex");
  const secure = cookieSecureFromRequest(request);
  const response = NextResponse.redirect(buildAuthorizeUrl(config, state));
  for (const cookie of procoreOAuthCookies(
    { state, redirectUri: config.redirectUri },
    secure,
    request,
  )) {
    response.cookies.set(cookie);
  }
  response.cookies.set(
    oauthNextCookieOptions(
      nextPath,
      secure,
      oauthCookieDomainFromRequest(request),
    ),
  );
  return response;
}
