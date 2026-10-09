import { FieldNotFoundPage } from "@/components/FieldNotFound";

/** Invalid invite token. Same link card as a bad pack, with HTTP 404. */
export default function InviteNotFound() {
  return <FieldNotFoundPage variant="link" />;
}
