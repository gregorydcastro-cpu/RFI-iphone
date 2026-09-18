/**
 * Browser-safe sheet PDF URL helpers. Remote Drive/Procore URLs must go
 * through GET /api/sheet-pdf so pdf.js never fetches those hosts (CORS/auth).
 * Same-origin `/packs/*.pdf` stays a direct path.
 */

function driveIdFromUrl(url: string): string | null {
  const file = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  if (file?.[1]) return file[1];
  const query = url.match(/[?&]id=([^&]+)/i);
  return query?.[1] ? decodeURIComponent(query[1]) : null;
}

export function isBrowserDirectPdfUrl(pdfUrl: string): boolean {
  const trimmed = pdfUrl.trim();
  if (!trimmed) return false;
  return trimmed.startsWith("/") && !trimmed.startsWith("//");
}

export function viewerSheetPdfSrc(input: {
  requestId: string;
  sheetId: string;
  pdfUrl: string;
}): string {
  const pdfUrl = input.pdfUrl.trim();
  if (!pdfUrl) return "";
  if (isBrowserDirectPdfUrl(pdfUrl)) return pdfUrl;
  const params = new URLSearchParams({
    requestId: input.requestId,
    sheetId: input.sheetId,
  });
  return `/api/sheet-pdf?${params.toString()}`;
}

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isGoogleDrivePdfUrl(url: string): boolean {
  if (driveIdFromUrl(url)) return true;
  const host = hostnameOf(url);
  if (!host) return false;
  return (
    host === "drive.google.com" ||
    host === "docs.google.com" ||
    host === "drive.usercontent.google.com" ||
    host.endsWith(".googleusercontent.com")
  );
}

export function isProcorePdfUrl(url: string): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  return host === "procore.com" || host.endsWith(".procore.com");
}

export function isGoogleLoginHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "accounts.google.com" || host.endsWith(".accounts.google.com");
}

export function isPdfMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

export function isBlockedFetchHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  if (
    host === "localhost" ||
    host === "metadata.google.internal" ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    host === "::1" ||
    host.includes(":")
  ) {
    return true;
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}
