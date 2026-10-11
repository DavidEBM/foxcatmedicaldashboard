import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Firebase Admin depends on Node.js built-ins and must be loaded by the
  // serverless Node runtime instead of being bundled by Turbopack.
  serverExternalPackages: ["firebase-admin"],
  allowedDevOrigins: ["192.168.1.7"],
  outputFileTracingIncludes: {
    "/api/admin/ml": [
      "./ml/outputs/SavedModels/Model_Reports/**/*.png",
      "./ml/outputs/SavedModels/Model_Reports/**/*.jpg",
      "./ml/outputs/SavedModels/Model_Reports/**/*.jpeg",
      "./ml/outputs/SavedModels/Model_Reports/**/*.webp",
      "./ml/outputs/SavedModels/Model_Reports/**/*.svg",
    ],
    "/api/ai-training-assets": [
      "./ml/outputs/SavedModels/Model_Reports/**/*.png",
      "./ml/outputs/SavedModels/Model_Reports/**/*.jpg",
      "./ml/outputs/SavedModels/Model_Reports/**/*.jpeg",
      "./ml/outputs/SavedModels/Model_Reports/**/*.webp",
      "./ml/outputs/SavedModels/Model_Reports/**/*.svg",
    ],
  },
};

export default nextConfig;
