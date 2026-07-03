"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Top-level site navigation. Reuses the same underline-on-active pattern as
 * the tab bar inside ResultsView on /chart, so the visual language stays
 * consistent across the app.
 */
export function SiteNav() {
  const pathname = usePathname() ?? "/";
  const links: { href: string; label: string; match: (p: string) => boolean }[] = [
    { href: "/",      label: "Home",  match: (p) => p === "/" },
    { href: "/chart", label: "Chart", match: (p) => p.startsWith("/chart") },
    { href: "/sky",   label: "Sky",   match: (p) => p.startsWith("/sky") },
    { href: "/docs",  label: "API",   match: (p) => p.startsWith("/docs") },
  ];

  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "0 1.5rem",
          display: "flex",
          alignItems: "flex-end",
          gap: "1.5rem",
        }}
      >
        <Link
          href="/"
          style={{
            color: "var(--fg)",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: "0.02em",
            padding: "1.25rem 0",
            marginRight: "auto",
          }}
        >
          <span style={{ color: "var(--accent)", marginRight: "0.5rem" }} aria-hidden="true">✦</span>
          Astro Calculator
        </Link>
        <nav style={{ display: "flex", gap: "1.25rem", marginBottom: -1 }}>
          {links.slice(1).map((l) => {
            const active = l.match(pathname);
            return (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  textDecoration: "none",
                  color: active ? "var(--fg)" : "var(--muted)",
                  fontSize: 14,
                  fontWeight: active ? 500 : 400,
                  padding: "1.25rem 0",
                  borderBottom: active
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                  letterSpacing: "0.02em",
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
