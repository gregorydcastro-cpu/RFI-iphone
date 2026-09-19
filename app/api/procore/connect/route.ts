import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookieSecureFromRequest } from "@/lib/auth";
import {
  buildAuthorizeUrl,
  getProcoreOAuthConfig,
  oauthStateCookieOptions,
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
 */
export async function GET(request: Request) {
  const session = await readAppSession();
  if (!session) {
    const login = new URL("/", request.url);
    login.searchParams.set("next", "/api/procore/connect");
    return NextResponse.redirect(login);
  }
  if (session.role !== "puller" && session.role !== "full") {
    return redirectWithError(request, "viewer_only");
  }

  const config = getProcoreOAuthConfig();
  if (!config) {
    return redirectWithError(request, "missing_oauth_config");
  }

  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(buildAuthorizeUrl(config, state));
  response.cookies.set(
    oauthStateCookieOptions(state, cookieSecureFromRequest(request)),
  );
  return response;
}
