import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: ["pdfjs-dist", "stripe"],
};

export default nextConfig;
