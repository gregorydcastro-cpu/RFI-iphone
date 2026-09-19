import { cookies, headers } from "next/headers";
import {
  PROCORE_LINKED_COOKIE,
  PROCORE_LINKED_HEADER,
  STUB_SESSION_COOKIE,
  readFieldRole,
  type FieldRole,
} from "./auth";
import { parseStubSession } from "./stubSession";

export async function getFieldRole(): Promise<FieldRole> {
  const jar = await cookies();
  const hdrs = await headers();
  const session = parseStubSession(jar.get(STUB_SESSION_COOKIE)?.value);
  return readFieldRole({
    cookieValue: jar.get(PROCORE_LINKED_COOKIE)?.value,
    header: hdrs.get(PROCORE_LINKED_HEADER),
    sessionRole: session?.role ?? null,
  });
}
