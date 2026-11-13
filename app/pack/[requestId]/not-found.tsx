import { FieldNotFoundPage } from "@/components/FieldNotFound";
import {
  LINK_NOT_FOUND_DOCUMENT_DESCRIPTION,
  LINK_NOT_FOUND_DOCUMENT_TITLE,
} from "@/lib/fieldNotFound";
import { notFoundDocumentMetadata } from "@/lib/siteMetadata";

export const metadata = notFoundDocumentMetadata(
  LINK_NOT_FOUND_DOCUMENT_TITLE,
  LINK_NOT_FOUND_DOCUMENT_DESCRIPTION,
);

/** A pack id that does not resolve. */
export default function PackNotFound() {
  return <FieldNotFoundPage variant="link" />;
}
