import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: ["pdfjs-dist", "stripe"],
  // Do not reuse a signed-out RSC payload for cookie-gated routes like /share.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
