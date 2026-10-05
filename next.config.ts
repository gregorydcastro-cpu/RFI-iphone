import type { NextConfig } from "next";

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
    ];
  },
};

export default nextConfig;
