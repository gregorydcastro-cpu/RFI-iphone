import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEMO_JOBS } from "./jobs.ts";
import { allowlistForRestPull } from "./procoreAllowlist.ts";
import {
  assignProjectSlugs,
  collectListedProjects,
  jobFromCatalogOrOwned,
  jobsForSignedInAccount,
  listProcoreProjects,
  NO_PROCORE_PROJECTS_MESSAGE,
  PROCORE_COMPANIES_PATH,
  procoreCompanyHeaders,
  procoreProjectsPath,
  pullJobFromOwned,
  type ListedProcoreProject,
} from "./procoreProjects.ts";
import type { ValidProcoreAccess } from "./procoreToken.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

function access(apiBase: string, loginBase: string): ValidProcoreAccess {
  return {
    config: {
      clientId: "test-client",
      clientSecret: "test-secret",
      loginBase,
      apiBase,
      redirectUri: "https://www.gcfieldlog.com/api/procore/callback",
    },
    accessToken: "access-1",
    refreshed: false,
    secrets: {
      userId: "user-1",
      email: null,
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresAt: "2099-01-01T00:00:00.000Z",
      companyId: null,
      procoreUserId: null,
    },
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("company id is taken from each company, with Procore-Company-Id on projects", async () => {
  const calls: Array<{ url: string; companyHeader: string | null; authorization: string | null }> =
    [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      companyHeader: headers.get("Procore-Company-Id"),
      authorization: headers.get("Authorization"),
    });
    if (url.includes(PROCORE_COMPANIES_PATH)) {
      return json([
        { id: 44110, name: "North Mill Electric" },
        { id: 88220, name: "Cedar Falls Builders" },
      ]);
    }
    if (url.includes("company_id=44110")) {
      return json([
        {
          id: 9001,
          name: "Maple Point Medical Office",
          city: "Cedar Falls",
          stage: "Electrical rough-in",
          project_number: "MP-1",
        },
      ]);
    }
    if (url.includes("company_id=88220")) {
      return json({
        data: [
          {
            id: 9002,
            name: "Cedar Ridge Outpatient",
            address: { city: "North Mill" },
            project_stage: { name: "Overhead MEP" },
          },
        ],
      });
    }
    return json({ message: "unexpected" }, 404);
  };

  try {
    const list = await listProcoreProjects(
      access("https://sandbox.procore.com", "https://login-sandbox.procore.com"),
    );
    assert.equal(list.ok, true);
    if (!list.ok) return;
    assert.deepEqual(
      list.projects.map((project) => ({
        slug: project.slug,
        name: project.name,
        city: project.city,
        phase: project.phase,
        companyId: project.companyId,
        projectId: project.projectId,
        roomsHint: project.roomsHint,
      })),
      [
        {
          slug: "maple-point-medical-office",
          name: "Maple Point Medical Office",
          city: "Cedar Falls",
          phase: "Electrical rough-in",
          companyId: "44110",
          projectId: "9001",
          roomsHint: "MP-1",
        },
        {
          slug: "cedar-ridge-outpatient",
          name: "Cedar Ridge Outpatient",
          city: "North Mill",
          phase: "Overhead MEP",
          companyId: "88220",
          projectId: "9002",
          roomsHint: "",
        },
      ],
    );
  } finally {
    globalThis.fetch = original;
  }

  assert.equal(calls.length, 3);
  assert.match(calls[0]?.url ?? "", /^https:\/\/sandbox\.procore\.com\/rest\/v1\.0\/companies\?/);
  assert.equal(calls[0]?.companyHeader, null);
  assert.equal(calls[0]?.authorization, "Bearer access-1");
  assert.match(calls[1]?.url ?? "", /\/rest\/v1\.0\/projects\?company_id=44110&/);
  assert.equal(calls[1]?.companyHeader, "44110");
  assert.match(calls[2]?.url ?? "", /company_id=88220/);
  assert.equal(calls[2]?.companyHeader, "88220");
  assert.equal(
    calls.some((call) => call.companyHeader && !["44110", "88220"].includes(call.companyHeader)),
    false,
  );
});

test("production API base is the host used for the company walk", async () => {
  const urls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes(PROCORE_COMPANIES_PATH)) return json([]);
    return json([], 404);
  };
  try {
    const list = await listProcoreProjects(
      access("https://api.procore.com", "https://login.procore.com"),
    );
    assert.equal(list.ok, true);
    if (list.ok) assert.deepEqual(list.projects, []);
  } finally {
    globalThis.fetch = original;
  }
  assert.match(urls[0] ?? "", /^https:\/\/api\.procore\.com\/rest\/v1\.0\/companies\?/);
});

test("a 401 refreshes the stored token once and retries with the new access token", async () => {
  const authorizations: string[] = [];
  let companiesHits = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    if (headers.get("Authorization")) authorizations.push(headers.get("Authorization") ?? "");
    if (url.includes("/oauth/token")) {
      return json({
        access_token: "access-2",
        refresh_token: "refresh-2",
        expires_in: 5400,
        token_type: "bearer",
      });
    }
    if (url.includes(PROCORE_COMPANIES_PATH)) {
      companiesHits += 1;
      if (companiesHits === 1) return json({ message: "expired" }, 401);
      return json([{ id: 44110, name: "North Mill Electric" }]);
    }
    if (url.includes("company_id=44110")) {
      return json([
        { id: 700, name: "Harbor View Tenant Fit-Out", city: "West Landing" },
      ]);
    }
    return json({}, 404);
  };
  try {
    const list = await listProcoreProjects(
      access("https://sandbox.procore.com", "https://login-sandbox.procore.com"),
    );
    assert.equal(list.ok, true);
    if (!list.ok) return;
    assert.equal(list.refreshed, true);
    assert.equal(list.projects[0]?.name, "Harbor View Tenant Fit-Out");
    assert.equal(list.projects[0]?.companyId, "44110");
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(authorizations[0], "Bearer access-1");
  assert.equal(authorizations.at(-1), "Bearer access-2");
});

test("one company's project error does not drop the other company", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes(PROCORE_COMPANIES_PATH)) {
      return json([
        { id: 44110, name: "North Mill Electric" },
        { id: 88220, name: "Cedar Falls Builders" },
      ]);
    }
    if (url.includes("company_id=44110")) return json({ message: "no" }, 404);
    if (url.includes("company_id=88220")) {
      return json([{ id: 3, name: "Pine Hollow Warehouse", city: "Ridge Line" }]);
    }
    return json({}, 500);
  };
  try {
    const list = await listProcoreProjects(
      access("https://sandbox.procore.com", "https://login-sandbox.procore.com"),
    );
    assert.equal(list.ok, true);
    if (!list.ok) return;
    assert.equal(list.projects.length, 1);
    assert.equal(list.projects[0]?.name, "Pine Hollow Warehouse");
    assert.equal(list.projects[0]?.companyId, "88220");
  } finally {
    globalThis.fetch = original;
  }
});

test("unreachable Procore does not invent projects", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => json({ message: "down" }, 503);
  try {
    const list = await listProcoreProjects(
      access("https://sandbox.procore.com", "https://login-sandbox.procore.com"),
    );
    assert.deepEqual(list, { ok: false, reason: "procore_unreachable" });
  } finally {
    globalThis.fetch = original;
  }
});

test("projects for a company that was not returned are ignored", () => {
  const listed = collectListedProjects(
    [{ id: 44110, name: "North Mill Electric" }],
    [
      {
        companyId: "44110",
        projects: [{ id: 1, name: "Maple Point Medical Office", city: "Cedar Falls" }],
      },
      {
        companyId: "99901",
        projects: [{ id: 2, name: "Cedar Ridge Outpatient" }],
      },
    ],
  );
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.companyId, "44110");
  assert.equal(listed[0]?.name, "Maple Point Medical Office");
});

test("duplicate names and demo slugs stay distinct", () => {
  const rows = assignProjectSlugs([
    {
      companyId: "44110",
      projectId: "1",
      name: "Cedar Ridge Outpatient",
      city: "North Mill",
      phase: "Live",
      roomsHint: "",
    },
    {
      companyId: "88220",
      projectId: "2",
      name: "Cedar Ridge Outpatient",
      city: "West Landing",
      phase: "Live",
      roomsHint: "",
    },
    {
      companyId: "44110",
      projectId: "3",
      name: "Maple Point",
      city: "Cedar Falls",
      phase: "Live",
      roomsHint: "",
    },
  ]);
  assert.deepEqual(
    rows.map((row) => row.slug),
    ["cedar-ridge-outpatient", "cedar-ridge-outpatient-2", "maple-point-3"],
  );
  assert.equal(DEMO_JOBS.some((job) => job.slug === "maple-point"), true);
  assert.notEqual(rows[2]?.slug, "maple-point");
});

test("connected accounts show Procore projects, and an empty list keeps demo jobs", () => {
  assert.equal(
    NO_PROCORE_PROJECTS_MESSAGE,
    "No Procore projects found for this account yet.",
  );
  const maple: ListedProcoreProject = {
    companyId: "44110",
    projectId: "9001",
    name: "Maple Point Medical Office",
    slug: "maple-point-medical-office",
    city: "Cedar Falls",
    phase: "Electrical rough-in",
    roomsHint: "MP-1",
  };
  const live = jobsForSignedInAccount({
    connected: true,
    list: { ok: true, projects: [maple], refreshed: false },
  });
  assert.equal(live.usingProcore, true);
  assert.equal(live.emptyProcore, false);
  assert.equal(live.jobs[0]?.name, "Maple Point Medical Office");
  assert.equal(live.jobs.some((job) => job.slug === "harbor-view"), false);

  const empty = jobsForSignedInAccount({
    connected: true,
    list: { ok: true, projects: [], refreshed: false },
  });
  assert.equal(empty.usingProcore, false);
  assert.equal(empty.emptyProcore, true);
  assert.equal(empty.jobs.some((job) => job.slug === "maple-point"), true);

  const disconnected = jobsForSignedInAccount({ connected: false, list: null });
  assert.equal(disconnected.emptyProcore, false);
  assert.equal(disconnected.jobs.length, DEMO_JOBS.length);

  const failed = jobsForSignedInAccount({
    connected: true,
    list: { ok: false, reason: "procore_unreachable" },
  });
  assert.equal(failed.emptyProcore, false);
  assert.equal(failed.usingProcore, false);
});

test("opening a project checks the user's list and does not require the allowlist", () => {
  const previousAllowlist = process.env.PROCORE_PROJECT_ALLOWLIST;
  delete process.env.PROCORE_PROJECT_ALLOWLIST;
  const owned: ListedProcoreProject = {
    companyId: "88220",
    projectId: "44",
    name: "North Mill Clinic",
    slug: "north-mill-clinic",
    city: "North Mill",
    phase: "Live",
    roomsHint: "",
  };
  assert.equal(jobFromCatalogOrOwned("north-mill-clinic", null), undefined);
  assert.equal(jobFromCatalogOrOwned("north-mill-clinic", owned)?.name, "North Mill Clinic");
  assert.equal(jobFromCatalogOrOwned("north-mill-clinic", owned)?.city, "North Mill");
  assert.equal(
    jobFromCatalogOrOwned("maple-point", owned)?.name,
    "Maple Point Medical Office",
  );

  const pull = pullJobFromOwned(undefined, owned);
  assert.equal(pull.ownerAuthorized, true);
  assert.equal(pull.job?.slug, "north-mill-clinic");
  const demo = pullJobFromOwned(
    DEMO_JOBS.find((job) => job.slug === "cedar-ridge"),
    owned,
  );
  assert.equal(demo.ownerAuthorized, false);
  assert.equal(demo.job?.slug, "cedar-ridge");
  assert.deepEqual(allowlistForRestPull(pull.ownerAuthorized, ["North Mill Clinic"]), []);

  process.env.PROCORE_PROJECT_ALLOWLIST = "North Mill Clinic";
  try {
    assert.equal(jobFromCatalogOrOwned("north-mill-clinic", null)?.name, "North Mill Clinic");
  } finally {
    if (previousAllowlist === undefined) delete process.env.PROCORE_PROJECT_ALLOWLIST;
    else process.env.PROCORE_PROJECT_ALLOWLIST = previousAllowlist;
  }
});

test("project path and header use the company id argument", () => {
  assert.equal(
    procoreProjectsPath("44110"),
    "/rest/v1.0/projects?company_id=44110",
  );
  assert.deepEqual(procoreCompanyHeaders("88220"), { "Procore-Company-Id": "88220" });
  assert.equal(PROCORE_COMPANIES_PATH, "/rest/v1.0/companies");
});

test("jobs list copy and helpers stay fictional", () => {
  const files = [
    new URL("./procoreProjects.ts", import.meta.url),
    new URL("./procoreOAuth.ts", import.meta.url),
    new URL("../app/jobs/page.tsx", import.meta.url),
    new URL("../app/jobs/[projectSlug]/page.tsx", import.meta.url),
    new URL("../app/api/procore/projects/route.ts", import.meta.url),
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.equal(forbidden.test(source), false, String(file));
  }
  const page = readFileSync(new URL("../app/jobs/page.tsx", import.meta.url), "utf8");
  assert.match(page, /listProcoreProjectsForUser/);
  assert.match(page, /NO_PROCORE_PROJECTS_MESSAGE/);
  assert.match(page, /jobsForSignedInAccount/);
  const jobPage = readFileSync(
    new URL("../app/jobs/[projectSlug]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(jobPage, /resolveVisibleJob/);
  const route = readFileSync(
    new URL("../app/api/procore/projects/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /readAppSession/);
  assert.match(route, /status: 401/);
  assert.match(route, /listProcoreProjectsForUser/);
  assert.doesNotMatch(route, /access_token|refresh_token/);
  const helper = readFileSync(new URL("./procoreProjects.ts", import.meta.url), "utf8");
  assert.doesNotMatch(helper, /company_id=\d/);
  assert.doesNotMatch(helper, /Procore-Company-Id["']?\s*:\s*["']\d/);
});
