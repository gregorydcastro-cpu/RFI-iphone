/**
 * Parse Google service-account JSON / PEM from Vercel env.
 * No other imports so unit tests can load this file under node:test.
 */

export function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function normalizePrivateKey(raw: string): string {
  return stripWrappingQuotes(raw)
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = stripWrappingQuotes(raw.trim());
  const candidates = [trimmed];
  if (!trimmed.startsWith("{")) {
    try {
      candidates.push(Buffer.from(trimmed, "base64").toString("utf8"));
    } catch {
      /* ignore */
    }
  }
  for (const candidate of candidates) {
    try {
      let parsed: unknown = JSON.parse(candidate);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

export type DriveServiceAccount = {
  clientEmail: string;
  privateKey: string;
};

export function parseDriveServiceAccountJson(
  raw: string,
): DriveServiceAccount | null {
  const rec = parseJsonObject(raw);
  if (!rec) return null;
  const clientEmail =
    (typeof rec.client_email === "string" && rec.client_email.trim()) ||
    (typeof rec.clientEmail === "string" && rec.clientEmail.trim()) ||
    "";
  const privateKeyRaw =
    (typeof rec.private_key === "string" && rec.private_key) ||
    (typeof rec.privateKey === "string" && rec.privateKey) ||
    "";
  const privateKey = normalizePrivateKey(privateKeyRaw);
  if (!clientEmail || !privateKey.includes("BEGIN")) return null;
  return { clientEmail, privateKey };
}
