/**
 * Stub role gate for GC Field Log.
 *
 * Auth is not real yet. Default is read-only viewer. A linked Procore
 * account (the puller) is marked after OAuth connect (cookie) or via
 * header `x-procore-linked`. Connect Procore stores tokens per stub user.
 * Invite redeem writes the stub session role; that role wins so a viewer
 * who later connects Procore stays a viewer.
 */

export const PROCORE_LINKED_COOKIE = "gcfieldlog_procore_linked";
export const PROCORE_LINKED_HEADER = "x-procore-linked";
export const STUB_SESSION_COOKIE = "gcfieldlog_stub_user";

/** Stub / invite session role. `full` is invite-minted crew (kept on the cookie). */
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

function sessionRoleFromCookieHeader(
  cookieHeader: string | null | undefined,
): FieldRoleName | null {
  const raw = readCookieValue(cookieHeader, STUB_SESSION_COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { role?: unknown };
    if (parsed.role === "puller" || parsed.role === "full" || parsed.role === "viewer") {
      return parsed.role;
    }
    return null;
  } catch {
    return null;
  }
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
      : sessionRoleFromCookieHeader(input.cookieHeader);

  // Invite / stub session role wins. A viewer who later connects Procore
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
