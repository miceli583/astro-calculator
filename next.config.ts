import type { NextConfig } from "next";

const config: NextConfig = {
  // Packages that ship runtime data files / native modules and don't survive
  // Next.js's serverless bundling cleanly. Loaded from node_modules at runtime.
  serverExternalPackages: ["sweph", "tz-lookup"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./ephemeris/**/*", "./node_modules/tz-lookup/**/*"],
  },
};

export default config;
