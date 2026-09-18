/**
 * Pure helpers for demo-project company/project resolution.
 * No I/O — callers pass company/project lists from Procore GET.
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
  return demoNames.some((name) => name.toLowerCase() === want);
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
  demoNames: readonly string[],
): ResolvedProcoreProject | null {
  if (!isDemoProjectName(projectName, demoNames) || !Array.isArray(companies)) {
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
