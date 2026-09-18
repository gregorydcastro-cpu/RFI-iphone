/**
 * Stub role flag used after a puller connects Procore.
 *
 * Real crew auth is later. Until then, Connect Procore stores tokens per
 * stub user and sets this cookie so puller vs viewer UI can stay in sync.
 */

export const PROCORE_LINKED_COOKIE = "gcfieldlog_procore_linked";

export type FieldRoleName = "puller" | "viewer";

export type FieldRole = {
  procoreLinked: boolean;
  role: FieldRoleName;
};

export function isPullerRole(role: string | null | undefined): boolean {
  return role === "puller";
}

export function cookieSecureFromRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function procoreLinkedCookieOptions(
  linked: boolean,
  secure: boolean,
): {
  name: string;
  value: string;
  httpOnly: boolean;
  path: string;
  sameSite: "lax";
  maxAge: number;
  secure: boolean;
} {
  return {
    name: PROCORE_LINKED_COOKIE,
    value: linked ? "1" : "",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: linked ? 60 * 60 * 24 * 30 : 0,
    secure,
  };
}
