const ENDPOINTS: { method: string; path: string; what: string }[] = [
  { method: "POST", path: "/api/v1/astrology/natal", what: "Natal chart — positions, houses, aspects" },
  { method: "POST", path: "/api/v1/astrology/transits", what: "Current transit aspects to natal" },
  { method: "POST", path: "/api/v1/composite", what: "Composite (midpoint) chart from 2–10 people" },
  { method: "POST", path: "/api/v1/astrocartography", what: "MC/IC/AC/DC lines per planet" },
  { method: "POST", path: "/api/v1/human-design/chart", what: "Type, profile, channels, centers, authority" },
  { method: "POST", path: "/api/v1/gene-keys/profile", what: "Activation / Venus / Pearl Sequences" },
  { method: "POST", path: "/api/v1/life-path", what: "Pythagorean Life Path number" },
  { method: "POST", path: "/api/v1/destiny-card", what: "Olney Richmond Birth Card" },
];

const EXAMPLE = `curl -X POST http://localhost:3000/api/v1/astrology/natal \\
  -H "Content-Type: application/json" \\
  -d '{
    "datetime": "1980-07-15T14:30:00",
    "timezone": "America/New_York",
    "latitude": 40.7128,
    "longitude": -74.006,
    "house_system": "placidus"
  }'`;

export default function Home() {
  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "4rem 1.5rem 6rem" }}>
      <header style={{ marginBottom: "3rem" }}>
        <div style={{ color: "var(--muted)", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Public Calculator API · AGPL-3.0
        </div>
        <h1 style={{ fontSize: "2.4rem", margin: "0.6rem 0 1rem", letterSpacing: "-0.02em" }}>
          Astro Calculator
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "1.05rem", margin: 0 }}>
          Astrology, astrocartography, Human Design, Gene Keys, Life Path, and Destiny Cards.
          One HTTP API, Swiss Ephemeris precision, fully open source.
        </p>
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <a
            href="/chart"
            style={{
              display: "inline-block",
              background: "var(--accent)",
              color: "#1a1535",
              padding: "0.65rem 1.4rem",
              borderRadius: 8,
              fontWeight: 600,
              border: 0,
              fontSize: 15,
            }}
          >
            Generate a chart →
          </a>
          <a
            href="/sky"
            style={{
              display: "inline-block",
              background: "transparent",
              color: "var(--accent)",
              padding: "0.65rem 1.4rem",
              borderRadius: 8,
              fontWeight: 500,
              border: "1px solid var(--accent)",
              fontSize: 15,
            }}
          >
            Sky weather ⚹
          </a>
        </div>
      </header>

      <section style={{ marginBottom: "3rem" }}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 1rem" }}>Endpoints</h2>
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          {ENDPOINTS.map((e, i) => (
            <div
              key={e.path}
              style={{
                display: "grid",
                gridTemplateColumns: "70px 1fr",
                gap: "1rem",
                padding: "0.85rem 1rem",
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
                background: "var(--card)",
              }}
            >
              <span style={{ color: "var(--accent)", fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 600 }}>
                {e.method}
              </span>
              <div>
                <code style={{ background: "transparent", border: 0, padding: 0 }}>{e.path}</code>
                <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 2 }}>{e.what}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: "3rem" }}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 1rem" }}>Example</h2>
        <pre><code>{EXAMPLE}</code></pre>
      </section>

      <section style={{ marginBottom: "3rem" }}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 1rem" }}>Documentation</h2>
        <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
          <li><a href="/docs">Interactive Swagger UI</a></li>
          <li><a href="/api/openapi.json">OpenAPI 3.1 spec (JSON)</a></li>
          <li><a href="https://github.com/" target="_blank" rel="noreferrer">Source on GitHub</a></li>
        </ul>
      </section>

      <footer style={{ color: "var(--muted)", fontSize: 13, borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
        <p style={{ margin: 0 }}>
          Released under AGPL-3.0-or-later. Built on{" "}
          <a href="https://www.astro.com/swisseph/swephinfo_e.htm" target="_blank" rel="noreferrer">
            Swiss Ephemeris
          </a>{" "}
          via the{" "}
          <a href="https://github.com/timotejroiko/sweph" target="_blank" rel="noreferrer">
            sweph
          </a>{" "}
          Node.js bindings. Position data derived from JPL DE441.
        </p>
      </footer>
    </main>
  );
}
