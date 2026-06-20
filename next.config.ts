import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained build for the single-container Docker image.
  output: "standalone",
  // better-sqlite3 is a native module; keep it out of the bundler and load it
  // from node_modules at runtime (applies to the Node.js server build).
  serverExternalPackages: ["better-sqlite3"],
  reactStrictMode: true,
};

export default nextConfig;
