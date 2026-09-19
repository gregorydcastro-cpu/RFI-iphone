import { NextResponse } from "next/server";
import { cookieSecureFromRequest, procoreLinkedCookieOptions } from "@/lib/auth";
import { fieldRoleFromInviteRole, normalizeInviteeEmail } from "@/lib/invites";
import { redeemInvite } from "@/lib/inviteStore";
import { applyProfileRole } from "@/lib/profiles";
import { sessionFromAuthUser } from "@/lib/session.server";
import { expireStubSessionCookie } from "@/lib/stubSession";
import { createSupabaseRouteClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

type Props = {
  params: Promise<{ token: string }>;
};

type RedeemBody = {
  email?: unknown;
  password?: unknown;
  mode?: unknown;
};

function asPassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.length > 0 ? value : null;
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

/**
 * Single-use redeem. Requires a real Supabase user. Writes the baked invite
 * role onto public.profiles + app_metadata (`viewer` | `full` — `full` is
 * not rewritten to puller). Does not mark Procore linked.
 */
export async function POST(request: Request, { params }: Props) {
  const { token } = await params;
  const trimmed = token?.trim() ?? "";
  if (!trimmed) {
    return json({ ok: false, status: "not_found", error: "token is required" }, 400);
  }

  let body: RedeemBody;
  try {
    body = (await request.json()) as RedeemBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const email = normalizeInviteeEmail(body.email);
  if (!email) {
    return json({ ok: false, error: "email is required" }, 400);
  }

  const existing = await createSupabaseServerClient();
  let user = existing ? (await existing.auth.getUser()).data.user : null;

  const scratch = NextResponse.next();
  const routeClient = createSupabaseRouteClient(request, scratch);
  let tokens: { access_token: string; refresh_token: string } | null = null;

  if (!user && routeClient && body.mode === "otp") {
    const origin = appOrigin(request);
    const { error } = await routeClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/invite/${encodeURIComponent(trimmed)}`,
        shouldCreateUser: true,
      },
    });
    if (error) {
      return json({ ok: false, error: error.message || "Could not send a magic link." }, 400);
    }
    return json({
      ok: true,
      needsEmailConfirm: true,
      email,
      stub: false,
    });
  }

  if (!user && routeClient) {
    const password = asPassword(body.password);
    if (!password) {
      return json(
        {
          ok: false,
          error: "Sign in first, or send email and password to accept this invite.",
        },
        401,
      );
    }
    const mode = body.mode === "signup" ? "signup" : "signin";
    if (mode === "signup") {
      const origin = appOrigin(request);
      const { data, error } = await routeClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=/invite/${encodeURIComponent(trimmed)}`,
        },
      });
      if (error) {
        return json({ ok: false, error: error.message || "Could not create an account." }, 400);
      }
      if (!data.session || !data.user) {
        return json({
          ok: true,
          needsEmailConfirm: true,
          email,
          stub: false,
        });
      }
      user = data.user;
      tokens = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      };
    } else {
      const { data, error } = await routeClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.user || !data.session) {
        return json(
          { ok: false, error: error?.message || "Email or password is incorrect." },
          401,
        );
      }
      user = data.user;
      tokens = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      };
    }
  }

  if (!user) {
    return json({ ok: false, error: "Sign in first to accept this invite." }, 401);
  }

  const sessionEmail = (user.email ?? "").trim().toLowerCase();
  if (sessionEmail && sessionEmail !== email) {
    return json(
      {
        ok: false,
        status: "email_mismatch",
        error: "Sign in with the invite email to accept this link.",
      },
      403,
    );
  }

  const result = await redeemInvite({ token: trimmed, email });
  if (!result.ok) {
    const status =
      result.status === "not_found"
        ? 404
        : result.status === "email_mismatch"
          ? 403
          : 409;
    const message =
      result.status === "expired"
        ? "This invite has expired."
        : result.status === "used"
          ? "This invite has already been used."
          : result.status === "email_mismatch"
            ? "This invite is for a different email."
            : "Invite not found.";
    return json({ ok: false, status: result.status, error: message }, status);
  }

  const role = fieldRoleFromInviteRole(result.row.role);
  await applyProfileRole({
    userId: user.id,
    email,
    role,
  });
  const session = await sessionFromAuthUser({
    ...user,
    email,
    app_metadata: { ...(user.app_metadata ?? {}), role },
  });

  const response = NextResponse.json(
    {
      ok: true,
      status: "redeemed",
      userId: user.id,
      email,
      role: session?.role ?? role,
      invite_role: result.row.role,
      expires_at: result.row.expires_at,
      used_at: result.row.used_at,
      storage: result.storage,
      single_use: true,
      stub: false,
    },
    { headers: NO_STORE },
  );
  const secure = cookieSecureFromRequest(request);
  response.cookies.set(expireStubSessionCookie(secure));
  response.cookies.set(procoreLinkedCookieOptions(false, secure));
  if (tokens) {
    const live = createSupabaseRouteClient(request, response);
    if (live) await live.auth.setSession(tokens);
  }
  return response;
}
