import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteNav } from "./_nav";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "Astro Calculator — Open API",
  description:
    "Open-source HTTP API for astrology, astrocartography, Human Design, Gene Keys, Life Path numerology, and Destiny Cards. AGPL-3.0, Swiss Ephemeris.",
  openGraph: {
    title: "Astro Calculator — Open API",
    description: "AGPL-licensed calculator service for esoteric blueprint systems.",
    url: baseUrl,
    siteName: "Astro Calculator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Astro Calculator — Open API",
    description: "AGPL-licensed calculator service for esoteric blueprint systems.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
