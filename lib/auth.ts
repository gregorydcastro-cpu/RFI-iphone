/**
 * Stub role gate for GC Field Log.
 *
 * Auth is not real yet. Default is read-only viewer. A linked Procore
 * account (the puller) is marked after OAuth connect (cookie) or via
 * header `x-procore-linked`. Connect Procore stores tokens per stub user.
 */

export const PROCORE_LINKED_COOKIE = "gcfieldlog_procore_linked";
export const PROCORE_LINKED_HEADER = "x-procore-linked";

export type FieldRoleName = "puller" | "viewer";

export type FieldRole = {
  /** True when this session is the Procore-linked puller. */
  procoreLinked: boolean;
  role: FieldRoleName;
};

export function isPullerRole(role: string | null | undefined): boolean {
  return role === "puller";
}

/** Apex + www share this Domain so one stub login covers both hosts. */
export const PRODUCTION_COOKIE_DOMAIN = "gcfieldlog.com";

export type HttpCookieOptions = {
  name: string;
  value: string;
  httpOnly: boolean;
  path: string;
  sameSite: "lax";
  maxAge: number;
  secure: boolean;
  domain?: string;
};

/** Same-origin relative path only. Blocks protocol-relative and absolute URLs. */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string") return "/jobs";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/jobs";
  }
  if (raw.includes("://")) return "/jobs";
  return raw;
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

export function requestHostname(request: Request): string | undefined {
  try {
    const forwarded = request.headers.get("x-forwarded-host");
    const host = (forwarded ?? new URL(request.url).host)
      .split(",")[0]
      ?.trim()
      .toLowerCase();
    if (!host) return undefined;
    return host.replace(/:\d+$/, "");
  } catch {
    return undefined;
  }
}

/**
 * Host-only cookies on localhost / Vercel previews.
 * Production apex + www get Domain=gcfieldlog.com so `/share` keeps the
 * stub session after a 308 between gcfieldlog.com and www.gcfieldlog.com.
 */
export function cookieDomainFromHost(
  host: string | null | undefined,
): string | undefined {
  if (!host) return undefined;
  const hostname = host.split(",")[0]?.trim().toLowerCase().replace(/:\d+$/, "");
  if (
    hostname === PRODUCTION_COOKIE_DOMAIN ||
    hostname === `www.${PRODUCTION_COOKIE_DOMAIN}`
  ) {
    return PRODUCTION_COOKIE_DOMAIN;
  }
  return undefined;
}

export function cookieDomainFromRequest(request: Request): string | undefined {
  return cookieDomainFromHost(requestHostname(request));
}

export function serializeHttpCookie(options: HttpCookieOptions): string {
  const parts = [
    `${options.name}=${encodeURIComponent(options.value)}`,
    `Path=${options.path || "/"}`,
    `Max-Age=${options.maxAge}`,
    "SameSite=Lax",
  ];
  if (options.maxAge <= 0) {
    parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  }
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.domain) parts.push(`Domain=${options.domain}`);
  return parts.join("; ");
}

export function appendCookieHeaders(
  headers: { append(name: string, value: string): void },
  cookies: HttpCookieOptions[],
): void {
  for (const cookie of cookies) {
    headers.append("set-cookie", serializeHttpCookie(cookie));
  }
}

export function applyHttpCookies(
  response: {
    cookies: { set(options: HttpCookieOptions): unknown };
    headers: { append(name: string, value: string): void };
  },
  cookies: HttpCookieOptions[],
): void {
  if (cookies.length === 0) return;
  if (cookies.length === 1) {
    response.cookies.set(cookies[0]!);
    return;
  }
  const live =
    cookies.find((cookie) => cookie.maxAge > 0 && cookie.value) ??
    cookies[cookies.length - 1]!;
  const extras = cookies.filter((cookie) => cookie !== live);
  response.cookies.set(live);
  appendCookieHeaders(response.headers, extras);
}

/**
 * Login writes one cookie (Domain=gcfieldlog.com in production). A second
 * host-only expire in the same response can wipe the session: Chrome's
 * fetch jar often keeps a single Set-Cookie per name and the expire wins.
 * Logout still expires both the host-only leftover and the Domain cookie.
 */
export function cookieWritesForDomain(
  cookie: HttpCookieOptions,
  domain: string | undefined,
): HttpCookieOptions[] {
  if (!domain) return [cookie];
  const scoped: HttpCookieOptions = { ...cookie, domain };
  if (cookie.maxAge > 0 && cookie.value) {
    return [scoped];
  }
  const hostOnly: HttpCookieOptions = { ...cookie };
  delete hostOnly.domain;
  return [hostOnly, scoped];
}

export function procoreLinkedCookieOptions(
  linked: boolean,
  secure: boolean,
  domain?: string,
): HttpCookieOptions {
  return {
    name: PROCORE_LINKED_COOKIE,
    value: linked ? "1" : "",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: linked ? 60 * 60 * 24 * 30 : 0,
    secure,
    ...(domain ? { domain } : {}),
  };
}

export function procoreLinkedCookieWrites(
  linked: boolean,
  secure: boolean,
  domain?: string,
): HttpCookieOptions[] {
  return cookieWritesForDomain(
    procoreLinkedCookieOptions(linked, secure, domain),
    domain,
  );
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
