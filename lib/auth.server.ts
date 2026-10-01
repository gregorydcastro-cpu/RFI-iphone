import { cookies, headers } from "next/headers";
import {
  PROCORE_LINKED_COOKIE,
  PROCORE_LINKED_HEADER,
  readFieldRole,
  type FieldRole,
} from "./auth";
import { hasSupabaseAuthCookie, type AppSession } from "./session";
import { readAppSession } from "./session.server";

export type FieldAccess = FieldRole & {
  session: AppSession | null;
  /** Auth cookie is still present, but getUser() found no session. */
  sessionEnded: boolean;
};

export async function getFieldRole(): Promise<FieldAccess> {
  const jar = await cookies();
  const hdrs = await headers();
  const session = await readAppSession();
  const names = jar.getAll().map((cookie) => cookie.name);
  return {
    ...readFieldRole({
      cookieValue: jar.get(PROCORE_LINKED_COOKIE)?.value,
      header: hdrs.get(PROCORE_LINKED_HEADER),
      sessionRole: session?.role ?? null,
    }),
    session,
    sessionEnded: !session && hasSupabaseAuthCookie(names),
  };
}
