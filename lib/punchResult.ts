/**
 * Phone copy for a punch result.
 * Empty, saved, and failed stay separate. A dropped radio gets Retry.
 * Standing titles stay Not punched in / Punched in / Punched out.
 */

export const PUNCH_EMPTY_TITLE = "Not punched in";
export const PUNCH_IN_TITLE = "Punched in";
export const PUNCH_OUT_TITLE = "Punched out";

export const PUNCH_EMPTY_NEXT = "No punches yet this week. Punch in on site.";
export const PUNCH_IN_LINE = "You are on the clock.";
export const PUNCH_OUT_LINE = "You are off the clock.";

export const PUNCH_SAVED_TITLE = "Saved.";
export const PUNCH_SAVED_NEXT = "Next, open a job.";

export const PUNCH_FAIL_TITLE = "Punch did not save.";
export const PUNCH_FAIL_NEXT = "Tap Retry.";
export const PUNCH_FAIL_FIX = "Check the punch. Then punch again.";
export const PUNCH_OFFLINE_TITLE = "No connection.";
export const PUNCH_OFFLINE_NEXT = "Tap Retry.";

export type PunchClockState = "empty" | "in" | "out";

export type PunchFailureView = {
  title: string;
  next: string;
  retry: boolean;
};

const NETWORK =
  /failed to fetch|networkerror|network request failed|aborted|timeout|could not reach/i;

export function punchClockState(input: {
  onClock: boolean;
  lastType?: "in" | "out" | null;
}): PunchClockState {
  if (input.onClock) return "in";
  if (input.lastType === "out") return "out";
  return "empty";
}

export function punchClockCopy(state: PunchClockState): { title: string; line: string } {
  if (state === "in") return { title: PUNCH_IN_TITLE, line: PUNCH_IN_LINE };
  if (state === "out") return { title: PUNCH_OUT_TITLE, line: PUNCH_OUT_LINE };
  return { title: PUNCH_EMPTY_TITLE, line: PUNCH_EMPTY_NEXT };
}

export function punchClockSpeak(state: PunchClockState): string {
  const copy = punchClockCopy(state);
  return `${copy.title}. ${copy.line}`;
}

export function punchSuccessSpeak(notice: string): string {
  return `${PUNCH_SAVED_TITLE} ${notice} ${PUNCH_SAVED_NEXT}`;
}

export function punchFailureSpeak(view: PunchFailureView): string {
  return `${view.title} ${view.next}`;
}

function awayLine(distance_m?: number | null, radius_m?: number | null): string {
  const away = typeof distance_m === "number" && Number.isFinite(distance_m)
    ? Math.round(distance_m)
    : null;
  const fence = typeof radius_m === "number" && Number.isFinite(radius_m)
    ? Math.round(radius_m)
    : null;
  if (away != null && fence != null && fence > 0) {
    return `You are ${away} m away. Fence is ${fence} m.`;
  }
  return "Move onto the site. Then punch in.";
}

function failed(retry: boolean): PunchFailureView {
  return {
    title: PUNCH_FAIL_TITLE,
    next: retry ? PUNCH_FAIL_NEXT : PUNCH_FAIL_FIX,
    retry,
  };
}

/**
 * Phone failure for a punch write.
 * Network and a missed save can be tapped again. A bad PIN or off-site lock cannot.
 * Raw server text stays off the phone.
 */
export function punchFailureView(input: {
  thrown?: boolean;
  offline?: boolean;
  status?: number;
  code?: string | null;
  error?: string | null;
  storage?: string | null;
  distance_m?: number | null;
  radius_m?: number | null;
}): PunchFailureView {
  const raw = input.error?.trim() ?? "";
  const code = input.code?.trim() ?? "";

  if (code === "off_site") {
    return {
      title: "Off site. Punch in is locked.",
      next: awayLine(input.distance_m, input.radius_m),
      retry: false,
    };
  }

  if (code === "bad_pin") {
    return { title: "PIN does not match.", next: "Check the PIN.", retry: false };
  }

  if (code === "already_in") {
    return { title: "Already punched in.", next: "Punch out first.", retry: false };
  }

  if (code === "not_in") {
    return { title: "Not punched in.", next: "Punch in first.", retry: false };
  }

  if (code === "gps_required") {
    return { title: "Location is off.", next: "Turn it on, then punch in.", retry: false };
  }

  if (input.status === 401) {
    return { title: "Sign in first.", next: "Then punch again.", retry: false };
  }

  const network =
    input.thrown === true ||
    input.offline === true ||
    input.status === 0 ||
    NETWORK.test(raw);

  if (network && code !== "save_failed" && input.storage !== "unavailable") {
    return { title: PUNCH_OFFLINE_TITLE, next: PUNCH_OFFLINE_NEXT, retry: true };
  }

  if (
    code === "save_failed" ||
    input.storage === "unavailable" ||
    (typeof input.status === "number" && input.status >= 500)
  ) {
    return failed(true);
  }

  if (typeof input.status === "number" && input.status >= 400) {
    return failed(false);
  }

  return failed(true);
}
