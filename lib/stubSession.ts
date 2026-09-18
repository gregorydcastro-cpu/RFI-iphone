import { createHash } from "node:crypto";
import type { FieldRoleName, HttpCookieOptions } from "./auth";

export const STUB_SESSION_COOKIE = "gcfieldlog_stub_user";

export type StubSession = {
  userId: string;
  email: string;
  role: FieldRoleName;
};

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function stubUserIdFromEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const digest = createHash("sha256").update(normalized).digest("hex").slice(0, 32);
  return `stub:${digest}`;
}

function sessionFromParsed(parsed: Partial<StubSession>): StubSession | null {
  const email =
    typeof parsed.email === "string" ? parsed.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) return null;
  const role: FieldRoleName = parsed.role === "puller" ? "puller" : "viewer";
  const userId =
    typeof parsed.userId === "string" && parsed.userId.startsWith("stub:")
      ? parsed.userId
      : stubUserIdFromEmail(email);
  return { userId, email, role };
}

export function parseStubSession(raw: string | undefined | null): StubSession | null {
  if (!raw) return null;
  const candidates = [raw];
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded !== raw) candidates.push(decoded);
  } catch {
    /* keep raw */
  }
  for (const candidate of candidates) {
    try {
      const parsed = sessionFromParsed(JSON.parse(candidate) as Partial<StubSession>);
      if (parsed) return parsed;
    } catch {
      /* try the next encoding */
    }
  }
  return null;
}

export function serializeStubSession(session: StubSession): string {
  return JSON.stringify({
    userId: session.userId,
    email: session.email,
    role: session.role,
  });
}

export function stubSessionCookieOptions(
  session: StubSession | null,
  secure: boolean,
  domain?: string,
): HttpCookieOptions {
  return {
    name: STUB_SESSION_COOKIE,
    value: session ? serializeStubSession(session) : "",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: session ? COOKIE_MAX_AGE : 0,
    secure,
    ...(domain ? { domain } : {}),
  };
}

export function stubSessionCookieWrites(
  session: StubSession | null,
  secure: boolean,
  domain?: string,
): HttpCookieOptions[] {
  const cookie = stubSessionCookieOptions(session, secure, domain);
  if (!domain) return [cookie];
  const hostOnly: HttpCookieOptions = { ...cookie };
  delete hostOnly.domain;
  if (cookie.maxAge > 0 && cookie.value) {
    return [
      { ...hostOnly, value: "", maxAge: 0 },
      { ...cookie, domain },
    ];
  }
  return [hostOnly, { ...cookie, domain }];
}

function readNamedCookie(
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

export function parseStubSessionFromCookieHeader(
  cookieHeader: string | null | undefined,
): StubSession | null {
  return parseStubSession(readNamedCookie(cookieHeader, STUB_SESSION_COOKIE));
}

export async function readStubSession(): Promise<StubSession | null> {
  const { cookies, headers } = await import("next/headers");
  const jar = await cookies();
  const fromJar = parseStubSession(jar.get(STUB_SESSION_COOKIE)?.value);
  if (fromJar) return fromJar;
  const hdrs = await headers();
  return parseStubSessionFromCookieHeader(hdrs.get("cookie"));
}

export function createStubSession(input: {
  email: string;
  role?: string | null;
}): StubSession {
  const email = input.email.trim().toLowerCase();
  return {
    userId: stubUserIdFromEmail(email),
    email,
    role: input.role === "puller" ? "puller" : "viewer",
  };
}
