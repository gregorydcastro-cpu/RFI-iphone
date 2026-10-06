import type { MetadataRoute } from "next";
import { SITE_ORIGIN, robotsRules } from "@/lib/siteInfo";

/** Public pages are allowed. API and signed-in areas are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: robotsRules(),
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
