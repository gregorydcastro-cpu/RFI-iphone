import type { MetadataRoute } from "next";
import { publicSitemap } from "@/lib/siteMetadata";

/** Public pages only. Same list as robots.txt allow. */
export default function sitemap(): MetadataRoute.Sitemap {
  return publicSitemap();
}
