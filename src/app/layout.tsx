import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

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
    type: "website",
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

function SiteNav() {
  const linkStyle: React.CSSProperties = {
    color: "var(--muted)",
    textDecoration: "none",
    fontSize: 14,
    padding: "0.4rem 0.85rem",
    borderRadius: 6,
    transition: "color 0.15s, background 0.15s",
  };
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "0.75rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <Link
          href="/"
          style={{
            color: "var(--fg)",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 15,
            marginRight: "auto",
            letterSpacing: "-0.01em",
          }}
        >
          ✦ Astro Calculator
        </Link>
        <Link href="/chart" style={linkStyle}>Chart</Link>
        <Link href="/sky" style={linkStyle}>Sky</Link>
        <Link href="/docs" style={linkStyle}>API</Link>
      </div>
    </nav>
  );
}
