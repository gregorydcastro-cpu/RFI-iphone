import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  DEMO_JOBS,
  getJob,
  jobFromPack,
  jobFromProjectName,
  resolvePullJob,
  slugFromProjectName,
} from "./jobs.ts";
import { parseProjectAllowlist } from "./procoreAllowlist.ts";
import type { RoomPack } from "./pack.ts";

const previous = {
  PROCORE_PROJECT_ALLOWLIST: process.env.PROCORE_PROJECT_ALLOWLIST,
};

afterEach(() => {
  if (previous.PROCORE_PROJECT_ALLOWLIST === undefined) {
    delete process.env.PROCORE_PROJECT_ALLOWLIST;
  } else {
    process.env.PROCORE_PROJECT_ALLOWLIST = previous.PROCORE_PROJECT_ALLOWLIST;
  }
});

test("demo catalog still resolves Maple Point by slug", () => {
  const maple = getJob("maple-point");
  assert.equal(maple?.name, "Maple Point Medical Office");
  assert.equal(DEMO_JOBS.some((job) => job.slug === "maple-point"), true);
});

test("allowlist env adds live jobs without hardcoding a company id", () => {
  delete process.env.PROCORE_PROJECT_ALLOWLIST;
  assert.equal(getJob("danoff-high-school"), undefined);

  process.env.PROCORE_PROJECT_ALLOWLIST = "Danoff High School, Suffolk Campus";
  const danoff = getJob("danoff-high-school");
  assert.equal(danoff?.name, "Danoff High School");
  assert.equal(danoff?.slug, "danoff-high-school");
  assert.equal(getJob("suffolk-campus")?.name, "Suffolk Campus");
});

test("resolvePullJob uses exact name, cached pack, or demo slug", () => {
  const fromName = resolvePullJob({ projectName: "Danoff High School" });
  assert.equal(fromName?.name, "Danoff High School");
  assert.equal(fromName?.slug, slugFromProjectName("Danoff High School"));

  const maple = resolvePullJob({
    projectSlug: "maple-point",
    requestId: "maple-point-733",
  });
  assert.equal(maple?.name, "Maple Point Medical Office");

  const pack = {
    project: { id: "p1", name: "Suffolk Campus", slug: "suffolk-campus" },
    request_id: "sample-arch-bounds-733",
  } as RoomPack;
  const fromPack = jobFromPack(pack);
  assert.equal(fromPack?.name, "Suffolk Campus");
  assert.equal(
    resolvePullJob({ requestId: "sample-arch-bounds-733", pack })?.name,
    "Suffolk Campus",
  );
  assert.equal(jobFromProjectName("  Danoff High School  ").name, "Danoff High School");
});

test("allowlist parser splits comma / newline / pipe", () => {
  assert.deepEqual(parseProjectAllowlist("Danoff High School | Suffolk Campus"), [
    "Danoff High School",
    "Suffolk Campus",
  ]);
  assert.deepEqual(parseProjectAllowlist(""), []);
});
