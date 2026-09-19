import { cookies, headers } from "next/headers";
import {
  PROCORE_LINKED_COOKIE,
  PROCORE_LINKED_HEADER,
  readFieldRole,
  type FieldRole,
} from "./auth";
import { readAppSession } from "./session.server";

export async function getFieldRole(): Promise<FieldRole> {
  const jar = await cookies();
  const hdrs = await headers();
  const session = await readAppSession();
  return readFieldRole({
    cookieValue: jar.get(PROCORE_LINKED_COOKIE)?.value,
    header: hdrs.get(PROCORE_LINKED_HEADER),
    sessionRole: session?.role ?? null,
  });
}
