import { DEPLOY_SHA_ENV, healthResponse } from "@/lib/health";
import { readEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Public liveness. No session, database, or secrets. */
export function GET() {
  return healthResponse(readEnv(DEPLOY_SHA_ENV));
}
