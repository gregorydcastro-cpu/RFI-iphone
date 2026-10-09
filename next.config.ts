import type { NextConfig } from "next";
import { signInAliasRedirects } from "./lib/fieldNotFound";
import { SECURITY_HEADERS } from "./lib/securityHeaders";

const nextConfig: NextConfig = {
  agentRules: false,
  // /_not-found/ has to reach the proxy. Next's built-in slash trim would
  // answer 308 first. Other slashed paths are handled in the proxy.
  skipTrailingSlashRedirect: true,
  serverExternalPackages: ["pdfjs-dist", "stripe"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/demo",
        destination: "/pack/maple-point",
        permanent: false,
      },
      ...signInAliasRedirects(),
    ];
  },
};

export default nextConfig;
