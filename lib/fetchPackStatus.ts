import type { DemoJob } from "./jobs";
import { loadPack } from "./loadPack";
import {
  drivePackJsonPath,
  isRoomPackShape,
  packMatchesJob,
  type PackStatusSnapshot,
  PROCORE_ROOM_PACK_STATUS_URL_KEY,
  resolveStatusUrlTemplate,
} from "./packStatus";
import { readLowercaseEnv } from "./env";

const FETCH_TIMEOUT_MS = 8_000;

const WEBHOOK_STATUS_HOST_SUFFIXES = [
  "drive.google.com",
  "docs.google.com",
  "googleapis.com",
  "googleusercontent.com",
];

function hostAllowed(hostname: string, suffixes: string[]): boolean {
  const host = hostname.toLowerCase();
  return suffixes.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

function parseHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

function isLocalDevHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

/**
 * Client/webhook-supplied status URLs are allowlisted to avoid SSRF.
 * Env templates are ops-controlled and only need http(s).
 */
export function isAllowedStatusUrl(
  raw: string,
  origin: "env" | "webhook",
): boolean {
  const url = parseHttpUrl(raw);
  if (!url) return false;
  if (isLocalDevHost(url.hostname)) {
    // Env templates are ops-controlled (local mock or sidecar). Webhook-supplied
    // localhost is only for non-production.
    return origin === "env" || process.env.NODE_ENV !== "production";
  }
  if (origin === "env") return url.protocol === "https:" || url.protocol === "http:";
  if (url.protocol !== "https:") return false;
  return hostAllowed(url.hostname, WEBHOOK_STATUS_HOST_SUFFIXES);
}

function pendingStub(
  drivePath: string,
  poll: boolean,
): PackStatusSnapshot {
  return {
    state: "pending",
    source: "stub",
    drivePath,
    pack: null,
    poll,
    unconfigured: true,
  };
}

function rejectMismatchedPack(
  drivePath: string,
  source: PackStatusSnapshot["source"],
): PackStatusSnapshot {
  console.error("[gcfieldlog] room-pack status rejected — job mismatch", {
    drivePath,
  });
  return {
    state: "error",
    source,
    drivePath,
    pack: null,
    poll: false,
    unconfigured: false,
    error: "Pack project does not match the selected job",
  };
}

async function readJsonUrl(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      console.error("[gcfieldlog] room-pack status HTTP was not ok", {
        status: response.status,
        host: safeHost(url),
      });
      return null;
    }
    const text = await response.text();
    try {
      return JSON.parse(text) as unknown;
    } catch {
      console.error("[gcfieldlog] room-pack status was not JSON", {
        host: safeHost(url),
      });
      return null;
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[gcfieldlog] room-pack status fetch failed", {
      aborted,
      host: safeHost(url),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid";
  }
}

/**
 * Drive API is not in Vercel env. Resolving
 * `{project_slug}/{request_id}.json` inside the public Drive root needs a
 * service account / API key Field Log actually stores (lowercase names only).
 * Returns unconfigured until those exist; callers poll the HTTP/status interface.
 */
export async function fetchDrivePackJson(input: {
  projectSlug: string;
  requestId: string;
}): Promise<"unconfigured"> {
  void drivePackJsonPath(input.projectSlug, input.requestId);
  return "unconfigured";
}

export async function fetchPackStatus(input: {
  job: DemoJob;
  requestId: string;
  statusUrl?: string;
  poll: boolean;
}): Promise<PackStatusSnapshot> {
  const drivePath = drivePackJsonPath(input.job.slug, input.requestId);

  const local = await loadPack(input.requestId);
  if (local && isRoomPackShape(local)) {
    if (!packMatchesJob(local, input.job, input.requestId)) {
      return rejectMismatchedPack(drivePath, "local");
    }
    if (local.status === "ready") {
      return {
        state: "ready",
        source: "local",
        drivePath,
        pack: local,
        poll: false,
        unconfigured: false,
      };
    }
    if (local.status === "error") {
      return {
        state: "error",
        source: "local",
        drivePath,
        pack: null,
        poll: false,
        unconfigured: false,
        error: "Pack status is error",
      };
    }
  }

  const envTemplate = readLowercaseEnv(PROCORE_ROOM_PACK_STATUS_URL_KEY);
  const fromEnv = envTemplate
    ? resolveStatusUrlTemplate(envTemplate, {
        projectSlug: input.job.slug,
        requestId: input.requestId,
      })
    : undefined;
  const candidates: { url: string; origin: "env" | "webhook" }[] = [];
  if (fromEnv) candidates.push({ url: fromEnv, origin: "env" });
  if (input.statusUrl) candidates.push({ url: input.statusUrl, origin: "webhook" });

  for (const candidate of candidates) {
    if (!isAllowedStatusUrl(candidate.url, candidate.origin)) continue;
    const json = await readJsonUrl(candidate.url);
    if (!json) continue;
    if (!isRoomPackShape(json)) continue;
    if (!packMatchesJob(json, input.job, input.requestId)) {
      return rejectMismatchedPack(drivePath, "http");
    }
    if (json.status === "ready") {
      return {
        state: "ready",
        source: "http",
        drivePath,
        pack: json,
        poll: false,
        unconfigured: false,
      };
    }
    if (json.status === "error") {
      return {
        state: "error",
        source: "http",
        drivePath,
        pack: null,
        poll: false,
        unconfigured: false,
        error: "Pack status is error",
      };
    }
    return {
      state: "pending",
      source: "http",
      drivePath,
      pack: null,
      poll: input.poll,
      unconfigured: false,
    };
  }

  await fetchDrivePackJson({
    projectSlug: input.job.slug,
    requestId: input.requestId,
  });
  return pendingStub(drivePath, input.poll);
}
