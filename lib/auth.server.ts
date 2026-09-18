import { cookies, headers } from "next/headers";
import {
  PROCORE_LINKED_COOKIE,
  PROCORE_LINKED_HEADER,
  readFieldRole,
  type FieldRole,
} from "./auth";

export async function getFieldRole(): Promise<FieldRole> {
  const jar = await cookies();
  const hdrs = await headers();
  return readFieldRole({
    cookieValue: jar.get(PROCORE_LINKED_COOKIE)?.value,
    header: hdrs.get(PROCORE_LINKED_HEADER),
  });
}
