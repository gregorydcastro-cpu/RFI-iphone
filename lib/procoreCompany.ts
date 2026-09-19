/**
 * Company ID is dynamic per Procore project. Never hardcode a company.
 *
 * Live pack pulls walk GET /companies then GET /projects?company_id=
 * until the requested name matches a Procore project exactly.
 * Optional PROCORE_PROJECT_ALLOWLIST restricts which names may resolve.
 * DEMO_JOBS is not the REST gate — real job names the puller's token
 * can see (exact match) resolve the same way.
 */

import { readProjectAllowlist } from "./procoreAllowlist.ts";
import {
  procoreApiGet,
  type ProcoreOAuthConfig,
} from "./procoreOAuth";
import {
  isResolvableProjectName,
  pickResolvedProject,
  readProcoreId,
  type ResolvedProcoreProject,
} from "./procoreProjectMatch";

export type { ResolvedProcoreProject };

export {
  isResolvableProjectName,
  matchProjectName,
  pickResolvedProject,
  readProcoreId,
} from "./procoreProjectMatch";

export { projectNameIsAllowed, readProjectAllowlist } from "./procoreAllowlist";

/**
 * Find the Procore company that owns this project name.
 * Returns null when the name is not allowlisted (if an allowlist is set)
 * or no exact project match exists.
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
 * Company + project ids for an exact Procore project name.
 * No hardcoded company id.
 */
export async function resolveProjectForName(
  config: ProcoreOAuthConfig,
  accessToken: string,
  projectName: string,
): Promise<ResolvedProcoreProject | null> {
  const allowlist = readProjectAllowlist();
  if (!isResolvableProjectName(projectName, allowlist)) return null;

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

  return pickResolvedProject(companies, projectsByCompany, projectName, allowlist);
}
