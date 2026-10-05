const DEV_HINT =
  "Demo packs live at public/packs/<requestId>.json. Unknown request IDs still open the Maple Point sample from a pack URL.";

/** Server console only, and only while developing. Never render this. */
export function logFieldNotFoundDevHint(): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info(`[gcfieldlog] ${DEV_HINT}`);
}
