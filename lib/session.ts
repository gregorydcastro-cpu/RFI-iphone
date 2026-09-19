/**
 * Field session types and role mapping.
 * userId is auth.uid() (uuid text). Never authorize from user_metadata.
 */

import type { FieldRoleName } from "./auth";

export type AppSession = {
  userId: string;
  email: string;
  role: FieldRoleName;
};

export type AuthUserLike = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

/** Role from app_metadata or profiles only — never user_metadata (user-editable). */
export function optionalFieldRole(value: unknown): FieldRoleName | null {
  if (value === "puller" || value === "full" || value === "viewer") return value;
  return null;
}

export function roleFromAppMetadata(
  metadata: Record<string, unknown> | null | undefined,
): FieldRoleName | null {
  return optionalFieldRole(metadata?.role);
}

export function isAuthUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    userId,
  );
}

export function isStubUserId(userId: string | null | undefined): boolean {
  return typeof userId === "string" && userId.startsWith("stub:");
}

export async function resolveSessionRole(
  user: AuthUserLike,
  deps: {
    profileRole?: FieldRoleName | null;
    invitedRole?: FieldRoleName | null;
  } = {},
): Promise<FieldRoleName> {
  if (deps.profileRole) return deps.profileRole;
  const fromApp = roleFromAppMetadata(user.app_metadata);
  if (fromApp) return fromApp;
  if (deps.invitedRole) return deps.invitedRole;
  return "puller";
}

export function publicSessionJson(session: AppSession) {
  return {
    ok: true as const,
    userId: session.userId,
    email: session.email,
    role: session.role,
    stub: false as const,
  };
}
