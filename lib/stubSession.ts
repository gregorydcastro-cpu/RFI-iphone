import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import {
  parseFieldRoleName,
  readCookieValue,
  STUB_SESSION_COOKIE,
  type FieldRoleName,
} from "./auth";

export { STUB_SESSION_COOKIE };

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

export function stubSessionFromRequest(request: Request): StubSession | null {
  return parseStubSession(
    readCookieValue(request.headers.get("cookie"), STUB_SESSION_COOKIE),
  );
}

export function parseStubSession(raw: string | undefined | null): StubSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StubSession>;
    const email =
      typeof parsed.email === "string" ? parsed.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) return null;
    const role: FieldRoleName = parseFieldRoleName(parsed.role);
    const userId =
      typeof parsed.userId === "string" && parsed.userId.startsWith("stub:")
        ? parsed.userId
        : stubUserIdFromEmail(email);
    return { userId, email, role };
  } catch {
    return null;
  }
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
    name: STUB_SESSION_COOKIE,
    value: session ? serializeStubSession(session) : "",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: session ? COOKIE_MAX_AGE : 0,
    secure,
  };
}

export async function readStubSession(): Promise<StubSession | null> {
  const jar = await cookies();
  return parseStubSession(jar.get(STUB_SESSION_COOKIE)?.value);
}

export function createStubSession(input: {
  email: string;
  role?: string | null;
}): StubSession {
  const email = input.email.trim().toLowerCase();
  return {
    userId: stubUserIdFromEmail(email),
    email,
    role: parseFieldRoleName(input.role),
  };
}
