import { DEMO_FOREMAN } from "@/lib/crew";
import { canWriteFieldLog } from "@/lib/invites";
import { isRfiDraftStatus } from "@/lib/rfiSchema";
import { fieldRoleForRequest } from "@/lib/session.server";
import { insertRfiDraftRow, isRfiTableWriteConfigured } from "@/lib/supabaseRfis";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RfiBody = {
  subject?: unknown;
  description?: unknown;
  location?: unknown;
  sheet_id?: unknown;
  markup_id?: unknown;
  status?: unknown;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return UUID_RE.test(value.trim()) ? value.trim() : null;
}

function newUuid(): string {
  return crypto.randomUUID();
}

/**
 * Create a draft RFI row in `public.rfis`.
 * Sent to foreman Pat Nguyen. Never a Procore submit.
 *
 * Service-role persist when configured; otherwise the client keeps
 * localStorage and this returns `persisted: false`.
 * `markup_id` is the optional overlay FK when Create RFI came from a markup.
 */
export async function POST(request: Request) {
  const { session, role } = await fieldRoleForRequest(request);
  if (!session) {
    return json({ ok: false, error: "Sign in first." }, 401);
  }
  if (!canWriteFieldLog(role.role)) {
    return json(
      {
        ok: false,
        error: "View-only session. Drafts need a full-crew (puller) invite.",
      },
      403,
    );
  }

  let body: RfiBody;
  try {
    body = (await request.json()) as RfiBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const subject = asTrimmed(body.subject);
  const description = asTrimmed(body.description);
  if (!subject || !description) {
    return json({ ok: false, error: "subject and description are required" }, 400);
  }

  const userId = session.userId;

  const status = isRfiDraftStatus(body.status) ? body.status : "draft";
  const id = newUuid();
  const configured = isRfiTableWriteConfigured();
  const row = configured
    ? await insertRfiDraftRow({
        id,
        userId,
        subject,
        description,
        location: asTrimmed(body.location),
        sheetId: asTrimmed(body.sheet_id),
        markupId: asUuid(body.markup_id),
        status,
      })
    : null;

  const now = new Date().toISOString();
  const packet = row ?? {
    id,
    user_id: userId,
    subject,
    description,
    location: asTrimmed(body.location),
    sheet_id: asTrimmed(body.sheet_id),
    markup_id: asUuid(body.markup_id),
    status,
    created_at: now,
    updated_at: now,
  };

  return json({
    ok: true,
    persisted: Boolean(row),
    storage: row ? "supabase" : configured ? "unavailable" : "unconfigured",
    procore: false,
    sentTo: {
      name: DEMO_FOREMAN.name,
      role: DEMO_FOREMAN.role,
      email: DEMO_FOREMAN.email,
    },
    row: packet,
  });
}
