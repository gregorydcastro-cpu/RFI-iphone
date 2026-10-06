import type { MetadataRoute } from "next";
import { robotsRules } from "@/lib/siteInfo";

/** Public pages are allowed. API and signed-in areas are not. */
export default function robots(): MetadataRoute.Robots {
  return { rules: robotsRules() };
}
