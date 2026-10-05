import type { NextConfig } from "next";
import { signInAliasRedirects } from "./lib/fieldNotFound";

const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: ["pdfjs-dist", "stripe"],
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
