/**
 * Create-draft result for Generate RFI.
 * A configured `rfis` write that does not land is a failure, same as a punch.
 * Demo mode (no service role) still counts as saved on this phone.
 * Never a Procore submit.
 */

export const RFI_SAVE_FAILED_MESSAGE = "Draft did not send. Tap Retry.";

export type RfiCreateStorage = "supabase" | "local" | "unconfigured" | "unavailable";

export type RfiCreateOutcome =
  | {
      ok: true;
      persisted: boolean;
      storage: "supabase" | "unconfigured";
      where: "crew" | "phone";
    }
  | {
      ok: false;
      status: 503;
      error: string;
      code: "save_failed";
      storage: "unavailable";
    };

/**
 * Configured insert that returns no row is a failed send.
 * Missing service role still saves on this phone.
 */
export function rfiCreateOutcome(input: {
  saved: boolean;
  writeConfigured: boolean;
}): RfiCreateOutcome {
  if (input.writeConfigured && !input.saved) {
    return {
      ok: false,
      status: 503,
      error: RFI_SAVE_FAILED_MESSAGE,
      code: "save_failed",
      storage: "unavailable",
    };
  }
  if (input.saved) {
    return { ok: true, persisted: true, storage: "supabase", where: "crew" };
  }
  return { ok: true, persisted: false, storage: "unconfigured", where: "phone" };
}

/** Client guard: ok + unavailable storage is not a sent draft. */
export function rfiCreateAccepted(data: {
  ok?: boolean;
  storage?: string | null;
}): boolean {
  return data.ok === true && data.storage !== "unavailable";
}

export type RfiCreateFailure = {
  title: string;
  message: string;
  retry: boolean;
};

/** Spoken line for the send-failure card. Same words as the screen. */
export function rfiCreateSpeak(
  failure: Pick<RfiCreateFailure, "title" | "message">,
): string {
  return `${failure.title}. ${failure.message}`;
}

/** Phone-sized failure copy. Short lines. Retry only when another tap can work. */
export function rfiCreateFailure(input: {
  status: number;
  error?: string | null;
}): RfiCreateFailure {
  if (input.status === 403) {
    return {
      title: "Draft did not send",
      message: "This login is view-only.",
      retry: false,
    };
  }
  if (input.status === 400) {
    return {
      title: "Draft did not send",
      message: "Add a subject and a description.",
      retry: false,
    };
  }
  if (input.status === 0) {
    return {
      title: "Draft did not send",
      message: "No connection. Tap Retry.",
      retry: true,
    };
  }
  const raw = input.error?.trim() ?? "";
  const generic =
    !raw || raw === RFI_SAVE_FAILED_MESSAGE || /^draft did not send\.?$/i.test(raw);
  return {
    title: "Draft did not send",
    message: generic ? "It is not with the crew. Tap Retry." : raw,
    retry: true,
  };
}

export type RfiCreateSuccess = {
  heading: string;
  summary: string;
  tone: "sent" | "phone";
};

export function rfiCreateSuccessCopy(
  where: "crew" | "phone" | "signed_out",
): RfiCreateSuccess {
  if (where === "signed_out") {
    return {
      heading: "Saved on this phone",
      summary: "You are signed out. This draft is on this phone.",
      tone: "phone",
    };
  }
  if (where === "phone") {
    return {
      heading: "Saved on this phone",
      summary: "Pat Nguyen does not have it yet. It stays on this phone.",
      tone: "phone",
    };
  }
  return {
    heading: "Draft sent",
    summary: "Pat Nguyen has this draft. Not a Procore submit.",
    tone: "sent",
  };
}
