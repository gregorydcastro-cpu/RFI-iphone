/**
 * Signed-in Procore project list for /jobs.
 *
 * Uses the stored procore_connections token (refresh included). Company
 * id comes from GET /rest/v1.0/companies, then each company's projects.
 * Never a hardcoded company id. Project calls send Procore-Company-Id.
 * Tokens stay on the server.
 */

import {
  DEMO_JOBS,
  getJob,
  isDemoOrFictionalJob,
  resolvePullJob,
  slugFromProjectName,
  type DemoJob,
} from "./jobs.ts";
import { markProcoreReconnectNeeded } from "./procoreConnections.ts";
import { procoreApiRequest } from "./procoreOAuth.ts";
import { readProcoreId } from "./procoreProjectMatch.ts";
import {
  refreshStoredProcoreAccess,
  resolveProcoreAccess,
  type ProcoreAccessFailure,
  type ValidProcoreAccess,
} from "./procoreToken.ts";

export const PROCORE_COMPANIES_PATH = "/rest/v1.0/companies";
export const NO_PROCORE_PROJECTS_MESSAGE =
  "No Procore projects found for this account yet.";

const PAGE_SIZE = 100;
const MAX_PAGES = 8;
const LIST_BUDGET_MS = 20_000;

export type ListedProcoreProject = {
  companyId: string;
  projectId: string;
  name: string;
  slug: string;
  city: string;
  phase: string;
  roomsHint: string;
};

export type ProcoreProjectListFailure =
  | "missing_oauth"
  | "missing_tokens"
  | "reconnect_needed"
  | "refresh_unavailable"
  | "api_error"
  | "procore_unreachable";

export type ProcoreProjectList =
  | { ok: true; projects: ListedProcoreProject[]; refreshed: boolean }
  | { ok: false; reason: ProcoreProjectListFailure };

type AuthedKind = "ok" | "reconnect" | "unreachable" | "error";

type ListedDraft = Omit<ListedProcoreProject, "slug">;

export function procoreProjectsPath(companyId: string): string {
  return `/rest/v1.0/projects?company_id=${encodeURIComponent(companyId)}`;
}

export function procoreCompanyHeaders(companyId: string): Record<string, string> {
  return { "Procore-Company-Id": companyId };
}

export function listedProjectToJob(project: ListedProcoreProject): DemoJob {
  return {
    slug: project.slug,
    name: project.name,
    city: project.city,
    phase: project.phase || "Live",
    roomsHint: project.roomsHint,
  };
}

export function publicProcoreProject(project: ListedProcoreProject) {
  return {
    slug: project.slug,
    name: project.name,
    city: project.city,
    phase: project.phase,
    roomsHint: project.roomsHint,
    companyId: project.companyId,
    projectId: project.projectId,
  };
}

export function publicProcoreProjects(projects: readonly ListedProcoreProject[]) {
  return projects.map(publicProcoreProject);
}

/**
 * Connected account with projects: those projects.
 * Connected account with none: demo jobs plus the empty-state flag.
 * Anything else (signed out of Procore, or the list call failed): demo jobs.
 */
export function jobsForSignedInAccount(input: {
  connected: boolean;
  list: ProcoreProjectList | null;
}): { jobs: DemoJob[]; usingProcore: boolean; emptyProcore: boolean } {
  if (input.connected && input.list?.ok && input.list.projects.length > 0) {
    return {
      jobs: input.list.projects.map(listedProjectToJob),
      usingProcore: true,
      emptyProcore: false,
    };
  }
  return {
    jobs: DEMO_JOBS,
    usingProcore: false,
    emptyProcore: Boolean(
      input.connected && input.list?.ok && input.list.projects.length === 0,
    ),
  };
}

/**
 * Demo catalog wins for fictional slugs. Otherwise a project on this
 * user's Procore list opens even when it is not on PROCORE_PROJECT_ALLOWLIST.
 * Allowlisted names still open when the live list does not include them.
 */
export function jobFromCatalogOrOwned(
  slug: string,
  owned: ListedProcoreProject | null,
): DemoJob | undefined {
  const catalog = getJob(slug);
  if (catalog && isDemoOrFictionalJob(catalog)) return catalog;
  const want = slug.trim().toLowerCase();
  if (owned && owned.slug === want) return listedProjectToJob(owned);
  return catalog;
}

export function pullJobFromOwned(
  resolved: DemoJob | undefined,
  owned: ListedProcoreProject | null,
): { job: DemoJob | undefined; ownerAuthorized: boolean } {
  if (resolved && isDemoOrFictionalJob(resolved)) {
    return { job: resolved, ownerAuthorized: false };
  }
  if (owned) return { job: listedProjectToJob(owned), ownerAuthorized: true };
  return { job: resolved, ownerAuthorized: false };
}

export function collectListedProjects(
  companies: unknown,
  projectsByCompany: ReadonlyArray<{ companyId: string; projects: unknown }>,
): ListedProcoreProject[] {
  if (!Array.isArray(companies)) return [];
  const rows: ListedDraft[] = [];
  for (const entry of projectsByCompany) {
    if (!entry.companyId) continue;
    const companyOk = companies.some(
      (company) => readProcoreId(company) === entry.companyId,
    );
    if (!companyOk) continue;
    for (const project of listFromBody(entry.projects)) {
      const row = mapListedProject(entry.companyId, project);
      if (row) rows.push(row);
    }
  }
  return assignProjectSlugs(rows);
}

export function assignProjectSlugs(rows: readonly ListedDraft[]): ListedProcoreProject[] {
  const used = new Set<string>();
  return rows.map((row) => {
    let slug = slugFromProjectName(row.name);
    if (slugTaken(slug, row.name, used)) {
      const suffix = row.projectId.replace(/[^a-z0-9]+/gi, "").toLowerCase() || "project";
      slug = `${slug}-${suffix}`.replace(/-+$/g, "").slice(0, 80) || suffix;
    }
    while (used.has(slug)) {
      slug = `${slug}-2`.slice(0, 80);
    }
    used.add(slug);
    return { ...row, slug };
  });
}

function slugTaken(slug: string, name: string, used: Set<string>): boolean {
  if (used.has(slug)) return true;
  const demo = DEMO_JOBS.find((job) => job.slug === slug);
  return Boolean(demo && demo.name.toLowerCase() !== name.trim().toLowerCase());
}

function mapListedProject(companyId: string, project: unknown): ListedDraft | null {
  if (!project || typeof project !== "object" || Array.isArray(project)) return null;
  const record = project as Record<string, unknown>;
  const projectId = readProcoreId(record);
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!projectId || !name) return null;
  const projectNumber =
    typeof record.project_number === "string" ? record.project_number.trim() : "";
  return {
    companyId,
    projectId,
    name,
    city: readCity(record),
    phase: readPhase(record),
    roomsHint: projectNumber,
  };
}

function readCity(record: Record<string, unknown>): string {
  if (typeof record.city === "string" && record.city.trim()) return record.city.trim();
  const address = record.address;
  if (address && typeof address === "object" && !Array.isArray(address)) {
    const city = (address as { city?: unknown }).city;
    if (typeof city === "string" && city.trim()) return city.trim();
  }
  return "";
}

function readPhase(record: Record<string, unknown>): string {
  if (typeof record.stage === "string" && record.stage.trim()) return record.stage.trim();
  const stage = record.project_stage;
  if (stage && typeof stage === "object" && !Array.isArray(stage)) {
    const name = (stage as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  if (typeof record.status_name === "string" && record.status_name.trim()) {
    return record.status_name.trim();
  }
  return "Live";
}

function listFromBody(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: unknown[] }).data;
  }
  return [];
}

function remainingMs(deadline: number): number {
  return deadline - Date.now();
}

function failureFromAccess(reason: ProcoreAccessFailure): ProcoreProjectListFailure {
  if (reason === "missing_oauth") return "missing_oauth";
  if (reason === "missing_tokens") return "missing_tokens";
  if (reason === "reconnect_needed") return "reconnect_needed";
  return "refresh_unavailable";
}

function reasonFromKind(kind: Exclude<AuthedKind, "ok">): ProcoreProjectListFailure {
  if (kind === "reconnect") return "reconnect_needed";
  if (kind === "unreachable") return "procore_unreachable";
  return "api_error";
}

async function authedGet(
  access: ValidProcoreAccess,
  path: string,
  extraHeaders: Record<string, string> | undefined,
  deadline: number,
): Promise<{
  access: ValidProcoreAccess;
  body: unknown;
  ok: boolean;
  kind: AuthedKind;
}> {
  if (remainingMs(deadline) < 500) {
    return { access, body: null, ok: false, kind: "unreachable" };
  }
  let current = access;
  let result = await procoreApiRequest(
    current.config,
    current.accessToken,
    path,
    extraHeaders,
    remainingMs(deadline),
  );
  if (result.status === 401) {
    if (remainingMs(deadline) < 500) {
      return { access: current, body: null, ok: false, kind: "unreachable" };
    }
    const refreshed = await refreshStoredProcoreAccess(current.config, current.secrets);
    if (!refreshed.ok) {
      return {
        access: current,
        body: null,
        ok: false,
        kind: refreshed.reason === "reconnect_needed" ? "reconnect" : "unreachable",
      };
    }
    current = refreshed.access;
    if (remainingMs(deadline) < 500) {
      return { access: current, body: null, ok: false, kind: "unreachable" };
    }
    result = await procoreApiRequest(
      current.config,
      current.accessToken,
      path,
      extraHeaders,
      remainingMs(deadline),
    );
    if (result.status === 401) {
      await markProcoreReconnectNeeded(current.secrets.userId);
      return { access: current, body: null, ok: false, kind: "reconnect" };
    }
  }
  if (result.ok) return { access: current, body: result.body, ok: true, kind: "ok" };
  if (result.status === 0 || result.status >= 500) {
    return { access: current, body: result.body, ok: false, kind: "unreachable" };
  }
  return { access: current, body: result.body, ok: false, kind: "error" };
}

async function listAll(
  access: ValidProcoreAccess,
  path: string,
  extraHeaders: Record<string, string> | undefined,
  deadline: number,
): Promise<{
  access: ValidProcoreAccess;
  items: unknown[];
  ok: boolean;
  reason: ProcoreProjectListFailure;
}> {
  const items: unknown[] = [];
  let current = access;
  const joiner = path.includes("?") ? "&" : "?";
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    if (remainingMs(deadline) < 500) {
      if (page === 1) {
        return { access: current, items, ok: false, reason: "procore_unreachable" };
      }
      break;
    }
    const paged = `${path}${joiner}per_page=${PAGE_SIZE}&page=${page}`;
    const result = await authedGet(current, paged, extraHeaders, deadline);
    current = result.access;
    if (!result.ok) {
      if (page === 1) {
        return {
          access: current,
          items,
          ok: false,
          reason: reasonFromKind(result.kind === "ok" ? "error" : result.kind),
        };
      }
      break;
    }
    const chunk = listFromBody(result.body);
    items.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return { access: current, items, ok: true, reason: "api_error" };
}

/**
 * GET /companies, then each company's projects with that company's id.
 */
export async function listProcoreProjects(
  access: ValidProcoreAccess,
): Promise<ProcoreProjectList> {
  const deadline = Date.now() + LIST_BUDGET_MS;
  const companies = await listAll(access, PROCORE_COMPANIES_PATH, undefined, deadline);
  if (!companies.ok) return { ok: false, reason: companies.reason };

  let current = companies.access;
  const projectsByCompany: Array<{ companyId: string; projects: unknown[] }> = [];
  for (const company of companies.items) {
    const companyId = readProcoreId(company);
    if (!companyId) continue;
    const projects = await listAll(
      current,
      procoreProjectsPath(companyId),
      procoreCompanyHeaders(companyId),
      deadline,
    );
    current = projects.access;
    if (!projects.ok) {
      if (projects.reason === "api_error") continue;
      return { ok: false, reason: projects.reason };
    }
    projectsByCompany.push({ companyId, projects: projects.items });
  }

  const listed = collectListedProjects(companies.items, projectsByCompany);
  console.info("[gcfieldlog] procore project list", {
    companies: projectsByCompany.length,
    projects: listed.length,
    token_refreshed: current.refreshed,
  });
  return { ok: true, projects: listed, refreshed: current.refreshed };
}

export async function listProcoreProjectsForUser(
  userId: string,
): Promise<ProcoreProjectList> {
  try {
    const resolved = await resolveProcoreAccess(userId);
    if (!resolved.ok) return { ok: false, reason: failureFromAccess(resolved.reason) };
    return await listProcoreProjects(resolved.access);
  } catch (error) {
    console.error("[gcfieldlog] procore project list failed", {
      aborted: error instanceof Error && error.name === "AbortError",
    });
    return { ok: false, reason: "api_error" };
  }
}

export async function findOwnedProcoreJob(
  userId: string,
  slug: string,
): Promise<ListedProcoreProject | null> {
  const want = slug.trim().toLowerCase();
  if (!want) return null;
  const list = await listProcoreProjectsForUser(userId);
  if (!list.ok) return null;
  return list.projects.find((project) => project.slug === want) ?? null;
}

/** Job page: demo catalog, else this user's Procore list, else allowlist. */
export async function resolveVisibleJob(
  slug: string,
  userId: string | null,
): Promise<DemoJob | undefined> {
  const catalog = getJob(slug);
  if (catalog && isDemoOrFictionalJob(catalog)) return catalog;
  const owned = userId ? await findOwnedProcoreJob(userId, slug) : null;
  return jobFromCatalogOrOwned(slug, owned);
}

export async function authorizePullJob(input: {
  userId?: string | null;
  projectSlug?: string | null;
  projectName?: string | null;
  requestId?: string | null;
}): Promise<{ job: DemoJob | undefined; ownerAuthorized: boolean }> {
  const resolved = resolvePullJob(input);
  if (!input.userId || (resolved && isDemoOrFictionalJob(resolved))) {
    return { job: resolved, ownerAuthorized: false };
  }
  const slug = input.projectSlug?.trim() ?? "";
  if (!slug) return pullJobFromOwned(resolved, null);
  const owned = await findOwnedProcoreJob(input.userId, slug);
  return pullJobFromOwned(resolved, owned);
}
