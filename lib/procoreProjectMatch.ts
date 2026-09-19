/**
 * Pure helpers for company/project resolution.
 * No I/O — callers pass company/project lists from Procore GET.
 *
 * REST gate is an exact Procore project name match. An optional
 * allowlist (from env) can restrict names; an empty allowlist means
 * any exact name is eligible. DEMO_JOBS is not required.
 */

export type ResolvedProcoreProject = {
  companyId: string;
  projectId: string;
  projectName: string;
};

export function isDemoProjectName(
  projectName: string,
  demoNames: readonly string[],
): boolean {
  const want = projectName.trim().toLowerCase();
  if (!want) return false;
  return demoNames.some((name) => name.toLowerCase() === want);
}

/**
 * Empty allowlist → any non-empty name may resolve (exact match later).
 * Non-empty allowlist → name must appear on it (case-insensitive).
 */
export function isResolvableProjectName(
  projectName: string,
  allowlist: readonly string[] = [],
): boolean {
  const want = projectName.trim();
  if (!want) return false;
  if (allowlist.length === 0) return true;
  return allowlist.some((name) => name.trim().toLowerCase() === want.toLowerCase());
}

export function matchProjectName(
  project: unknown,
  projectName: string,
): boolean {
  const want = projectName.trim().toLowerCase();
  if (!want || !project || typeof project !== "object") return false;
  const name =
    "name" in project ? String((project as { name: unknown }).name ?? "") : "";
  return name.trim().toLowerCase() === want;
}

export function readProcoreId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "id" in value) {
    return readProcoreId((value as { id: unknown }).id);
  }
  return null;
}

export function pickResolvedProject(
  companies: unknown,
  projectsByCompany: ReadonlyArray<{ companyId: string; projects: unknown }>,
  projectName: string,
  allowlist: readonly string[] = [],
): ResolvedProcoreProject | null {
  if (!isResolvableProjectName(projectName, allowlist) || !Array.isArray(companies)) {
    return null;
  }
  const want = projectName.trim();

  for (const entry of projectsByCompany) {
    if (!entry.companyId || !Array.isArray(entry.projects)) continue;
    const companyOk = companies.some(
      (company) => readProcoreId(company) === entry.companyId,
    );
    if (!companyOk) continue;
    for (const project of entry.projects) {
      if (!matchProjectName(project, want)) continue;
      const projectId = readProcoreId(project);
      if (!projectId) continue;
      return {
        companyId: entry.companyId,
        projectId,
        projectName: want,
      };
    }
  }
  return null;
}
