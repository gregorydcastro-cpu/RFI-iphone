import { NextResponse } from "next/server";
import { isProcoreTokenStorageConfigured } from "@/lib/procoreConnections";
import { isProcoreOAuthConfigured } from "@/lib/procoreOAuth";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { readStubSession } from "@/lib/stubSession";

export const dynamic = "force-dynamic";

/**
 * Connected state for the stub session. Never includes tokens.
 */
export async function GET() {
  const session = await readStubSession();
  const view = await getProcoreConnectionView(session);
  return NextResponse.json({
    ok: true,
    ...view,
    oauthConfigured: isProcoreOAuthConfigured(),
    storageConfigured: isProcoreTokenStorageConfigured(),
  });
}
