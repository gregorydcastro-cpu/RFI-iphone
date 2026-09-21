import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseProjectAllowlist,
  parseProcoreProjectAllowlist,
} from "./procoreAllowlist.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

test("parseProcoreProjectAllowlist is the existing allowlist parser", () => {
  const raw = "Maple Point Medical Office | Cedar Ridge Outpatient";
  assert.equal(parseProcoreProjectAllowlist, parseProjectAllowlist);
  assert.deepEqual(parseProcoreProjectAllowlist(raw), parseProjectAllowlist(raw));
});

test("parseProcoreProjectAllowlist splits comma, newline, and pipe", () => {
  assert.deepEqual(
    parseProcoreProjectAllowlist(
      "Maple Point Medical Office, Cedar Ridge Outpatient",
    ),
    ["Maple Point Medical Office", "Cedar Ridge Outpatient"],
  );
  assert.deepEqual(
    parseProcoreProjectAllowlist(
      "Maple Point Medical Office\nCedar Ridge Outpatient\nHarbor View Tenant Fit-Out",
    ),
    [
      "Maple Point Medical Office",
      "Cedar Ridge Outpatient",
      "Harbor View Tenant Fit-Out",
    ],
  );
  assert.deepEqual(
    parseProcoreProjectAllowlist(
      "Maple Point Medical Office | Cedar Ridge Outpatient",
    ),
    ["Maple Point Medical Office", "Cedar Ridge Outpatient"],
  );
});

test("unset, blank, and duplicate names become an empty or deduped list", () => {
  assert.deepEqual(parseProcoreProjectAllowlist(undefined), []);
  assert.deepEqual(parseProcoreProjectAllowlist(null), []);
  assert.deepEqual(parseProcoreProjectAllowlist(""), []);
  assert.deepEqual(parseProcoreProjectAllowlist("  \n , | "), []);
  assert.deepEqual(
    parseProcoreProjectAllowlist(
      "Cedar Ridge Outpatient, cedar ridge outpatient",
    ),
    ["Cedar Ridge Outpatient"],
  );
  const names = parseProcoreProjectAllowlist(
    "Maple Point Medical Office, Cedar Ridge Outpatient, Harbor View Tenant Fit-Out, Pine Hollow Warehouse",
  );
  assert.equal(forbidden.test(names.join("\n")), false);
});
