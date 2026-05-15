import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["sweph"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./ephemeris/**/*"],
  },
};

export default config;
