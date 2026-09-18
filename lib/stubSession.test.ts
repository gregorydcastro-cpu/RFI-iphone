import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyHttpCookies,
  cookieDomainFromHost,
  cookieWritesForDomain,
  PRODUCTION_COOKIE_DOMAIN,
  readCookieValue,
  safeNextPath,
  serializeHttpCookie,
  type HttpCookieOptions,
} from "./auth.ts";
import {
  createStubSession,
  parseStubSession,
  parseStubSessionFromCookieHeader,
  serializeStubSession,
  STUB_SESSION_COOKIE,
  stubSessionCookieWrites,
} from "./stubSession.ts";

test("safeNextPath allows only same-origin relative paths", () => {
  assert.equal(safeNextPath("/share"), "/share");
  assert.equal(safeNextPath("/jobs"), "/jobs");
  assert.equal(safeNextPath("//evil.example"), "/jobs");
  assert.equal(safeNextPath("https://evil.example"), "/jobs");
  assert.equal(safeNextPath("/share://x"), "/jobs");
  assert.equal(safeNextPath(null), "/jobs");
});

test("cookieDomainFromHost covers apex and www only", () => {
  assert.equal(cookieDomainFromHost("gcfieldlog.com"), PRODUCTION_COOKIE_DOMAIN);
  assert.equal(cookieDomainFromHost("www.gcfieldlog.com"), PRODUCTION_COOKIE_DOMAIN);
  assert.equal(cookieDomainFromHost("WWW.GCFIELDLOG.COM:443"), PRODUCTION_COOKIE_DOMAIN);
  assert.equal(cookieDomainFromHost("localhost"), undefined);
  assert.equal(cookieDomainFromHost("localhost:3000"), undefined);
  assert.equal(
    cookieDomainFromHost("gc-field-log-git-main.vercel.app"),
    undefined,
  );
  assert.equal(cookieDomainFromHost("evilgcfieldlog.com"), undefined);
});

test("parseStubSession accepts JSON and percent-encoded JSON", () => {
  const session = createStubSession({
    email: "mike@maple.example",
    role: "puller",
  });
  const json = serializeStubSession(session);
  assert.deepEqual(parseStubSession(json), session);
  assert.deepEqual(parseStubSession(encodeURIComponent(json)), session);
  assert.equal(parseStubSession(undefined), null);
  assert.equal(parseStubSession("{not-json"), null);
});

test("parseStubSessionFromCookieHeader reads encoded httpOnly cookie", () => {
  const session = createStubSession({
    email: "mike@maple.example",
    role: "puller",
  });
  const encoded = encodeURIComponent(serializeStubSession(session));
  const header = `${STUB_SESSION_COOKIE}=${encoded}; Path=/`;
  assert.deepEqual(parseStubSessionFromCookieHeader(header), session);
  assert.equal(
    readCookieValue(header, STUB_SESSION_COOKIE),
    serializeStubSession(session),
  );
});

test("production stub cookie is httpOnly Path=/ Domain=gcfieldlog.com", () => {
  const session = createStubSession({
    email: "mike@maple.example",
    role: "puller",
  });
  const writes = stubSessionCookieWrites(session, true, PRODUCTION_COOKIE_DOMAIN);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.domain, PRODUCTION_COOKIE_DOMAIN);
  assert.equal(writes[0]?.httpOnly, true);
  assert.equal(writes[0]?.path, "/");
  assert.equal(writes[0]?.sameSite, "lax");
  assert.equal(writes[0]?.secure, true);
  assert.ok((writes[0]?.maxAge ?? 0) > 0);

  const header = serializeHttpCookie(writes[0]!);
  assert.match(header, /Path=\//);
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Secure/);
  assert.match(header, /Domain=gcfieldlog.com/);
  assert.match(header, /gcfieldlog_stub_user=/);
});

test("parseStubSessionFromCookieHeader skips empty host-only leftovers", () => {
  const session = createStubSession({
    email: "mike@maple.example",
    role: "puller",
  });
  const encoded = encodeURIComponent(serializeStubSession(session));
  const header = `${STUB_SESSION_COOKIE}=; ${STUB_SESSION_COOKIE}=${encoded}`;
  assert.deepEqual(parseStubSessionFromCookieHeader(header), session);
});

test("applyHttpCookies sets the live cookie via cookies.set", () => {
  const set: HttpCookieOptions[] = [];
  const appended: string[] = [];
  const live: HttpCookieOptions = {
    name: STUB_SESSION_COOKIE,
    value: '{"email":"mike@maple.example","role":"puller","userId":"stub:x"}',
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60,
    secure: true,
    domain: PRODUCTION_COOKIE_DOMAIN,
  };
  applyHttpCookies(
    {
      cookies: { set(options) { set.push(options); } },
      headers: { append(_name, value) { appended.push(value); } },
    },
    [live],
  );
  assert.equal(set.length, 1);
  assert.equal(set[0], live);
  assert.equal(appended.length, 0);
});

test("localhost stub cookie stays host-only", () => {
  const session = createStubSession({
    email: "pat@maple.example",
    role: "viewer",
  });
  const writes = stubSessionCookieWrites(session, false, undefined);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.domain, undefined);
  const header = serializeHttpCookie(writes[0]!);
  assert.doesNotMatch(header, /Domain=/);
});

test("logout expires host-only and Domain cookies", () => {
  const writes = cookieWritesForDomain(
    {
      name: STUB_SESSION_COOKIE,
      value: "",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 0,
      secure: true,
    },
    PRODUCTION_COOKIE_DOMAIN,
  );
  assert.equal(writes.length, 2);
  assert.equal(writes[0]?.domain, undefined);
  assert.equal(writes[1]?.domain, PRODUCTION_COOKIE_DOMAIN);
  assert.ok(writes.every((cookie) => cookie.maxAge === 0));
});
