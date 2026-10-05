/**
 * Field copy for a phone photo on a draft RFI.
 * Too large or a read that stops is an alert with Pick again or Retry.
 * Nothing to attach is a status. The photo stays a data URL on this phone.
 * Not a Procore upload. No raw reader text.
 */

/** Same cap the draft form already used (~3.5 MB). */
export const PHOTO_ATTACH_MAX_BYTES = 3_500_000;

export const PHOTO_TOO_LARGE_TITLE = "Photo is too large";
export const PHOTO_TOO_LARGE_MESSAGE = "Max is 3.5 MB. Pick again.";

export const PHOTO_READ_TITLE = "Photo did not attach";
export const PHOTO_READ_MESSAGE = "The photo did not read. Tap Retry.";

export const PHOTO_EMPTY_TITLE = "Nothing to attach";
export const PHOTO_EMPTY_MESSAGE = "No photo on this draft yet.";

export type PhotoAttachNotice = "empty" | "too_large" | "unreadable";

export type PhotoAttachBanner = {
  title: string;
  message: string;
  speak: string;
  /** Retry re-reads the same file. Pick again opens the camera roll. */
  action: "retry" | "pick";
};

export type PhotoAttachSurface =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "empty"; title: string; message: string; speak: string }
  | ({ kind: "error" } & PhotoAttachBanner);

function speak(title: string, message: string): string {
  return `${title}. ${message}`;
}

/** A zero-byte pick is nothing to attach. Over the cap cannot be retried. */
export function photoAttachFromFile(input: {
  size: number;
  maxBytes?: number;
}): "empty" | "too_large" | "readable" {
  if (!Number.isFinite(input.size) || input.size < 1) return "empty";
  const max = input.maxBytes ?? PHOTO_ATTACH_MAX_BYTES;
  if (input.size > max) return "too_large";
  return "readable";
}

/**
 * One card for the batch. A read that failed wins, then a photo over the cap.
 * Photos that landed stay attached. Nothing usable is a status.
 */
export function photoAttachBatchOutcome(input: {
  fileCount: number;
  emptyCount: number;
  tooLargeCount: number;
  readFailCount: number;
  attachedCount: number;
}): "idle" | PhotoAttachNotice {
  if (input.readFailCount > 0) return "unreadable";
  if (input.tooLargeCount > 0) return "too_large";
  if (input.attachedCount > 0) return "idle";
  if (input.fileCount === 0 || input.emptyCount > 0) return "empty";
  return "empty";
}

export function photoAttachBanner(
  notice: Exclude<PhotoAttachNotice, "empty">,
): PhotoAttachBanner {
  if (notice === "too_large") {
    return {
      title: PHOTO_TOO_LARGE_TITLE,
      message: PHOTO_TOO_LARGE_MESSAGE,
      speak: speak(PHOTO_TOO_LARGE_TITLE, PHOTO_TOO_LARGE_MESSAGE),
      action: "pick",
    };
  }
  return {
    title: PHOTO_READ_TITLE,
    message: PHOTO_READ_MESSAGE,
    speak: speak(PHOTO_READ_TITLE, PHOTO_READ_MESSAGE),
    action: "retry",
  };
}

export function photoAttachSurface(input: {
  pending?: boolean;
  notice?: PhotoAttachNotice | null;
}): PhotoAttachSurface {
  if (input.pending) return { kind: "reading" };
  if (input.notice === "empty") {
    return {
      kind: "empty",
      title: PHOTO_EMPTY_TITLE,
      message: PHOTO_EMPTY_MESSAGE,
      speak: speak(PHOTO_EMPTY_TITLE, PHOTO_EMPTY_MESSAGE),
    };
  }
  if (input.notice === "too_large" || input.notice === "unreadable") {
    return { kind: "error", ...photoAttachBanner(input.notice) };
  }
  return { kind: "idle" };
}
