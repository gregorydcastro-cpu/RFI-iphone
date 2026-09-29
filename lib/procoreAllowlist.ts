/**
 * Optional REST project-name allowlist.
 *
 * Unset / empty: any exact Procore project name the puller's token can
 * see is resolvable (Maple Point demos and real jobs).
 * Set `PROCORE_PROJECT_ALLOWLIST` to restrict to those names
 * (comma / newline / semicolon / pipe separated). Never a hardcoded
 * company id. DEMO_JOBS is not the REST gate.
 */

import { readEnvAlias } from "./env.ts";
import { isResolvableProjectName } from "./procoreProjectMatch.ts";

export const PROCORE_PROJECT_ALLOWLIST_KEY = "PROCORE_PROJECT_ALLOWLIST";

export function parseProjectAllowlist(
  raw: string | undefined | null,
): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,;|]+/)) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Same parser as `parseProjectAllowlist`. */
export const parseProcoreProjectAllowlist = parseProjectAllowlist;

export function readProjectAllowlist(): string[] {
  return parseProjectAllowlist(
    readEnvAlias(PROCORE_PROJECT_ALLOWLIST_KEY, "procore_project_allowlist"),
  );
}

export function projectNameIsAllowed(
  projectName: string,
  allowlist: readonly string[] = readProjectAllowlist(),
): boolean {
  return isResolvableProjectName(projectName, allowlist);
}
