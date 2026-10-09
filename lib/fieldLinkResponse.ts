import {
  FIELD_LINK_MISS,
  FIELD_NOT_FOUND_HEADER,
  HOME_HREF,
  HOME_LABEL,
  LINK_NOT_FOUND_MESSAGE,
  LINK_NOT_FOUND_TITLE,
  MAPLE_POINT_DEMO_HREF,
  MAPLE_POINT_DEMO_LABEL,
  PAGE_NOT_FOUND_MESSAGE,
  PAGE_NOT_FOUND_TITLE,
} from "./fieldNotFound.ts";
import { SECURITY_HEADERS } from "./securityHeaders.ts";

/**
 * Internal fetch of the root not-found page. Only that render may keep
 * the link marker. A client cannot use this header to skip the 404 on
 * /invite or /pack — those paths never take the pass-through branch.
 * The same header marks the internal page-card render so a direct
 * /_not-found request does not fetch itself again.
 */
export const LINK_MISS_RENDER_HEADER = "x-gc-link-miss-render";

/** Finished response status for a missing invite or pack. Not a rewrite. */
export const LINK_MISS_STATUS = 404;

const REQUEST_HEADER_BLOCKLIST = [
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "te",
  "trailer",
  "upgrade",
  "expect",
  "accept-encoding",
  "content-encoding",
  "x-middleware-subrequest",
];

const DOCUMENT_HEADER_BLOCKLIST = [
  "rsc",
  "next-router-state-tree",
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "next-url",
  "next-hmr-refresh",
];

const RESPONSE_HEADER_BLOCKLIST = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  LINK_MISS_RENDER_HEADER,
]);

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    const stripped = pathname.replace(/\/+$/, "");
    return stripped.length > 0 ? stripped : "/";
  }
  return pathname;
}

/** Where the branded link card is rendered: the root not-found document. */
export function linkMissRenderUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  url.pathname = "/_not-found";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function isNotFoundDocumentPath(pathname: string): boolean {
  return normalizePath(pathname) === "/_not-found";
}

export function isLinkMissRender(pathname: string, headers: Headers): boolean {
  return (
    isNotFoundDocumentPath(pathname) &&
    headers.get(LINK_MISS_RENDER_HEADER) === "1"
  );
}

/**
 * A browser request for the not-found document itself.
 * The internal render carries the render header and is not this request,
 * so the proxy can pass that fetch through without calling it again.
 */
export function isDirectNotFoundRequest(pathname: string, headers: Headers): boolean {
  return isNotFoundDocumentPath(pathname) && !isLinkMissRender(pathname, headers);
}

type NotFoundCard = "link" | "page";

/** Headers for the internal document render. Forces HTML, keeps cookies. */
function notFoundRenderRequestHeaders(
  requestHeaders: Headers,
  card: NotFoundCard,
): Headers {
  const headers = new Headers(requestHeaders);
  for (const name of REQUEST_HEADER_BLOCKLIST) headers.delete(name);
  for (const name of DOCUMENT_HEADER_BLOCKLIST) headers.delete(name);
  headers.delete(FIELD_NOT_FOUND_HEADER);
  headers.delete(LINK_MISS_RENDER_HEADER);
  if (card === "link") headers.set(FIELD_NOT_FOUND_HEADER, FIELD_LINK_MISS);
  headers.set(LINK_MISS_RENDER_HEADER, "1");
  headers.set("accept", "text/html");
  return headers;
}

export function linkMissRenderRequestHeaders(requestHeaders: Headers): Headers {
  return notFoundRenderRequestHeaders(requestHeaders, "link");
}

/** Same internal render as a link miss, without the link marker. */
export function pageNotFoundRenderRequestHeaders(requestHeaders: Headers): Headers {
  return notFoundRenderRequestHeaders(requestHeaders, "page");
}

/**
 * Pass the link marker through for the internal /_not-found render.
 * Any other value is dropped, same as a spoofed client header.
 */
export function linkMissPassThroughHeaders(requestHeaders: Headers): Headers {
  const headers = new Headers(requestHeaders);
  headers.delete(LINK_MISS_RENDER_HEADER);
  if (headers.get(FIELD_NOT_FOUND_HEADER) !== FIELD_LINK_MISS) {
    headers.delete(FIELD_NOT_FOUND_HEADER);
  }
  return headers;
}

/** Drop a client-supplied link marker on every request that is not a miss. */
export function stripFieldNotFoundHeader(requestHeaders: Headers): Headers {
  const headers = new Headers(requestHeaders);
  headers.delete(FIELD_NOT_FOUND_HEADER);
  headers.delete(LINK_MISS_RENDER_HEADER);
  return headers;
}

function brandedNotFoundHtml(title: string, message: string): string {
  return (
    `<!DOCTYPE html><html lang="en"><head>` +
    `<meta charset="utf-8">` +
    `<meta name="robots" content="noindex, nofollow">` +
    `<title>${title}</title>` +
    `</head><body><main>` +
    `<h1>${title}</h1>` +
    `<p>${message}</p>` +
    `<a href="${HOME_HREF}">${HOME_LABEL}</a>` +
    `<a href="${MAPLE_POINT_DEMO_HREF}">${MAPLE_POINT_DEMO_LABEL}</a>` +
    `<button type="button">Hear this</button>` +
    `</main></body></html>`
  );
}

export function linkMissFallbackHtml(): string {
  return brandedNotFoundHtml(LINK_NOT_FOUND_TITLE, LINK_NOT_FOUND_MESSAGE);
}

export function pageNotFoundFallbackHtml(): string {
  return brandedNotFoundHtml(PAGE_NOT_FOUND_TITLE, PAGE_NOT_FOUND_MESSAGE);
}

/** True when the raw HTML is a branded card, not the __next_error__ shell. */
function isBrandedNotFoundDocument(html: string, title: string, message: string): boolean {
  if (!html.includes("<html") || !html.includes('lang="en"')) return false;
  if (!html.includes("<h1")) return false;
  if (!html.includes(title)) return false;
  if (!html.includes(message)) return false;
  if (!html.includes('href="/"')) return false;
  if (!html.includes(`href="${MAPLE_POINT_DEMO_HREF}"`)) return false;
  if (!html.includes("Hear this")) return false;
  if (!/noindex/i.test(html)) return false;
  if (html.includes("__next_error__")) return false;
  return true;
}

/** True when the raw HTML is the link card, not the __next_error__ shell. */
export function isBrandedLinkMissDocument(html: string): boolean {
  return isBrandedNotFoundDocument(html, LINK_NOT_FOUND_TITLE, LINK_NOT_FOUND_MESSAGE);
}

/** True when the raw HTML is the page card, not the link card or error shell. */
export function isBrandedPageNotFoundDocument(html: string): boolean {
  return isBrandedNotFoundDocument(html, PAGE_NOT_FOUND_TITLE, PAGE_NOT_FOUND_MESSAGE);
}

export function linkMissResponseHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    const name = key.toLowerCase();
    if (RESPONSE_HEADER_BLOCKLIST.has(name) || name.startsWith("x-middleware-")) return;
    if (name === "set-cookie") return;
    headers.append(key, value);
  });
  for (const cookie of source.getSetCookie?.() ?? []) {
    headers.append("set-cookie", cookie);
  }
  for (const header of SECURITY_HEADERS) {
    if (!headers.has(header.key)) headers.set(header.key, header.value);
  }
  headers.set("cache-control", "private, no-cache, no-store, max-age=0, must-revalidate");
  headers.set("x-robots-tag", "noindex, nofollow");
  if (!headers.has("content-type")) {
    headers.set("content-type", "text/html; charset=utf-8");
  }
  return headers;
}

type LinkMissFetch = (url: string, init?: RequestInit) => Promise<Response>;

type NotFoundDocument = {
  status: typeof LINK_MISS_STATUS;
  body: string | null;
  headers: Headers;
};

/**
 * Load the root not-found document and force HTTP 404.
 * A rewrite to /_not-found stays 200 on Vercel because that page render
 * is a successful match. The status has to be set on this finished response.
 * The render header on the internal fetch is what stops the proxy from
 * fetching /_not-found again.
 */
async function loadNotFoundDocument(input: {
  requestUrl: string;
  requestHeaders: Headers;
  method: string;
  fetchImpl?: LinkMissFetch;
  card: NotFoundCard;
  fallback: string;
  accept: (html: string) => boolean;
  failureLog: string;
}): Promise<NotFoundDocument> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = linkMissRenderUrl(input.requestUrl);
  let body = input.fallback;
  let source = new Headers({ "content-type": "text/html; charset=utf-8" });
  try {
    const rendered = await fetchImpl(url, {
      method: "GET",
      headers: notFoundRenderRequestHeaders(input.requestHeaders, input.card),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    const text = await rendered.text();
    if (input.accept(text)) {
      body = text;
      source = rendered.headers;
    }
  } catch {
    console.error(input.failureLog);
  }
  return {
    status: LINK_MISS_STATUS,
    body: input.method === "HEAD" ? null : body,
    headers: linkMissResponseHeaders(source),
  };
}

export async function loadLinkMissDocument(input: {
  requestUrl: string;
  requestHeaders: Headers;
  method: string;
  fetchImpl?: LinkMissFetch;
}): Promise<NotFoundDocument> {
  return loadNotFoundDocument({
    ...input,
    card: "link",
    fallback: linkMissFallbackHtml(),
    accept: isBrandedLinkMissDocument,
    failureLog: "[gcfieldlog] link card render failed",
  });
}

/** Direct /_not-found. Same finished 404, with the page card instead of the link card. */
export async function loadPageNotFoundDocument(input: {
  requestUrl: string;
  requestHeaders: Headers;
  method: string;
  fetchImpl?: LinkMissFetch;
}): Promise<NotFoundDocument> {
  return loadNotFoundDocument({
    ...input,
    card: "page",
    fallback: pageNotFoundFallbackHtml(),
    accept: isBrandedPageNotFoundDocument,
    failureLog: "[gcfieldlog] page card render failed",
  });
}
