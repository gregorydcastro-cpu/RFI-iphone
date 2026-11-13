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

/** Invalid invite token. Same link card as a bad pack, with HTTP 404. */
export default function InviteNotFound() {
  return <FieldNotFoundPage variant="link" />;
}
