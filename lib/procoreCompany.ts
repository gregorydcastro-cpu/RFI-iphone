/**
 * Company ID is dynamic per Procore project. Never hardcode a company.
 * This app only looks up Maple Point / other DEMO_JOBS names.
 *
 * Live pack re-pull stays on the parallel room_packs PR. This helper is
 * for later per-user Procore API calls that need Procore-Company-Id.
 */

import { DEMO_JOBS } from "./jobs";
import {
  procoreApiGet,
  readProcoreId,
  type ProcoreOAuthConfig,
} from "./procoreOAuth";

export function isDemoProjectName(projectName: string): boolean {
  const want = projectName.trim().toLowerCase();
  return DEMO_JOBS.some((job) => job.name.toLowerCase() === want);
}

/**
 * Find the Procore company that owns this demo project name.
 * Returns null for non-demo names (never search real job titles).
 */
export async function resolveCompanyIdForProject(
  config: ProcoreOAuthConfig,
  accessToken: string,
  projectName: string,
): Promise<string | null> {
  if (!isDemoProjectName(projectName)) return null;

  const companies = await procoreApiGet(
    config,
    accessToken,
    "/rest/v1.0/companies",
  );
  if (!Array.isArray(companies)) return null;

  const want = projectName.trim().toLowerCase();
  for (const company of companies) {
    const companyId = readProcoreId(company);
    if (!companyId) continue;
    const projects = await procoreApiGet(
      config,
      accessToken,
      `/rest/v1.0/projects?company_id=${encodeURIComponent(companyId)}`,
      { "Procore-Company-Id": companyId },
    );
    if (!Array.isArray(projects)) continue;
    for (const project of projects) {
      const name =
        project && typeof project === "object" && "name" in project
          ? String((project as { name: unknown }).name ?? "")
          : "";
      if (name.trim().toLowerCase() === want) return companyId;
    }
  }
  return null;
}
