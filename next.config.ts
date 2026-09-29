import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Firebase Admin depends on Node.js built-ins and must be loaded by the
  // serverless Node runtime instead of being bundled by Turbopack.
  serverExternalPackages: ["firebase-admin"],
  allowedDevOrigins: ["192.168.1.7"],
};

export default nextConfig;
