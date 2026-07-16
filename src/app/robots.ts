import type { MetadataRoute } from "next";
import { env } from "@/env.js";

const baseUrl =
  env.NEXT_PUBLIC_BASE_URL ?? "https://astro-calculator-design.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
