import type { Metadata } from "next";
import { FieldNotFoundPage } from "@/components/FieldNotFound";
import {
  LINK_NOT_FOUND_DOCUMENT_DESCRIPTION,
  LINK_NOT_FOUND_DOCUMENT_TITLE,
} from "@/lib/fieldNotFound";

export const metadata: Metadata = {
  title: { absolute: LINK_NOT_FOUND_DOCUMENT_TITLE },
  description: LINK_NOT_FOUND_DOCUMENT_DESCRIPTION,
  robots: { index: false, follow: false },
};

/** A pack id that does not resolve. */
export default function PackNotFound() {
  return <FieldNotFoundPage variant="link" />;
}
