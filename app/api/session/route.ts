import { NextResponse } from "next/server";
import { cookieSecureFromRequest, procoreLinkedCookieOptions } from "@/lib/auth";
import { applyProfileRole } from "@/lib/profiles";
import {
  publicSessionJson,
  sessionFromAuthUser,
  type AppSession,
} from "@/lib/session.server";
import { expireStubSessionCookie } from "@/lib/stubSession";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import {
  createSupabaseRouteClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

type SessionBody = {
  email?: unknown;
  password?: unknown;
  mode?: unknown;
};

type AuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

function asEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.includes("@") ? email : null;
}

function asPassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.length > 0 ? value : null;
}

function parseMode(value: unknown): "signin" | "signup" | "otp" {
  if (value === "signup" || value === "otp") return value;
  return "signin";
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

function appOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded) {
    return `${proto || url.protocol.replace(":", "")}://${forwarded.split(",")[0]?.trim()}`;
  }
  return url.origin;
}

function attachLegacyClears(request: Request, response: NextResponse) {
  const secure = cookieSecureFromRequest(request);
  response.cookies.set(expireStubSessionCookie(secure));
  response.cookies.set(procoreLinkedCookieOptions(false, secure));
}

async function persistSessionCookies(
  request: Request,
  response: NextResponse,
  tokens: { access_token: string; refresh_token: string },
) {
  const supabase = createSupabaseRouteClient(request, response);
  if (!supabase) return;
  await supabase.auth.setSession(tokens);
  attachLegacyClears(request, response);
}

/**
 * Real Supabase Auth. GET returns the current auth.uid() session.
 * POST signs in, signs up, or sends a magic link. Password is checked.
 * Role is not chosen here — it comes from profiles / app_metadata / invite.
 */
export async function GET() {
  if (!isSupabaseAuthConfigured()) {
    return json({ ok: false, error: "auth_unconfigured", stub: false }, 503);
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return json({ ok: false, error: "auth_unconfigured", stub: false }, 503);
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return json({ ok: false, error: "Sign in first.", stub: false }, 401);
  }
  const session = await sessionFromAuthUser(data.user);
  if (!session) {
    return json({ ok: false, error: "Sign in first.", stub: false }, 401);
  }
  return json(publicSessionJson(session));
}

export async function POST(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return json(
      {
        ok: false,
        error:
          "Supabase Auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY (server-only).",
        stub: false,
      },
      503,
    );
  }

  let body: SessionBody;
  try {
    body = (await request.json()) as SessionBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON", stub: false }, 400);
  }

  const email = asEmail(body.email);
  if (!email) {
    return json({ ok: false, error: "email is required", stub: false }, 400);
  }

  const mode = parseMode(body.mode);
  const scratch = NextResponse.next();
  const supabase = createSupabaseRouteClient(request, scratch);
  if (!supabase) {
    return json({ ok: false, error: "auth_unconfigured", stub: false }, 503);
  }

  if (mode === "otp") {
    const origin = appOrigin(request);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/jobs`,
        shouldCreateUser: true,
      },
    });
    if (error) {
      return json(
        {
          ok: false,
          error: error.message || "Could not send a magic link.",
          stub: false,
        },
        400,
      );
    }
    const response = json({
      ok: true,
      mode: "otp",
      email,
      needsEmailConfirm: true,
      stub: false,
    });
    attachLegacyClears(request, response);
    return response;
  }

  const password = asPassword(body.password);
  if (!password) {
    return json({ ok: false, error: "password is required", stub: false }, 400);
  }

  if (mode === "signup") {
    const origin = appOrigin(request);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/jobs`,
      },
    });
    if (error) {
      return json(
        {
          ok: false,
          error: error.message || "Could not create an account.",
          stub: false,
        },
        400,
      );
    }
    if (!data.session || !data.user) {
      const response = json({
        ok: true,
        mode: "signup",
        email,
        needsEmailConfirm: true,
        stub: false,
      });
      attachLegacyClears(request, response);
      return response;
    }
    return respondWithSession(request, data.user, data.session);
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user || !data.session) {
    return json(
      {
        ok: false,
        error: error?.message || "Email or password is incorrect.",
        stub: false,
      },
      401,
    );
  }

  return respondWithSession(request, data.user, data.session);
}

async function respondWithSession(
  request: Request,
  user: AuthUser,
  tokens: { access_token: string; refresh_token: string },
) {
  const session = await finishAuthUser(user);
  if (!session) {
    return json({ ok: false, error: "Could not start a session.", stub: false }, 500);
  }
  const response = json(publicSessionJson(session));
  await persistSessionCookies(request, response, tokens);
  return response;
}

async function finishAuthUser(user: AuthUser): Promise<AppSession | null> {
  const session = await sessionFromAuthUser(user);
  if (!session) return null;
  await applyProfileRole({
    userId: session.userId,
    email: session.email,
    role: session.role,
  });
  return session;
}
