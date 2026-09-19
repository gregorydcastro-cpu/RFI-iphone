import { NextResponse } from "next/server";
import { cookieSecureFromRequest, procoreLinkedCookieOptions } from "@/lib/auth";
import {
  deleteProcoreConnection,
  fetchProcoreConnectionSecrets,
} from "@/lib/procoreConnections";
import { getProcoreOAuthConfig, revokeAccessToken } from "@/lib/procoreOAuth";
import { readAppSession } from "@/lib/session.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await readAppSession();
  if (!session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const secrets = await fetchProcoreConnectionSecrets(session.userId);
  const config = getProcoreOAuthConfig();
  if (secrets && config) {
    await revokeAccessToken(config, secrets.accessToken);
  }
  await deleteProcoreConnection(session.userId);

  const secure = cookieSecureFromRequest(request);
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    const response = NextResponse.json({ ok: true, connected: false });
    response.cookies.set(procoreLinkedCookieOptions(false, secure));
    return response;
  }

  const url = new URL("/account", request.url);
  url.searchParams.set("procore", "disconnected");
  const response = NextResponse.redirect(url);
  response.cookies.set(procoreLinkedCookieOptions(false, secure));
  return response;
}
