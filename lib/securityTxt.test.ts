import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SECURITY_TXT_CANONICAL,
  SECURITY_TXT_COMMENT,
  SECURITY_TXT_CONTACT,
  SECURITY_TXT_EXPIRES,
  securityTxtBody,
} from "./securityTxt.ts";

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("security.txt is an RFC 9116 placeholder with no email", () => {
  const body = securityTxtBody();
  assert.equal(
    body,
    [
      "# FOR GREG'S REVIEW: replace Contact with the real security contact",
      "Contact: https://www.gcfieldlog.com/support",
      "Expires: 2027-10-09T00:00:00.000Z",
      "Canonical: https://www.gcfieldlog.com/.well-known/security.txt",
      "Preferred-Languages: en",
      "",
    ].join("\n"),
  );
  assert.equal(SECURITY_TXT_COMMENT, body.split("\n")[0]);
  assert.equal(SECURITY_TXT_CONTACT, "https://www.gcfieldlog.com/support");
  assert.equal(SECURITY_TXT_EXPIRES, "2027-10-09T00:00:00.000Z");
  assert.equal(
    SECURITY_TXT_CANONICAL,
    "https://www.gcfieldlog.com/.well-known/security.txt",
  );
  assert.doesNotMatch(body, EMAIL_RE);
  assert.doesNotMatch(body, /mailto:/i);
  assert.match(body, /^Contact: https:\/\/www\.gcfieldlog\.com\/support$/m);
  assert.match(body, /^Expires: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/m);
  assert.match(body, /^Preferred-Languages: en$/m);

  const route = readRepo("app/.well-known/security.txt/route.ts");
  assert.match(route, /securityTxtBody/);
  assert.match(route, /text\/plain/);
  assert.match(route, /status:\s*200/);
  assert.doesNotMatch(route, /mailto:/);
});
