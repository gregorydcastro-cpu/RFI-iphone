/**
 * Stub role gate for GC Field Log.
 *
 * Auth is not real yet. Default is read-only viewer. A linked Procore
 * account (the puller) is marked with cookie or header `procoreLinked`.
 */

export const PROCORE_LINKED_COOKIE = "gcfieldlog_procore_linked";
export const PROCORE_LINKED_HEADER = "x-procore-linked";

export type FieldRoleName = "puller" | "viewer";

export type FieldRole = {
  /** True when this session is the Procore-linked puller. */
  procoreLinked: boolean;
  role: FieldRoleName;
};

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
}): FieldRole {
  const fromHeader = isTruthyFlag(input.header);
  const fromCookie = isTruthyFlag(
    input.cookieValue ??
      readCookieValue(input.cookieHeader, PROCORE_LINKED_COOKIE),
  );
  const procoreLinked = fromHeader || fromCookie;
  return {
    procoreLinked,
    role: procoreLinked ? "puller" : "viewer",
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
