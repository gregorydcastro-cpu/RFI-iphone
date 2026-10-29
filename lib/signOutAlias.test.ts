import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sessionExitLocation } from "./authMessages.ts";
import { SIGN_OUT_ALIAS_PATHS, SESSION_LOGOUT_ROUTE } from "./signOutAlias.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const ALIAS_ROUTE = `import { GET as sessionLogoutGet, POST as sessionLogoutPost } from "../api/session/logout/route";

export const dynamic = "force-dynamic";

/** Same Supabase sign-out as /api/session/logout. Signed-out visitors go home too. */
export function GET(request: Request) {
  return sessionLogoutGet(request);
}

export function POST(request: Request) {
  return sessionLogoutPost(request);
}
`;

test("sign-out aliases clear the session with the existing logout route and land on /", () => {
  assert.deepEqual(SIGN_OUT_ALIAS_PATHS, [
    "/logout",
    "/log-out",
    "/sign-out",
    "/signout",
  ]);

  const home = new URL(sessionExitLocation({ origin: "https://www.gcfieldlog.com" }));
  assert.equal(home.pathname, "/");
  assert.equal(home.search, "?signedOut=1");

  const logout = readRepo(SESSION_LOGOUT_ROUTE);
  assert.match(logout, /sessionExitLocation\(/);
  assert.match(logout, /await supabase\.auth\.signOut\(\)/);
  assert.match(logout, /expireSupabaseAuthCookies/);
  assert.match(logout, /expireStubSessionCookie/);
  const guard = logout.indexOf("if (supabase)");
  const clear = logout.indexOf("clearAuthCookies(request, response)");
  const returned = logout.lastIndexOf("return response");
  assert.ok(guard > 0 && clear > guard && returned > clear);

  const config = readRepo("next.config.ts");
  assert.doesNotMatch(config, /\/logout|\/log-out|\/sign-out|\/signout/);
  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(proxy, /\/logout|\/log-out|\/sign-out|\/signout/);

  for (const path of SIGN_OUT_ALIAS_PATHS) {
    const route = readRepo(`app${path}/route.ts`);
    assert.equal(route, ALIAS_ROUTE, path);
    assert.doesNotMatch(route, /createClient|signOut\(|stripe|SUPABASE_/);
  }
});
