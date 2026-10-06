import type { NextConfig } from "next";
import { signInAliasRedirects } from "./lib/fieldNotFound";
import { SECURITY_HEADERS } from "./lib/securityHeaders";

const nextConfig: NextConfig = {
  agentRules: false,
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
