import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { API_NOT_FOUND_BODY, apiNotFoundResponse } from "./apiNotFound.ts";
import { packPageFound } from "./packPageFound.ts";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

function readRepo(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function walkRoutes(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      walkRoutes(full, out);
      continue;
    }
    if (name === "route.ts") out.push(full);
  }
  return out;
}

test("unknown API paths return JSON 404 for every method", async () => {
  for (const method of METHODS) {
    const response = apiNotFoundResponse();
    assert.equal(response.status, 404, method);
    const type = response.headers.get("content-type") ?? "";
    assert.match(type, /^application\/json\b/, method);
    assert.deepEqual(await response.json(), API_NOT_FOUND_BODY);
    assert.deepEqual(API_NOT_FOUND_BODY, { ok: false, error: "not_found" });
  }

  const route = readRepo("app/api/[...slug]/route.ts");
  for (const method of METHODS) {
    assert.match(route, new RegExp(`export const ${method} = unknownApi`));
  }
  assert.match(route, /apiNotFoundResponse/);
  assert.doesNotMatch(route, /<html|text\/html/);
});

test("the API catch-all does not replace existing route files", () => {
  const root = new URL("../app/api", import.meta.url);
  const routes = walkRoutes(root.pathname);
  const relative = routes.map((file) => path.relative(root.pathname, file));
  assert.ok(relative.includes(path.join("[...slug]", "route.ts")));
  assert.ok(relative.includes(path.join("procore", "status", "route.ts")));
  assert.ok(relative.includes(path.join("invites", "[token]", "route.ts")));

  const status = readRepo("app/api/procore/status/route.ts");
  assert.match(status, /export async function GET/);
  assert.doesNotMatch(status, /apiNotFound|not_found/);

  for (const file of routes) {
    if (file.includes(`${path.sep}[...slug]${path.sep}`)) continue;
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /apiNotFoundResponse/, file);
  }
});

test("an invalid invite renders the existing card through notFound", () => {
  const page = readRepo("app/invite/[token]/page.tsx");
  const missing = readRepo("app/invite/[token]/not-found.tsx");
  const form = readRepo("components/InviteRedeemForm.tsx");

  assert.match(page, /if \(preview\.status === "not_found"\) notFound\(\)/);
  assert.equal((page.match(/notFound\(/g) ?? []).length, 1);
  assert.match(page, /inviteAcceptPath/);
  assert.match(page, /InviteRedeemForm/);
  assert.doesNotMatch(page, /status === "expired"\) notFound/);
  assert.doesNotMatch(page, /status === "used"\) notFound/);

  assert.match(missing, /variant="link"/);
  assert.match(missing, /FieldNotFoundPage/);
  assert.doesNotMatch(missing, /InviteBlockedCard/);
  assert.match(form, /Hear this/);
  assert.match(form, /invite-blocked/);
  assert.match(form, /export function InviteBlockedCard/);
  assert.match(readRepo("lib/authMessages.ts"), /Invite not found/);
  assert.match(readRepo("lib/fieldLinkResponse.ts"), /\/_not-found/);
  assert.match(readRepo("lib/fieldLinkResponse.ts"), /LINK_MISS_STATUS = 404/);
  assert.doesNotMatch(readRepo("proxy.ts"), /NextResponse\.rewrite\(/);
  assert.match(readRepo("lib/fieldLinkLookup.ts"), /status === "not_found"/);
});

test("a substituted sample for a non-demo pack id is not found", () => {
  const sample = {
    demoFallback: true,
    pack: { request_id: "maple-point" },
  };
  assert.equal(packPageFound({ requestId: "maple-point", live: sample }), true);
  assert.equal(packPageFound({ requestId: "maple-point-733", live: sample }), true);
  assert.equal(packPageFound({ requestId: "cedar-ridge", live: sample }), true);
  assert.equal(packPageFound({ requestId: "cedar-ridge-200", live: sample }), true);
  assert.equal(packPageFound({ requestId: "harbor-view-3", live: sample }), true);
  assert.equal(packPageFound({ requestId: "bad", live: sample }), false);
  assert.equal(packPageFound({ requestId: "not-a-pack", live: sample }), false);
  assert.equal(packPageFound({ requestId: "bad", live: null }), false);
  assert.equal(
    packPageFound({
      requestId: "custom-pack",
      live: { demoFallback: true, pack: { request_id: "custom-pack" } },
    }),
    true,
  );
  assert.equal(
    packPageFound({
      requestId: "live-row",
      live: { demoFallback: false, pack: { request_id: "live-row" } },
    }),
    true,
  );

  for (const file of [
    "app/pack/[requestId]/page.tsx",
    "app/pack/[requestId]/[...slug]/page.tsx",
    "app/pack/[requestId]/materials/page.tsx",
    "app/pack/[requestId]/rfi/new/page.tsx",
  ]) {
    const text = readRepo(file);
    assert.match(text, /packPageFound/, file);
    assert.match(text, /notFound\(\)/, file);
  }

  const card = readRepo("app/pack/[requestId]/not-found.tsx");
  assert.match(card, /variant="link"/);
  assert.match(readRepo("components/FieldNotFound.tsx"), /Hear this/);
  assert.match(readRepo("app/jobs/[projectSlug]/page.tsx"), /if \(!job\) notFound\(\)/);
  assert.match(readRepo("app/not-found.tsx"), /"page"/);
});
