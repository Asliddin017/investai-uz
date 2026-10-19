import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server.js for the Docker image (deploy/). Vercel ignores it.
  output: "standalone",
};

export default nextConfig;
