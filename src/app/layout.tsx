import type { Metadata } from "next";
import "./globals.css";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "Astro Calculator — Open API",
  description:
    "Open-source HTTP API for astrology, astrocartography, Human Design, Gene Keys, Life Path numerology, and Destiny Cards. AGPL-3.0, Swiss Ephemeris.",
  openGraph: {
    title: "Astro Calculator — Open API",
    description: "AGPL-licensed calculator service for esoteric blueprint systems.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
