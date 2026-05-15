import { type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "npm run build",
  functions: {
    "src/app/api/**/route.ts": {
      runtime: "nodejs",
      maxDuration: 30,
    },
  },
};
