/**
 * Share page metadata.
 * Signed-out /share is noindex. Signed-in keeps the same title and description.
 */

import type { Metadata } from "next";

export const SHARE_PAGE_TITLE = "Share — GC Field Log";

export const SHARE_PAGE_DESCRIPTION =
  "Create share folders, pin Maple Point disciplines or room packs, and refresh pinned sheets.";

export function sharePageMetadata(signedIn: boolean): Metadata {
  const metadata: Metadata = {
    title: SHARE_PAGE_TITLE,
    description: SHARE_PAGE_DESCRIPTION,
  };
  if (signedIn) return metadata;
  return {
    ...metadata,
    robots: { index: false, follow: false },
  };
}
