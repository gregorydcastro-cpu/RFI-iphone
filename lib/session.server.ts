/**
 * Server session: Supabase Auth getUser() + profiles / app_metadata role.
 */

import { redirect } from "next/navigation";
import {
  parseFieldRoleName,
  PROCORE_LINKED_HEADER,
  readFieldRole,
  type FieldRole,
} from "./auth";
import { fieldRoleFromInviteRole } from "./invites";
import { fieldRoleFromRedeemedEmail } from "./inviteStore";
import { fetchProfileRole, upsertProfile } from "./profiles";
import {
  isStubUserId,
  resolveSessionRole,
  type AppSession,
  type AuthUserLike,
} from "./session";
import { createSupabaseServerClient } from "./supabase/server";

export type { AppSession, AuthUserLike } from "./session";
export { publicSessionJson } from "./session";

export async function sessionFromAuthUser(
  user: AuthUserLike,
): Promise<AppSession | null> {
  const email =
    typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!user.id || !email.includes("@")) return null;
  if (isStubUserId(user.id)) return null;

  const profileRole = await fetchProfileRole(user.id);
  if (profileRole) {
    return { userId: user.id, email, role: profileRole };
  }

  const invited = await fieldRoleFromRedeemedEmail(email);
  const role = await resolveSessionRole(user, {
    profileRole: null,
    invitedRole: invited ? fieldRoleFromInviteRole(invited) : null,
  });

  await upsertProfile({
    id: user.id,
    email,
    role,
  });

  return { userId: user.id, email, role: parseFieldRoleName(role) };
}

export async function readAppSession(): Promise<AppSession | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return sessionFromAuthUser(data.user);
}

export async function readSession(): Promise<AppSession | null> {
  return readAppSession();
}

export async function sessionFromRequest(): Promise<AppSession | null> {
  return readAppSession();
}

export async function fieldRoleForRequest(request: Request): Promise<{
  session: AppSession | null;
  role: FieldRole;
}> {
  const session = await readAppSession();
  return {
    session,
    role: readFieldRole({
      cookieHeader: request.headers.get("cookie"),
      header: request.headers.get(PROCORE_LINKED_HEADER),
      sessionRole: session?.role ?? null,
    }),
  };
}

export async function requireAppSession(nextPath: string): Promise<AppSession> {
  const session = await readAppSession();
  if (!session) {
    const next = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
    redirect(`/?next=${encodeURIComponent(next)}`);
  }
  return session;
}
