import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Typed env validation (T3 createEnv + Zod).
 * All vars used by the app are optional or have defaults so existing deploys
 * keep working; this only validates shape and centralizes access.
 */
export const env = createEnv({
  server: {
    EPHEMERIS_PATH: z.string().min(1).optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // Set by Next.js when loading instrumentation (not user-configured).
    NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),
    // Injected by npm when scripts run; absent under some runtimes.
    npm_package_version: z.string().min(1).optional(),
    // Build-time Sentry (next.config) — optional so local builds still work.
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  },
  runtimeEnv: {
    EPHEMERIS_PATH: process.env.EPHEMERIS_PATH,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_RUNTIME: process.env.NEXT_RUNTIME,
    npm_package_version: process.env.npm_package_version,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
