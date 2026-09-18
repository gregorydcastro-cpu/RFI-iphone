import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cookieDomainFromHost,
  cookieWritesForDomain,
  PRODUCTION_COOKIE_DOMAIN,
  readCookieValue,
  serializeHttpCookie,
} from "./auth.ts";
import {
  createStubSession,
  parseStubSession,
  parseStubSessionFromCookieHeader,
  serializeStubSession,
  STUB_SESSION_COOKIE,
  stubSessionCookieWrites,
} from "./stubSession.ts";

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
  assert.equal(writes.length, 2);
  assert.equal(writes[0]?.maxAge, 0);
  assert.equal(writes[0]?.domain, undefined);
  assert.equal(writes[1]?.domain, PRODUCTION_COOKIE_DOMAIN);
  assert.equal(writes[1]?.httpOnly, true);
  assert.equal(writes[1]?.path, "/");
  assert.equal(writes[1]?.sameSite, "lax");
  assert.equal(writes[1]?.secure, true);

  const header = serializeHttpCookie(writes[1]!);
  assert.match(header, /Path=\//);
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Secure/);
  assert.match(header, /Domain=gcfieldlog.com/);
  assert.match(header, /gcfieldlog_stub_user=/);
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
