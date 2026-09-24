import { NextResponse } from "next/server";
import {
  diagnoseSupabaseServiceRoleKey,
  isProcoreTokenStorageConfigured,
  isSupabaseServiceRoleKeyValid,
} from "@/lib/procoreConnections";
import { isProcoreOAuthConfigured } from "@/lib/procoreOAuth";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { readAppSession } from "@/lib/session.server";

export const dynamic = "force-dynamic";

/**
 * Connected state for the signed-in user. Never includes tokens.
 */
export async function GET() {
  const session = await readAppSession();
  const view = await getProcoreConnectionView(session);
  return NextResponse.json({
    ok: true,
    ...view,
    oauthConfigured: isProcoreOAuthConfigured(),
    storageConfigured: isProcoreTokenStorageConfigured(),
    storageKeyValid: isSupabaseServiceRoleKeyValid(),
    storageKeyProblem: isSupabaseServiceRoleKeyValid()
      ? null
      : diagnoseSupabaseServiceRoleKey().message,
  });
}
