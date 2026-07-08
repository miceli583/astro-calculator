import type { MetadataRoute } from "next";

const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://astro-calculator-design.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/sky", "/chart", "/docs"].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.8,
  }));
}
