/**
 * Browser-safe sheet PDF failure copy and retry policy.
 * SheetViewer uses this for GET /api/sheet-pdf JSON errors.
 * No secrets, no Drive tokens, no env reads.
 */

export const SHEET_PDF_MAX_AUTO_RETRIES = 2;
/** Short backoff before automatic retries 1 and 2. */
export const SHEET_PDF_RETRY_BACKOFF_MS = [400, 900] as const;

export const SHEET_PDF_FAILURE_CODES = [
  "bad_request",
  "invalid_pdf_url",
  "blocked_url",
  "drive_auth_missing",
  "upstream_timeout",
  "upstream_failed",
  "too_large",
  "not_pdf",
  "too_many_redirects",
  "drive_auth_rejected",
  "drive_forbidden",
  "pack_not_found",
  "sheet_not_found",
  "pdf_missing",
  "procore_pdf_unsupported",
  "network",
] as const;

export type SheetPdfFailureCode = (typeof SHEET_PDF_FAILURE_CODES)[number];

const TRANSIENT_CODES: ReadonlySet<string> = new Set([
  "network",
  "upstream_timeout",
  "upstream_failed",
]);

const PULLER_PACK_CODES: ReadonlySet<string> = new Set([
  "pack_not_found",
  "sheet_not_found",
  "pdf_missing",
]);

/**
 * Empty pack / missing sheet PDF: crew should connect Procore as a puller.
 * Ops may still need a valid service-role key (issue #53). Never include the key.
 */
export const SHEET_PDF_PULLER_HINT =
  "Connect Procore as a puller to pull this pack. If tokens still will not save, ops may need a valid SUPABASE_SERVICE_ROLE_KEY (issue #53). Do not paste that key.";

export type SheetPdfFailureInfo = {
  code: string;
  status: number;
  network: boolean;
  configured?: boolean;
  serverError?: string;
};

export type SheetPdfCrewCopy = {
  message: string;
  detail?: string;
};

const CREW_COPY: Record<SheetPdfFailureCode, string> = {
  bad_request: "The sheet link is incomplete. Open the pack and try the sheet again.",
  invalid_pdf_url: "The sheet link is incomplete. Open the pack and try the sheet again.",
  blocked_url: "This sheet link is not allowed.",
  drive_auth_missing:
    "Google Drive is not configured for sheet PDFs yet. Ops has to turn that on before this sheet will open.",
  upstream_timeout: "The sheet PDF timed out. Tap Retry.",
  upstream_failed: "The sheet server failed. Tap Retry.",
  too_large: "This sheet PDF is too large to open here.",
  not_pdf: "That file is not a PDF.",
  too_many_redirects: "The sheet link redirected too many times.",
  drive_auth_rejected:
    "Drive rejected the server login. Ops needs to fix the Drive account.",
  drive_forbidden:
    "Drive will not hand over this sheet. The pack folder is not shared with the field log account (Viewer).",
  pack_not_found: "This pack is not on the server yet.",
  sheet_not_found: "This sheet is not in the pack.",
  pdf_missing: "No PDF is attached to this sheet.",
  procore_pdf_unsupported:
    "This sheet still points at Procore instead of a Drive PDF.",
  network: "Cannot reach the sheet. Check the connection, then tap Retry.",
};

export const SHEET_PDF_RENDER_FAILURE: SheetPdfCrewCopy = {
  message: "Could not open this sheet. Tap Retry.",
};

const GENERIC_COPY = "Could not load this sheet. Tap Retry.";

export function classifyUpstreamHttpStatus(
  status: number,
): "upstream_timeout" | "upstream_failed" {
  if (status === 408 || status === 504) return "upstream_timeout";
  return "upstream_failed";
}

export function isSheetPdfFailureCode(value: unknown): value is SheetPdfFailureCode {
  return (
    typeof value === "string" &&
    (SHEET_PDF_FAILURE_CODES as readonly string[]).includes(value)
  );
}

export function parseSheetPdfErrorBody(
  data: unknown,
  status: number,
): SheetPdfFailureInfo {
  const body =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const rawCode = typeof body.code === "string" ? body.code.trim() : "";
  const serverError = typeof body.error === "string" ? body.error.trim() : "";
  const configured =
    typeof body.configured === "boolean" ? body.configured : undefined;

  let code = rawCode;
  if (!code && configured === false) code = "drive_auth_missing";
  if (!code) {
    if (status === 408 || status === 504) code = "upstream_timeout";
    else if (status >= 500) code = "upstream_failed";
    else code = "http";
  }

  return {
    code,
    status,
    network: false,
    ...(configured === undefined ? {} : { configured }),
    ...(serverError ? { serverError } : {}),
  };
}

export function networkSheetPdfFailure(): SheetPdfFailureInfo {
  return { code: "network", status: 0, network: true };
}

export async function readSheetPdfFailure(
  response: Response,
): Promise<SheetPdfFailureInfo> {
  const status = response.status;
  let text = "";
  try {
    text = await response.text();
  } catch {
    return parseSheetPdfErrorBody(null, status);
  }
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      return parseSheetPdfErrorBody(JSON.parse(trimmed) as unknown, status);
    } catch {
      return parseSheetPdfErrorBody(null, status);
    }
  }
  return parseSheetPdfErrorBody(null, status);
}

export function sheetPdfCrewMessage(
  failure: Pick<SheetPdfFailureInfo, "code" | "status" | "network" | "configured">,
): SheetPdfCrewCopy {
  if (failure.network || failure.code === "network") {
    return { message: CREW_COPY.network };
  }
  if (isSheetPdfFailureCode(failure.code)) {
    const message = CREW_COPY[failure.code];
    if (PULLER_PACK_CODES.has(failure.code)) {
      return { message, detail: SHEET_PDF_PULLER_HINT };
    }
    if (failure.code === "procore_pdf_unsupported") {
      return {
        message,
        detail: "Connect Procore as a puller so the pack can store a Drive PDF.",
      };
    }
    return { message };
  }
  if (failure.configured === false) {
    return { message: CREW_COPY.drive_auth_missing };
  }
  if (failure.status >= 500) {
    return { message: CREW_COPY.upstream_failed };
  }
  return { message: GENERIC_COPY };
}

export function isTransientSheetPdfFailure(
  failure: Pick<SheetPdfFailureInfo, "code" | "status" | "network">,
): boolean {
  if (failure.network || failure.code === "network") return true;
  if (TRANSIENT_CODES.has(failure.code)) return true;
  if (isSheetPdfFailureCode(failure.code)) return false;
  return failure.status >= 500;
}

export function sheetPdfAutoRetry(input: {
  failure: Pick<SheetPdfFailureInfo, "code" | "status" | "network">;
  autoRetriesUsed: number;
}): { retry: false } | { retry: true; delayMs: number } {
  if (input.autoRetriesUsed >= SHEET_PDF_MAX_AUTO_RETRIES) return { retry: false };
  if (!isTransientSheetPdfFailure(input.failure)) return { retry: false };
  const delayMs = SHEET_PDF_RETRY_BACKOFF_MS[input.autoRetriesUsed] ?? 900;
  return { retry: true, delayMs };
}

export class SheetPdfLoadError extends Error {
  readonly failure: SheetPdfFailureInfo;
  readonly copy: SheetPdfCrewCopy;

  constructor(failure: SheetPdfFailureInfo) {
    const copy = sheetPdfCrewMessage(failure);
    super(copy.message);
    this.name = "SheetPdfLoadError";
    this.failure = failure;
    this.copy = copy;
  }
}

export function isSheetPdfAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function waitForSheetPdfRetry(
  ms: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function abortError(): Error {
  if (typeof DOMException !== "undefined") {
    return new DOMException("Aborted", "AbortError");
  }
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

export type SheetPdfFetch = (
  url: string,
  init: { signal?: AbortSignal; credentials: "same-origin" },
) => Promise<Response>;

/**
 * Fetch sheet bytes with 1–2 automatic retries on network errors and
 * transient 5xx (`upstream_timeout`, `upstream_failed`). Permanent codes
 * (Drive config, share, missing pack) fail on the first response.
 */
export async function fetchSheetPdfBytes(input: {
  url: string;
  signal?: AbortSignal;
  fetchImpl?: SheetPdfFetch;
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
  onRetry?: (info: { autoRetriesUsed: number; delayMs: number }) => void;
  isPdf?: (bytes: Uint8Array) => boolean;
}): Promise<Uint8Array> {
  const fetchImpl = input.fetchImpl ?? defaultFetch;
  const wait = input.wait ?? waitForSheetPdfRetry;
  const isPdf = input.isPdf ?? defaultIsPdf;
  let autoRetriesUsed = 0;

  for (;;) {
    try {
      const response = await fetchImpl(input.url, {
        signal: input.signal,
        credentials: "same-origin",
      });
      if (!response.ok) {
        const failure = await readSheetPdfFailure(response);
        const decision = sheetPdfAutoRetry({ failure, autoRetriesUsed });
        if (!decision.retry) throw new SheetPdfLoadError(failure);
        autoRetriesUsed += 1;
        input.onRetry?.({ autoRetriesUsed, delayMs: decision.delayMs });
        await wait(decision.delayMs, input.signal);
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!isPdf(bytes)) {
        throw new SheetPdfLoadError({
          code: "not_pdf",
          status: response.status,
          network: false,
        });
      }
      return bytes;
    } catch (error) {
      if (error instanceof SheetPdfLoadError || isSheetPdfAbortError(error)) {
        throw error;
      }
      const failure = networkSheetPdfFailure();
      const decision = sheetPdfAutoRetry({ failure, autoRetriesUsed });
      if (!decision.retry) throw new SheetPdfLoadError(failure);
      autoRetriesUsed += 1;
      input.onRetry?.({ autoRetriesUsed, delayMs: decision.delayMs });
      await wait(decision.delayMs, input.signal);
    }
  }
}

function defaultFetch(
  url: string,
  init: { signal?: AbortSignal; credentials: "same-origin" },
): Promise<Response> {
  return fetch(url, init);
}

function defaultIsPdf(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}
