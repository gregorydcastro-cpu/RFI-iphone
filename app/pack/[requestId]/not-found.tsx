import type { Metadata } from "next";
import { FieldNotFoundPage } from "@/components/FieldNotFound";
import {
  PAGE_NOT_FOUND_DOCUMENT_DESCRIPTION,
  PAGE_NOT_FOUND_DOCUMENT_TITLE,
} from "@/lib/fieldNotFound";

export const metadata: Metadata = {
  title: { absolute: PAGE_NOT_FOUND_DOCUMENT_TITLE },
  description: PAGE_NOT_FOUND_DOCUMENT_DESCRIPTION,
  robots: { index: false, follow: false },
};

/** A pack id that does not resolve. */
export default function PackNotFound() {
  return <FieldNotFoundPage variant="link" />;
}
