import {
  FIELD_LINK_MISS,
  FIELD_NOT_FOUND_HEADER,
  HOME_HREF,
  HOME_LABEL,
  LINK_NOT_FOUND_MESSAGE,
  LINK_NOT_FOUND_TITLE,
  MAPLE_POINT_DEMO_HREF,
  MAPLE_POINT_DEMO_LABEL,
} from "./fieldNotFound.ts";
import { SECURITY_HEADERS } from "./securityHeaders.ts";

/**
 * Internal fetch of the root not-found page. Only that render may keep
 * the link marker. A client cannot use this header to skip the 404 on
 * /invite or /pack — those paths never take the pass-through branch.
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
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
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

export function isLinkMissRender(pathname: string, headers: Headers): boolean {
  return (
    normalizePath(pathname) === "/_not-found" &&
    headers.get(LINK_MISS_RENDER_HEADER) === "1"
  );
}

/** Headers for the internal document render. Forces HTML, keeps cookies. */
export function linkMissRenderRequestHeaders(requestHeaders: Headers): Headers {
  const headers = new Headers(requestHeaders);
  for (const name of REQUEST_HEADER_BLOCKLIST) headers.delete(name);
  for (const name of DOCUMENT_HEADER_BLOCKLIST) headers.delete(name);
  headers.delete(FIELD_NOT_FOUND_HEADER);
  headers.delete(LINK_MISS_RENDER_HEADER);
  headers.set(FIELD_NOT_FOUND_HEADER, FIELD_LINK_MISS);
  headers.set(LINK_MISS_RENDER_HEADER, "1");
  headers.set("accept", "text/html");
  return headers;
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

export function linkMissFallbackHtml(): string {
  return (
    `<!DOCTYPE html><html lang="en"><head>` +
    `<meta charset="utf-8">` +
    `<meta name="robots" content="noindex, nofollow">` +
    `<title>${LINK_NOT_FOUND_TITLE}</title>` +
    `</head><body><main>` +
    `<h1>${LINK_NOT_FOUND_TITLE}</h1>` +
    `<p>${LINK_NOT_FOUND_MESSAGE}</p>` +
    `<a href="${HOME_HREF}">${HOME_LABEL}</a>` +
    `<a href="${MAPLE_POINT_DEMO_HREF}">${MAPLE_POINT_DEMO_LABEL}</a>` +
    `<button type="button">Hear this</button>` +
    `</main></body></html>`
  );
}

/** True when the raw HTML is the #97 link card, not the __next_error__ shell. */
export function isBrandedLinkMissDocument(html: string): boolean {
  if (!html.includes("<html") || !html.includes('lang="en"')) return false;
  if (!html.includes(LINK_NOT_FOUND_TITLE)) return false;
  if (!html.includes(LINK_NOT_FOUND_MESSAGE)) return false;
  if (!html.includes('href="/"')) return false;
  if (!html.includes(`href="${MAPLE_POINT_DEMO_HREF}"`)) return false;
  if (!html.includes("Hear this")) return false;
  if (!/noindex/i.test(html)) return false;
  if (html.includes("__next_error__")) return false;
  return true;
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

/**
 * Load the root not-found document and force HTTP 404.
 * A rewrite to /_not-found stays 200 on Vercel because that page render
 * is a successful match. The status has to be set on this finished response.
 */
export async function loadLinkMissDocument(input: {
  requestUrl: string;
  requestHeaders: Headers;
  method: string;
  fetchImpl?: LinkMissFetch;
}): Promise<{ status: typeof LINK_MISS_STATUS; body: string | null; headers: Headers }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = linkMissRenderUrl(input.requestUrl);
  let body = linkMissFallbackHtml();
  let source = new Headers({ "content-type": "text/html; charset=utf-8" });
  try {
    const rendered = await fetchImpl(url, {
      method: "GET",
      headers: linkMissRenderRequestHeaders(input.requestHeaders),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    const text = await rendered.text();
    if (isBrandedLinkMissDocument(text)) {
      body = text;
      source = rendered.headers;
    }
  } catch {
    console.error("[gcfieldlog] link card render failed");
  }
  return {
    status: LINK_MISS_STATUS,
    body: input.method === "HEAD" ? null : body,
    headers: linkMissResponseHeaders(source),
  };
}
