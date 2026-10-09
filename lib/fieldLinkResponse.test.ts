import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FIELD_LINK_MISS,
  FIELD_NOT_FOUND_HEADER,
  LINK_NOT_FOUND_MESSAGE,
  LINK_NOT_FOUND_TITLE,
  PAGE_NOT_FOUND_MESSAGE,
  PAGE_NOT_FOUND_TITLE,
} from "./fieldNotFound.ts";
import {
  LINK_MISS_RENDER_HEADER,
  LINK_MISS_STATUS,
  isBrandedLinkMissDocument,
  isBrandedPageNotFoundDocument,
  isDirectNotFoundRequest,
  isLinkMissRender,
  linkMissFallbackHtml,
  linkMissPassThroughHeaders,
  linkMissRenderRequestHeaders,
  linkMissRenderUrl,
  linkMissResponseHeaders,
  loadLinkMissDocument,
  loadPageNotFoundDocument,
  pageNotFoundFallbackHtml,
  pageNotFoundRenderRequestHeaders,
  stripFieldNotFoundHeader,
} from "./fieldLinkResponse.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const BRANDED = linkMissFallbackHtml();

test("the link-miss fallback is the branded card at HTTP 404", () => {
  assert.equal(LINK_MISS_STATUS, 404);
  assert.equal(isBrandedLinkMissDocument(BRANDED), true);
  assert.match(BRANDED, /<html lang="en">/);
  assert.match(BRANDED, new RegExp(LINK_NOT_FOUND_TITLE));
  assert.match(BRANDED, new RegExp(LINK_NOT_FOUND_MESSAGE));
  assert.match(BRANDED, /<a href="\/">Home<\/a>/);
  assert.match(BRANDED, /<a href="\/pack\/maple-point">Open Maple Point demo<\/a>/);
  assert.match(BRANDED, /Hear this/);
  assert.match(BRANDED, /noindex/);
  assert.doesNotMatch(BRANDED, /__next_error__/);
  assert.equal(isBrandedLinkMissDocument('<html id="__next_error__"></html>'), false);
  assert.equal(isBrandedLinkMissDocument("<html><h1>Page not found</h1></html>"), false);
});

test("a 200 /_not-found render is returned as a finished HTTP 404", async () => {
  let called: { url: string; init?: RequestInit } | null = null;
  const result = await loadLinkMissDocument({
    requestUrl: "https://www.gcfieldlog.com/invite/not-a-real-token?x=1#section",
    requestHeaders: new Headers({
      host: "www.gcfieldlog.com",
      cookie: "a=b",
      rsc: "1",
      accept: "text/x-component",
      "x-middleware-subrequest": "proxy",
    }),
    method: "GET",
    fetchImpl: async (url, init) => {
      called = { url, init };
      return new Response(BRANDED, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-encoding": "gzip",
          "content-length": "999",
          "x-middleware-rewrite": "https://www.gcfieldlog.com/_not-found",
          "set-cookie": "session=1; Path=/",
        },
      });
    },
  });

  assert.equal(result.status, 404);
  assert.equal(called?.url, "https://www.gcfieldlog.com/_not-found");
  const sent = new Headers(called?.init?.headers);
  assert.equal(sent.get("host"), null);
  assert.equal(sent.get("rsc"), null);
  assert.equal(sent.get("x-middleware-subrequest"), null);
  assert.equal(sent.get("accept"), "text/html");
  assert.equal(sent.get("cookie"), "a=b");
  assert.equal(sent.get(FIELD_NOT_FOUND_HEADER), FIELD_LINK_MISS);
  assert.equal(sent.get(LINK_MISS_RENDER_HEADER), "1");
  assert.equal(called?.init?.redirect, "manual");
  assert.equal(result.body, BRANDED);
  assert.equal(result.headers.get("content-encoding"), null);
  assert.equal(result.headers.get("content-length"), null);
  assert.equal(result.headers.get("x-middleware-rewrite"), null);
  assert.equal(result.headers.get("content-type"), "text/html; charset=utf-8");
  assert.match(result.headers.get("cache-control") ?? "", /no-store/);
  assert.match(result.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.match(result.headers.get("x-content-type-options") ?? "", /nosniff/);
  assert.equal(result.headers.get("set-cookie"), "session=1; Path=/");
});

test("HEAD still returns 404 and a failed render uses the fallback card", async () => {
  const head = await loadLinkMissDocument({
    requestUrl: "https://www.gcfieldlog.com/pack/missing",
    requestHeaders: new Headers(),
    method: "HEAD",
    fetchImpl: async () => new Response(BRANDED, { status: 200 }),
  });
  assert.equal(head.status, 404);
  assert.equal(head.body, null);

  const shell = await loadLinkMissDocument({
    requestUrl: "https://www.gcfieldlog.com/invite/bad",
    requestHeaders: new Headers(),
    method: "GET",
    fetchImpl: async () =>
      new Response('<html id="__next_error__" lang="en"></html>', { status: 404 }),
  });
  assert.equal(shell.status, 404);
  assert.equal(shell.body, BRANDED);
  assert.doesNotMatch(shell.body ?? "", /__next_error__/);

  const failed = await loadLinkMissDocument({
    requestUrl: "https://www.gcfieldlog.com/pack/bad/sheets",
    requestHeaders: new Headers(),
    method: "GET",
    fetchImpl: async () => {
      throw new Error("down");
    },
  });
  assert.equal(failed.status, 404);
  assert.equal(isBrandedLinkMissDocument(failed.body ?? ""), true);
});

test("only the internal /_not-found render may keep the link marker", () => {
  const marked = new Headers({
    [LINK_MISS_RENDER_HEADER]: "1",
    [FIELD_NOT_FOUND_HEADER]: FIELD_LINK_MISS,
  });
  assert.equal(isLinkMissRender("/_not-found", marked), true);
  assert.equal(isLinkMissRender("/_not-found/", marked), true);
  assert.equal(isLinkMissRender("/invite/bad", marked), false);
  assert.equal(isLinkMissRender("/pack/bad", marked), false);
  assert.equal(isLinkMissRender("/nope", marked), false);

  const passed = linkMissPassThroughHeaders(marked);
  assert.equal(passed.get(LINK_MISS_RENDER_HEADER), null);
  assert.equal(passed.get(FIELD_NOT_FOUND_HEADER), FIELD_LINK_MISS);

  const spoofed = linkMissPassThroughHeaders(
    new Headers({
      [LINK_MISS_RENDER_HEADER]: "1",
      [FIELD_NOT_FOUND_HEADER]: "page",
    }),
  );
  assert.equal(spoofed.get(FIELD_NOT_FOUND_HEADER), null);

  const stripped = stripFieldNotFoundHeader(
    new Headers({
      [FIELD_NOT_FOUND_HEADER]: FIELD_LINK_MISS,
      [LINK_MISS_RENDER_HEADER]: "1",
      cookie: "a=b",
    }),
  );
  assert.equal(stripped.get(FIELD_NOT_FOUND_HEADER), null);
  assert.equal(stripped.get(LINK_MISS_RENDER_HEADER), null);
  assert.equal(stripped.get("cookie"), "a=b");

  assert.equal(
    linkMissRenderUrl("http://localhost:3000/pack/bad/materials?room=1"),
    "http://localhost:3000/_not-found",
  );
  const sent = linkMissRenderRequestHeaders(new Headers({ host: "localhost" }));
  assert.equal(sent.get("host"), null);
  assert.equal(sent.get(FIELD_NOT_FOUND_HEADER), FIELD_LINK_MISS);
});

test("response headers from a not-found render cannot keep a rewrite", () => {
  const headers = linkMissResponseHeaders(
    new Headers({
      "content-type": "text/html; charset=utf-8",
      "x-middleware-next": "1",
      "x-middleware-rewrite": "/_not-found",
      "content-encoding": "br",
    }),
  );
  assert.equal(headers.get("x-middleware-rewrite"), null);
  assert.equal(headers.get("x-middleware-next"), null);
  assert.equal(headers.get("content-encoding"), null);
  assert.match(headers.get("content-security-policy") ?? "", /frame-ancestors/);
});

test("the proxy returns that finished 404 and does not rewrite", () => {
  const proxy = readRepo("proxy.ts");
  const helper = readRepo("lib/fieldLinkResponse.ts");
  assert.match(proxy, /loadLinkMissDocument/);
  assert.match(proxy, /loadPageNotFoundDocument/);
  assert.match(proxy, /status:\s*document\.status/);
  assert.match(proxy, /missingFieldLink/);
  assert.match(proxy, /isLinkMissRender/);
  assert.match(proxy, /isDirectNotFoundRequest/);
  assert.match(proxy, /stripFieldNotFoundHeader/);
  assert.doesNotMatch(proxy, /NextResponse\.rewrite\(/);
  assert.doesNotMatch(proxy, /redirect/);
  assert.match(helper, /LINK_MISS_STATUS = 404/);
  assert.match(helper, /\/_not-found/);
  const passThrough = proxy.indexOf("if (isLinkMissRender(");
  const direct = proxy.indexOf("if (isDirectNotFoundRequest(");
  assert.ok(passThrough >= 0 && direct > passThrough);
  assert.doesNotMatch(readRepo("app/api/[...slug]/route.ts"), /loadLinkMissDocument|_not-found/);
});

const PAGE = pageNotFoundFallbackHtml();

test("the page-not-found fallback is the branded page card at HTTP 404", () => {
  assert.equal(isBrandedPageNotFoundDocument(PAGE), true);
  assert.equal(isBrandedLinkMissDocument(PAGE), false);
  assert.equal(isBrandedPageNotFoundDocument(BRANDED), false);
  assert.match(PAGE, /<html lang="en">/);
  assert.match(PAGE, /<h1>Page not found<\/h1>/);
  assert.ok(PAGE.includes(PAGE_NOT_FOUND_TITLE));
  assert.ok(PAGE.includes(PAGE_NOT_FOUND_MESSAGE));
  assert.match(PAGE, /<a href="\/">Home<\/a>/);
  assert.match(PAGE, /<a href="\/pack\/maple-point">Open Maple Point demo<\/a>/);
  assert.match(PAGE, /Hear this/);
  assert.match(PAGE, /noindex/);
  assert.doesNotMatch(PAGE, /__next_error__/);
  assert.doesNotMatch(PAGE, /Link not found/);
  assert.equal(isBrandedPageNotFoundDocument('<html id="__next_error__" lang="en"><h1>Page not found</h1></html>'), false);
});

test("a direct /_not-found render is returned as a finished HTTP 404", async () => {
  let called: { url: string; init?: RequestInit } | null = null;
  const result = await loadPageNotFoundDocument({
    requestUrl: "https://www.gcfieldlog.com/_not-found/?from=browser#top",
    requestHeaders: new Headers({
      host: "www.gcfieldlog.com",
      cookie: "a=b",
      rsc: "1",
      accept: "text/x-component",
      "x-middleware-subrequest": "proxy",
      [FIELD_NOT_FOUND_HEADER]: FIELD_LINK_MISS,
      [LINK_MISS_RENDER_HEADER]: "1",
    }),
    method: "GET",
    fetchImpl: async (url, init) => {
      called = { url, init };
      return new Response(PAGE, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-encoding": "gzip",
          "x-middleware-rewrite": "https://www.gcfieldlog.com/_not-found",
        },
      });
    },
  });

  assert.equal(result.status, 404);
  assert.equal(called?.url, "https://www.gcfieldlog.com/_not-found");
  const sent = new Headers(called?.init?.headers);
  assert.equal(sent.get("host"), null);
  assert.equal(sent.get("rsc"), null);
  assert.equal(sent.get("x-middleware-subrequest"), null);
  assert.equal(sent.get("accept"), "text/html");
  assert.equal(sent.get("cookie"), "a=b");
  assert.equal(sent.get(FIELD_NOT_FOUND_HEADER), null);
  assert.equal(sent.get(LINK_MISS_RENDER_HEADER), "1");
  assert.equal(isLinkMissRender("/_not-found", sent), true);
  assert.equal(isDirectNotFoundRequest("/_not-found", sent), false);
  assert.equal(isDirectNotFoundRequest("/_not-found/", sent), false);
  assert.equal(result.body, PAGE);
  assert.match(result.body ?? "", /Page not found/);
  assert.doesNotMatch(result.body ?? "", /Link not found/);
  assert.equal(result.headers.get("x-middleware-rewrite"), null);
  assert.match(result.headers.get("x-robots-tag") ?? "", /noindex/);
});

test("HEAD /_not-found stays 404 and a bad render uses the page card", async () => {
  const head = await loadPageNotFoundDocument({
    requestUrl: "https://www.gcfieldlog.com/_not-found/",
    requestHeaders: new Headers(),
    method: "HEAD",
    fetchImpl: async () => new Response(PAGE, { status: 200 }),
  });
  assert.equal(head.status, 404);
  assert.equal(head.body, null);

  const linkCard = await loadPageNotFoundDocument({
    requestUrl: "https://www.gcfieldlog.com/_not-found",
    requestHeaders: new Headers(),
    method: "GET",
    fetchImpl: async () => new Response(BRANDED, { status: 200 }),
  });
  assert.equal(linkCard.body, PAGE);
  assert.doesNotMatch(linkCard.body ?? "", /Link not found/);

  const shell = await loadPageNotFoundDocument({
    requestUrl: "https://www.gcfieldlog.com/_not-found",
    requestHeaders: new Headers(),
    method: "GET",
    fetchImpl: async () =>
      new Response('<html id="__next_error__" lang="en"><h1>Page not found</h1></html>', {
        status: 200,
      }),
  });
  assert.equal(shell.status, 404);
  assert.equal(shell.body, PAGE);
  assert.doesNotMatch(shell.body ?? "", /__next_error__/);

  const failed = await loadPageNotFoundDocument({
    requestUrl: "https://www.gcfieldlog.com/_not-found///",
    requestHeaders: new Headers(),
    method: "GET",
    fetchImpl: async () => {
      throw new Error("down");
    },
  });
  assert.equal(failed.status, 404);
  assert.equal(isBrandedPageNotFoundDocument(failed.body ?? ""), true);
});

test("a direct /_not-found request is not the internal render", () => {
  const bare = new Headers();
  assert.equal(isDirectNotFoundRequest("/_not-found", bare), true);
  assert.equal(isDirectNotFoundRequest("/_not-found/", bare), true);
  assert.equal(isDirectNotFoundRequest("/_not-found///", bare), true);
  assert.equal(isDirectNotFoundRequest("/nope", bare), false);
  assert.equal(isDirectNotFoundRequest("/invite/bad", bare), false);
  assert.equal(isDirectNotFoundRequest("/pack/bad", bare), false);
  assert.equal(isDirectNotFoundRequest("/", bare), false);

  const internal = pageNotFoundRenderRequestHeaders(new Headers({ host: "localhost" }));
  assert.equal(internal.get(LINK_MISS_RENDER_HEADER), "1");
  assert.equal(internal.get(FIELD_NOT_FOUND_HEADER), null);
  assert.equal(internal.get("host"), null);
  assert.equal(isLinkMissRender("/_not-found", internal), true);
  assert.equal(isLinkMissRender("/_not-found/", internal), true);
  assert.equal(isDirectNotFoundRequest("/_not-found", internal), false);
  assert.equal(isDirectNotFoundRequest("/_not-found/", internal), false);

  const linkHeaders = linkMissRenderRequestHeaders(new Headers());
  assert.equal(linkHeaders.get(FIELD_NOT_FOUND_HEADER), FIELD_LINK_MISS);
  assert.equal(isDirectNotFoundRequest("/_not-found", linkHeaders), false);
});
