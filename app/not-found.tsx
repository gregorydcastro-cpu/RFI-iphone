import type { Metadata } from "next";
import { headers } from "next/headers";
import { FieldNotFoundPage } from "@/components/FieldNotFound";
import {
  FIELD_LINK_MISS,
  FIELD_NOT_FOUND_HEADER,
  PAGE_NOT_FOUND_DOCUMENT_DESCRIPTION,
  PAGE_NOT_FOUND_DOCUMENT_TITLE,
} from "@/lib/fieldNotFound";

export const metadata: Metadata = {
  title: { absolute: PAGE_NOT_FOUND_DOCUMENT_TITLE },
  description: PAGE_NOT_FOUND_DOCUMENT_DESCRIPTION,
  robots: { index: false, follow: false },
};

/** Unmatched URLs, and invite or pack misses rewritten here by the proxy. */
export default async function NotFound() {
  const marker = (await headers()).get(FIELD_NOT_FOUND_HEADER);
  const variant = marker === FIELD_LINK_MISS ? "link" : "page";
  return <FieldNotFoundPage variant={variant} />;
}
