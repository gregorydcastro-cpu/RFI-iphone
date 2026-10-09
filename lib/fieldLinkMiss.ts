export type FieldLinkTarget =
  | { kind: "invite"; token: string }
  | { kind: "pack"; requestId: string };

export type FieldLinkLookup = {
  inviteMissing: (token: string) => Promise<boolean>;
  packMissing: (requestId: string) => Promise<boolean>;
};

const INVITE_PATH = /^\/invite\/([^/]+)$/;
const PACK_PATH = /^\/pack\/([^/]+)(?:\/.*)?$/;

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function decodeSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** Invite token or pack id in the pathname, or null for every other URL. */
export function fieldLinkTarget(pathname: string): FieldLinkTarget | null {
  const path = normalizePath(pathname);
  const invite = INVITE_PATH.exec(path);
  if (invite) {
    const token = decodeSegment(invite[1] ?? "");
    if (!token) return { kind: "invite", token: invite[1] ?? "" };
    return { kind: "invite", token };
  }
  const pack = PACK_PATH.exec(path);
  if (pack) {
    const requestId = decodeSegment(pack[1] ?? "");
    if (!requestId) return { kind: "pack", requestId: pack[1] ?? "" };
    return { kind: "pack", requestId };
  }
  return null;
}

/**
 * True when this URL is a bad invite or pack link.
 * Other URLs, including /api and unknown pages, are not link misses.
 */
export async function fieldLinkIsMissing(
  pathname: string,
  lookup: FieldLinkLookup,
): Promise<boolean> {
  const target = fieldLinkTarget(pathname);
  if (!target) return false;
  if (target.kind === "invite") return lookup.inviteMissing(target.token);
  return lookup.packMissing(target.requestId);
}
