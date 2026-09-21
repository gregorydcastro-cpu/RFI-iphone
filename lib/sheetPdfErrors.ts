/**
 * Client-safe sheet PDF error codes and copy.
 * Messages name env keys only. Never include tokens, PEM, or upstream bodies.
 */

export const SHEET_PDF_ERROR_CODES = [
  "bad_request",
  "pack_not_found",
  "sheet_not_found",
  "pdf_missing",
  "not_found",
  "drive_auth_missing",
  "drive_auth_rejected",
  "drive_forbidden",
  "timeout",
  "upstream_failed",
  "too_large",
  "not_pdf",
  "too_many_redirects",
  "invalid_pdf_url",
  "blocked_url",
  "procore_pdf_unsupported",
] as const;

export type SheetPdfErrorCode = (typeof SHEET_PDF_ERROR_CODES)[number];

export const DRIVE_AUTH_MISSING_MESSAGE =
  "Google Drive credentials are not configured. Set GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON (or GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY) on Vercel and share the Room Packs folder with that service account.";

export const SHEET_PDF_MESSAGES: Record<SheetPdfErrorCode, string> = {
  bad_request: "requestId and sheetId are required.",
  pack_not_found: "Pack not available.",
  sheet_not_found: "Sheet not found in this pack.",
  pdf_missing: "No PDF attached for this sheet.",
  not_found:
    "Drive file was not found. Confirm the file id, or share the Room Packs folder with the service account.",
  drive_auth_missing: DRIVE_AUTH_MISSING_MESSAGE,
  drive_auth_rejected:
    "Google Drive service account was rejected. Check GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON or GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY on Vercel.",
  drive_forbidden:
    "Drive file is not shared with the service account. Share the Room Packs folder with the service account as Viewer.",
  timeout: "Timed out fetching the sheet PDF.",
  upstream_failed: "Could not reach Google Drive.",
  too_large: "Sheet PDF is larger than 45 MB.",
  not_pdf: "Sheet file was not a PDF.",
  too_many_redirects: "Sheet PDF had too many redirects.",
  invalid_pdf_url: "Sheet PDF URL is invalid.",
  blocked_url: "Sheet PDF host is not allowed.",
  procore_pdf_unsupported:
    "This sheet points at Procore. The Procore bot should store a Google Drive or public PDF URL. The website does not fetch Procore drawings.",
};

const RETRYABLE_DRIVE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export function isSheetPdfErrorCode(value: unknown): value is SheetPdfErrorCode {
  return (
    typeof value === "string" &&
    (SHEET_PDF_ERROR_CODES as readonly string[]).includes(value)
  );
}

/** Transient Drive / Google statuses worth one bounded retry. */
export function isRetryableDriveStatus(status: number): boolean {
  return RETRYABLE_DRIVE_STATUS.has(status);
}

export function mapDriveDownloadStatus(status: number): {
  httpStatus: number;
  code: SheetPdfErrorCode;
  retryable: boolean;
} {
  if (status === 401) {
    return { httpStatus: 503, code: "drive_auth_rejected", retryable: false };
  }
  if (status === 403) {
    return { httpStatus: 502, code: "drive_forbidden", retryable: false };
  }
  if (status === 404) {
    return { httpStatus: 404, code: "not_found", retryable: false };
  }
  if (status === 408 || status === 504) {
    return { httpStatus: 504, code: "timeout", retryable: true };
  }
  if (isRetryableDriveStatus(status) || status >= 500) {
    return { httpStatus: 502, code: "upstream_failed", retryable: true };
  }
  return { httpStatus: 502, code: "upstream_failed", retryable: false };
}

export function mapDriveTokenStatus(status: number): {
  code: "drive_auth_rejected" | "timeout" | "upstream_failed";
  retryable: boolean;
} {
  if (status === 408 || status === 504) {
    return { code: "timeout", retryable: true };
  }
  if (status === 429 || (status >= 500 && status <= 599)) {
    return { code: "upstream_failed", retryable: true };
  }
  return { code: "drive_auth_rejected", retryable: false };
}

export type PublicSheetPdfError = {
  ok: false;
  error: string;
  code: SheetPdfErrorCode;
  configured?: boolean;
};

/** Route JSON. Drops unknown codes and any upstream text. */
export function publicSheetPdfError(input: {
  code: string;
  configured?: boolean;
}): PublicSheetPdfError {
  const code = isSheetPdfErrorCode(input.code) ? input.code : "upstream_failed";
  const body: PublicSheetPdfError = {
    ok: false,
    error: SHEET_PDF_MESSAGES[code],
    code,
  };
  if (typeof input.configured === "boolean") body.configured = input.configured;
  return body;
}

export class DriveTokenError extends Error {
  readonly code: "drive_auth_rejected" | "timeout" | "upstream_failed";

  constructor(code: DriveTokenError["code"]) {
    super(SHEET_PDF_MESSAGES[code]);
    this.name = "DriveTokenError";
    this.code = code;
  }
}

export type SheetPdfBanner = {
  title: string;
  message: string;
  retryable: boolean;
};

const NO_RETRY: ReadonlySet<SheetPdfErrorCode> = new Set([
  "bad_request",
  "pdf_missing",
  "procore_pdf_unsupported",
  "blocked_url",
  "invalid_pdf_url",
  "too_large",
  "too_many_redirects",
]);

const FIELD_COPY: Record<SheetPdfErrorCode, { title: string; message: string }> = {
  bad_request: {
    title: "Sheet request failed",
    message: "This sheet link is incomplete.",
  },
  pack_not_found: {
    title: "Pack not available",
    message: "This room pack is not available. Tap Retry.",
  },
  sheet_not_found: {
    title: "Sheet not in pack",
    message: "This sheet is not in the pack. Tap Retry.",
  },
  pdf_missing: {
    title: "No PDF attached",
    message: "No PDF attached for this sheet.",
  },
  not_found: {
    title: "Sheet not found",
    message:
      "Drive did not find this sheet file. Check the file, or share the Room Packs folder, then tap Retry.",
  },
  drive_auth_missing: {
    title: "Drive account missing",
    message:
      "No Google Drive service account on the server. Ask the office to set the Drive key and share the Room Packs folder.",
  },
  drive_auth_rejected: {
    title: "Drive account rejected",
    message:
      "Google Drive rejected the service account. Ask the office to check the Drive key, then tap Retry.",
  },
  drive_forbidden: {
    title: "Sheet not shared",
    message:
      "This sheet is not shared with the Drive account. Share the Room Packs folder, then tap Retry.",
  },
  timeout: {
    title: "Sheet timed out",
    message: "The sheet PDF timed out. Tap Retry.",
  },
  upstream_failed: {
    title: "Can't reach Drive",
    message: "Could not reach Google Drive. Check the connection and tap Retry.",
  },
  too_large: {
    title: "Sheet PDF too large",
    message: "This sheet PDF is larger than 45 MB.",
  },
  not_pdf: {
    title: "Sheet was not a PDF",
    message: "The file that came back was not a PDF. Tap Retry.",
  },
  too_many_redirects: {
    title: "Sheet PDF failed",
    message: "The sheet download was redirected too many times.",
  },
  invalid_pdf_url: {
    title: "Sheet link invalid",
    message: "This sheet PDF link is invalid.",
  },
  blocked_url: {
    title: "Sheet link blocked",
    message: "This sheet PDF host is not allowed.",
  },
  procore_pdf_unsupported: {
    title: "Procore PDF not loaded here",
    message:
      "This sheet still points at Procore. The pack needs a Drive or public PDF link.",
  },
};

const NETWORK_BANNER: SheetPdfBanner = {
  title: "Can't reach the sheet",
  message: "Could not reach the sheet. Check the connection and tap Retry.",
  retryable: true,
};

export function sheetPdfBanner(input: {
  code?: string | null;
  httpStatus?: number;
  network?: boolean;
}): SheetPdfBanner {
  if (input.network) return NETWORK_BANNER;
  const code = isSheetPdfErrorCode(input.code) ? input.code : undefined;
  if (code) {
    const copy = FIELD_COPY[code];
    return {
      title: copy.title,
      message: copy.message,
      retryable: !NO_RETRY.has(code),
    };
  }
  const status = input.httpStatus ?? 0;
  if (status === 504 || status === 408) return sheetPdfBanner({ code: "timeout" });
  if (status === 404) return sheetPdfBanner({ code: "not_found" });
  if (status === 503) return sheetPdfBanner({ code: "drive_auth_missing" });
  if (status === 0) return NETWORK_BANNER;
  return {
    title: "Sheet PDF failed",
    message: "Could not load this sheet. Tap Retry.",
    retryable: true,
  };
}

export function bannerFromSheetPdfBody(
  body: unknown,
  httpStatus: number,
): SheetPdfBanner {
  const rec =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const code = typeof rec.code === "string" ? rec.code : undefined;
  return sheetPdfBanner({ code, httpStatus });
}

export async function readSheetPdfBanner(
  response: Response,
): Promise<SheetPdfBanner> {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("json")) {
    return sheetPdfBanner({ httpStatus: response.status });
  }
  try {
    const body: unknown = await response.json();
    return bannerFromSheetPdfBody(body, response.status);
  } catch {
    return sheetPdfBanner({ httpStatus: response.status });
  }
}
