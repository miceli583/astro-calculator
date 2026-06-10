import type { NextConfig } from "next";

const config: NextConfig = {
  // Packages that ship runtime data files / native modules and don't survive
  // Next.js's serverless bundling cleanly. Loaded from node_modules at runtime.
  serverExternalPackages: ["sweph", "tz-lookup"],
  // Force-bundle the Swiss Ephemeris data directory and tz-lookup package
  // into every serverless function. The previous "/api/**/*" pattern didn't
  // match App Router routes reliably; "**/*" hits everything.
  outputFileTracingIncludes: {
    "**/*": [
      "./ephemeris/**/*",
      "./node_modules/tz-lookup/**/*",
      "./node_modules/sweph/**/*",
    ],
  },
};

export default config;
