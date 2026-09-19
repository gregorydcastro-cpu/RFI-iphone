/**
 * Field role gate for GC Field Log.
 *
 * Session is Supabase Auth (auth.uid()). Role comes from profiles /
 * app_metadata / invite redeem — never from a stub cookie.
 * A linked Procore account is marked after OAuth (cookie) or via
 * header `x-procore-linked`. Invite role wins so a viewer who later
 * connects Procore stays a viewer.
 */

/** Leftover cookie name only — expired in proxy / logout. Not a login. */
export const STUB_SESSION_COOKIE = "gcfieldlog_stub_user";
export const PROCORE_LINKED_COOKIE = "gcfieldlog_procore_linked";
export const PROCORE_LINKED_HEADER = "x-procore-linked";

/** Invite / account role. `full` is invite-minted crew (stays `full`). */
export type FieldRoleName = "puller" | "full" | "viewer";

export function parseFieldRoleName(value: unknown): FieldRoleName {
  if (value === "puller" || value === "full" || value === "viewer") return value;
  return "viewer";
}

export type FieldRole = {
  /** True when this session is the Procore-linked puller. */
  procoreLinked: boolean;
  role: FieldRoleName;
};

export function isPullerRole(role: string | null | undefined): boolean {
  return role === "puller" || role === "full";
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

function isTruthyFlag(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "puller"
  );
}

export function readCookieValue(
  cookieHeader: string | null | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return trimmed.slice(eq + 1);
    }
  }
  return undefined;
}

export function readFieldRole(input: {
  cookieHeader?: string | null;
  cookieValue?: string | null;
  header?: string | null;
  sessionRole?: FieldRoleName | null;
}): FieldRole {
  const fromHeader = isTruthyFlag(input.header);
  const fromCookie = isTruthyFlag(
    input.cookieValue ??
      readCookieValue(input.cookieHeader, PROCORE_LINKED_COOKIE),
  );
  const linkedFlag = fromHeader || fromCookie;
  const sessionRole =
    input.sessionRole === "puller" ||
    input.sessionRole === "full" ||
    input.sessionRole === "viewer"
      ? input.sessionRole
      : null;

  // Invite / account role wins. A viewer who later connects Procore
  // stays a viewer — the linked cookie must not upgrade them to puller.
  // `full` stays `full` after Connect Procore (not rewritten to puller).
  if (sessionRole === "viewer") {
    return { procoreLinked: false, role: "viewer" };
  }
  if (sessionRole === "full") {
    return { procoreLinked: linkedFlag, role: "full" };
  }
  if (sessionRole === "puller") {
    return { procoreLinked: linkedFlag, role: "puller" };
  }
  return {
    procoreLinked: linkedFlag,
    role: linkedFlag ? "puller" : "viewer",
  };
}

export function readFieldRoleFromRequest(request: Request): FieldRole {
  return readFieldRole({
    cookieHeader: request.headers.get("cookie"),
    header: request.headers.get(PROCORE_LINKED_HEADER),
  });
}

export function procoreLinkedCookie(linked: boolean): string {
  if (linked) {
    return `${PROCORE_LINKED_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=2592000`;
  }
  return `${PROCORE_LINKED_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
}
