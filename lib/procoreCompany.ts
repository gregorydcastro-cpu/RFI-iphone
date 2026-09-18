/**
 * Company ID is dynamic per Procore project. Never hardcode a company.
 * This app only looks up Maple Point / other DEMO_JOBS names.
 *
 * Live pack pulls use resolveProjectForName so REST calls send
 * Procore-Company-Id for the company that actually owns the demo job.
 */

import { DEMO_JOBS } from "./jobs";
import {
  procoreApiGet,
  type ProcoreOAuthConfig,
} from "./procoreOAuth";
import {
  isDemoProjectName as nameIsDemo,
  pickResolvedProject,
  readProcoreId,
  type ResolvedProcoreProject,
} from "./procoreProjectMatch";

export type { ResolvedProcoreProject };

export {
  matchProjectName,
  pickResolvedProject,
  readProcoreId,
} from "./procoreProjectMatch";

function demoNames(): string[] {
  return DEMO_JOBS.map((job) => job.name);
}

export function isDemoProjectName(projectName: string): boolean {
  return nameIsDemo(projectName, demoNames());
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
  const resolved = await resolveProjectForName(config, accessToken, projectName);
  return resolved?.companyId ?? null;
}

/**
 * Company + project ids for a demo job name. No hardcoded company id.
 */
export async function resolveProjectForName(
  config: ProcoreOAuthConfig,
  accessToken: string,
  projectName: string,
): Promise<ResolvedProcoreProject | null> {
  if (!isDemoProjectName(projectName)) return null;

  const companies = await procoreApiGet(
    config,
    accessToken,
    "/rest/v1.0/companies",
  );
  if (!Array.isArray(companies)) return null;

  const projectsByCompany: Array<{ companyId: string; projects: unknown }> = [];
  for (const company of companies) {
    const companyId = readProcoreId(company);
    if (!companyId) continue;
    const projects = await procoreApiGet(
      config,
      accessToken,
      `/rest/v1.0/projects?company_id=${encodeURIComponent(companyId)}`,
      { "Procore-Company-Id": companyId },
    );
    projectsByCompany.push({ companyId, projects });
  }

  return pickResolvedProject(companies, projectsByCompany, projectName, demoNames());
}
