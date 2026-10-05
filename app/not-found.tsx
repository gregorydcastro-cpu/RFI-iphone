import { FieldNotFoundPage } from "@/components/FieldNotFound";

/** Any app URL that does not match a page. Pack misses use the pack segment. */
export default function NotFound() {
  return <FieldNotFoundPage variant="page" />;
}
