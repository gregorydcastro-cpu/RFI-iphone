/**
 * Jobs-list next step when the field radio is shaky.
 * Punch in / Open a job stay on the cards. This line adds Retry.
 */

export const JOBS_SHAKY_NEXT =
  "Shaky signal? Open a job or punch. Then tap Retry.";

/** What the punch screen will say. The shaky line above stays the action. */
export const JOBS_PUNCH_RESULT_NEXT =
  "On Punch: Saved, Did not save, or Not punched in.";

export const JOBS_OPEN_FAILED = "That did not open. Tap Retry.";

export const JOBS_OPEN_FORBIDDEN = "This login cannot pull. Open a job below.";

export type JobsOpenFailure = {
  message: string;
  retry: boolean;
};

export function jobsOpenFailure(input: {
  offline?: boolean;
  status?: number;
  error?: string | null;
}): JobsOpenFailure {
  const raw = input.error?.trim() ?? "";
  const looksOffline =
    input.offline === true ||
    input.status === 0 ||
    /failed to fetch|networkerror|network request failed|aborted|timeout|could not reach/i.test(
      raw,
    );
  if (looksOffline) return { message: JOBS_SHAKY_NEXT, retry: true };
  if (input.status === 403) return { message: JOBS_OPEN_FORBIDDEN, retry: false };
  if (input.status === 400 || input.status === 404) {
    return { message: "Open a job below, then try the room again.", retry: false };
  }
  return { message: JOBS_OPEN_FAILED, retry: true };
}

export function jobsFailureFromUnknown(caught: unknown): JobsOpenFailure {
  const status =
    caught &&
    typeof caught === "object" &&
    "status" in caught &&
    typeof (caught as { status: unknown }).status === "number"
      ? (caught as { status: number }).status
      : undefined;
  const message = caught instanceof Error ? caught.message : "";
  const offline =
    status === 0 ||
    (typeof navigator !== "undefined" && navigator.onLine === false);
  return jobsOpenFailure({ offline, status, error: message });
}
