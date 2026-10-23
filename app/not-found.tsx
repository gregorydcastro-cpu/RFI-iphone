import type { Metadata } from "next";
import { headers } from "next/headers";
import { FieldNotFoundPage } from "@/components/FieldNotFound";
import {
  FIELD_LINK_MISS,
  FIELD_NOT_FOUND_HEADER,
  LINK_NOT_FOUND_DOCUMENT_DESCRIPTION,
  LINK_NOT_FOUND_DOCUMENT_TITLE,
  PAGE_NOT_FOUND_DOCUMENT_DESCRIPTION,
  PAGE_NOT_FOUND_DOCUMENT_TITLE,
} from "@/lib/fieldNotFound";

export async function generateMetadata(): Promise<Metadata> {
  const marker = (await headers()).get(FIELD_NOT_FOUND_HEADER);
  if (marker === FIELD_LINK_MISS) {
    return {
      title: { absolute: LINK_NOT_FOUND_DOCUMENT_TITLE },
      description: LINK_NOT_FOUND_DOCUMENT_DESCRIPTION,
      robots: { index: false, follow: false },
    };
  }
  return {
    title: { absolute: PAGE_NOT_FOUND_DOCUMENT_TITLE },
    description: PAGE_NOT_FOUND_DOCUMENT_DESCRIPTION,
    robots: { index: false, follow: false },
  };
}

/** Unmatched URLs, and invite or pack misses rendered here by the proxy. */
export default async function NotFound() {
  const marker = (await headers()).get(FIELD_NOT_FOUND_HEADER);
  const variant = marker === FIELD_LINK_MISS ? "link" : "page";
  return <FieldNotFoundPage variant={variant} />;
}
