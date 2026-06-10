"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type {
  Aspect,
  NatalChart,
  NatalPlanet,
  ProgressedChart,
  SolarReturnChart,
  SignPosition,
} from "@/lib/calculators/astrology";
import type { HumanDesignChart } from "@/lib/calculators/human-design";
import type { GeneKeysProfile, Sphere } from "@/lib/calculators/gene-keys";
import type { LifePathResult } from "@/lib/calculators/life-path";
import type { DestinyCardResult } from "@/lib/calculators/destiny-card";
import type {
  AstrocartographyResult,
  LineSegment,
  Paran,
  PlanetLines,
} from "@/lib/calculators/astrocartography";

interface BirthForm {
  name: string;
  date: string;
  time: string;
  timezone: string;
  latitude: string;
  longitude: string;
}

interface ChartResults {
  natal: NatalChart;
  hd: HumanDesignChart;
  gk: GeneKeysProfile;
  lifePath: LifePathResult;
  destiny: DestinyCardResult;
  acg: AstrocartographyResult;
  progressions: ProgressedChart;
  solarReturn: SolarReturnChart;
}

// Default sample uses a public historical figure (Einstein) so users can
// click "Generate" immediately without entering data. Pick a different name
// to clear and enter your own.
const SAMPLE: BirthForm = {
  name: "Albert Einstein",
  date: "1879-03-14",
  time: "11:30",
  timezone: "Europe/Berlin",
  latitude: "48.4011",
  longitude: "9.9876",
};

const COMMON_TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Athens",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata", "Asia/Dubai",
  "Australia/Sydney", "Pacific/Auckland", "UTC",
];

async function callApi<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok || j.error) {
    // Surface field-level validation details when present.
    const baseMsg = j.error?.message ?? "API error";
    const details = j.error?.details;
    let extra = "";
    if (details && typeof details === "object") {
      const fieldErrors = (details as { fieldErrors?: Record<string, string[]> }).fieldErrors;
      if (fieldErrors) {
        const issues = Object.entries(fieldErrors)
          .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
          .join(" · ");
        if (issues) extra = ` — ${issues}`;
      }
    }
    throw new Error(`${path.split("/").pop()}: ${baseMsg}${extra}`);
  }
  return j.data as T;
}

interface GeocodeResult {
  display_name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export default function ChartPage() {
  const [form, setForm] = useState<BirthForm>(SAMPLE);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ChartResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [placeQuery, setPlaceQuery] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoOptions, setGeoOptions] = useState<GeocodeResult[]>([]);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoOpen, setGeoOpen] = useState(false);
  const lastQueryRef = useRef<string>("");
  const cityFieldRef = useRef<HTMLDivElement>(null);

  // Click outside the city combobox closes the dropdown.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!cityFieldRef.current) return;
      if (!cityFieldRef.current.contains(e.target as Node)) setGeoOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const update = (k: keyof BirthForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Debounced autocomplete: fire 300ms after the user stops typing, when the
  // query is at least 3 characters and hasn't already been resolved.
  useEffect(() => {
    const q = placeQuery.trim();
    if (q.length < 3) {
      setGeoOptions([]);
      setGeoError(null);
      return;
    }
    if (q === lastQueryRef.current) return;
    const handle = setTimeout(() => {
      lastQueryRef.current = q;
      runGeocode(q);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeQuery]);

  async function runGeocode(q: string) {
    setGeoError(null);
    setGeoLoading(true);
    try {
      const r = await fetch("/api/v1/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, limit: 6 }),
      });
      const j = await r.json();
      // Stale-response guard: if the user kept typing while this request was
      // in flight, drop the result on the floor.
      if (lastQueryRef.current !== q) return;
      if (!r.ok || j.error) throw new Error(j.error?.message ?? "Geocoder error");
      const results = (j.data?.results ?? []) as GeocodeResult[];
      setGeoOptions(results);
      setGeoOpen(true);
      if (results.length === 0) setGeoError("No matches. Try a different spelling.");
    } catch (err) {
      if (lastQueryRef.current === q) {
        setGeoError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (lastQueryRef.current === q) setGeoLoading(false);
    }
  }

  function applyGeocoded(g: GeocodeResult) {
    setForm((f) => ({
      ...f,
      latitude: g.latitude.toFixed(4),
      longitude: g.longitude.toFixed(4),
      timezone: g.timezone,
    }));
    setPlaceQuery(g.display_name);
    lastQueryRef.current = g.display_name;
    setGeoOptions([]);
    setGeoOpen(false);
    setGeoError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);
    setLoading(true);
    try {
      const datetime = `${form.date}T${form.time}:00`;
      const lat = parseFloat(form.latitude);
      const lon = parseFloat(form.longitude);
      const birth = { datetime, timezone: form.timezone, latitude: lat, longitude: lon };
      const natalBody = { ...birth, house_system: "placidus", planets: ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "true_node", "chiron", "mean_lilith"] };
      const rawAge = new Date().getFullYear() - parseInt(form.date.slice(0, 4));
      // Cap progressions at 100 years — that's the most a "day for a year"
      // chart sensibly represents; older historical figures still get a
      // meaningful read at age 100. Negative ages (future birthdays) clamp to 0.
      const progBody = { ...birth, years: Math.max(0, Math.min(rawAge, 100)) };
      const srBody = { natal: { ...birth, house_system: "placidus" }, year: new Date().getFullYear() };
      const dateBody = { date: form.date };

      const [natal, hd, gk, lifePath, destiny, acg, progressions, solarReturn] = await Promise.all([
        callApi<NatalChart>("/api/v1/astrology/natal", natalBody),
        callApi<HumanDesignChart>("/api/v1/human-design/chart", birth),
        callApi<GeneKeysProfile>("/api/v1/gene-keys/profile", birth),
        callApi<LifePathResult>("/api/v1/life-path", dateBody),
        callApi<DestinyCardResult>("/api/v1/destiny-card", dateBody),
        callApi<AstrocartographyResult>("/api/v1/astrocartography", { ...birth, planets: ["sun", "moon", "venus", "mars", "jupiter", "saturn", "pluto"] }),
        callApi<ProgressedChart>("/api/v1/astrology/progressions", progBody),
        callApi<SolarReturnChart>("/api/v1/astrology/solar-return", srBody),
      ]);
      setResults({ natal, hd, gk, lifePath, destiny, acg, progressions, solarReturn });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "3rem 1.5rem 6rem" }}>
      <header style={{ marginBottom: "2.5rem" }}>
        <div style={{ color: "var(--muted)", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Chart Calculator · Live
        </div>
        <h1 style={{ fontSize: "2.2rem", margin: "0.5rem 0 0.6rem", letterSpacing: "-0.02em" }}>Generate a chart</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Astrology, astrocartography, Human Design, Gene Keys, Life Path, Destiny Cards — all in one go.{" "}
          <a href="/">See API docs</a>
        </p>
      </header>

      {/* Screen-reader-only live regions for loading + error announcements. */}
      <div role="status" aria-live="polite" className="sr-only">
        {loading ? "Calculating chart" : results ? "Chart ready" : ""}
      </div>

      <form onSubmit={handleSubmit} aria-busy={loading} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.5rem", marginBottom: "2rem" }}>
        <div className="stack-on-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem 1.25rem" }}>
          <Field label="Name (optional)" full>
            <input type="text" value={form.name} onChange={update("name")} placeholder="e.g. Matthew Miceli" />
          </Field>
          <Field label="Birth date">
            <input type="date" value={form.date} onChange={update("date")} required />
          </Field>
          <Field label="Birth time (24h)">
            <input type="time" value={form.time} onChange={update("time")} required />
          </Field>
          <Field label="Birthplace (city) — auto-fills lat/lon + timezone as you type" full>
            <div ref={cityFieldRef} style={{ position: "relative" }}>
              <input
                type="text"
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                onFocus={() => { if (geoOptions.length > 0) setGeoOpen(true); }}
                onKeyDown={(e) => {
                  // Don't let Enter submit the outer form while user is typing in
                  // the city search; instead, pick the first result if open.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (geoOpen && geoOptions.length > 0) applyGeocoded(geoOptions[0]);
                  } else if (e.key === "Escape") {
                    setGeoOpen(false);
                  }
                }}
                placeholder='Start typing — e.g. "New Orleans" or "Berlin"'
                aria-autocomplete="list"
                aria-controls="geo-listbox"
                aria-expanded={geoOpen && geoOptions.length > 0}
              />
              {geoLoading && (
                <div aria-hidden="true" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--muted)" }}>
                  searching…
                </div>
              )}
              {geoOpen && geoOptions.length > 0 && (
                <div
                  id="geo-listbox"
                  role="listbox"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    background: "var(--code-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    overflow: "hidden",
                    maxHeight: 280,
                    overflowY: "auto",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  }}
                >
                  {geoOptions.map((g, i) => (
                    <button
                      key={i}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => applyGeocoded(g)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        background: "transparent",
                        border: 0,
                        color: "var(--fg)",
                        padding: "0.6rem 0.75rem",
                        borderTop: i === 0 ? "0" : "1px solid var(--border)",
                        cursor: "pointer",
                        fontSize: 13,
                        fontFamily: "inherit",
                      }}
                    >
                      {g.display_name}
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontFamily: "ui-monospace, monospace" }}>
                        {g.latitude.toFixed(4)}, {g.longitude.toFixed(4)} · {g.timezone}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {geoError && (
              <div role="alert" style={{ color: "#ff6b6b", fontSize: 12, marginTop: 6 }}>{geoError}</div>
            )}
          </Field>
          <Field label="Timezone (IANA)" full>
            <select value={form.timezone} onChange={update("timezone")} required>
              {COMMON_TIMEZONES.includes(form.timezone) ? null : (
                <option value={form.timezone}>{form.timezone} (from city)</option>
              )}
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </Field>
          <Field label="Latitude (°N positive)">
            <input type="number" step="0.0001" min={-90} max={90} value={form.latitude} onChange={update("latitude")} required />
          </Field>
          <Field label="Longitude (°E positive)">
            <input type="number" step="0.0001" min={-180} max={180} value={form.longitude} onChange={update("longitude")} required />
          </Field>
        </div>
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" disabled={loading} style={{
            background: "var(--accent)", color: "#1a1535", border: 0, borderRadius: 8,
            padding: "0.75rem 1.4rem", fontWeight: 600, cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.6 : 1, fontSize: 15, minHeight: 44,
          }}>
            {loading ? "Calculating…" : "Generate chart"}
          </button>
          <button type="button" onClick={() => setForm(SAMPLE)} style={{
            background: "transparent", color: "var(--muted)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "0.7rem 1rem", cursor: "pointer", fontSize: 14, minHeight: 44,
          }}>Reset to sample</button>
          {error && (
            <span role="alert" style={{ color: "#ff6b6b", marginLeft: "0.5rem", fontSize: 14 }}>
              {error}
            </span>
          )}
        </div>
      </form>

      {results && <ResultsView form={form} r={results} />}
    </main>
  );
}

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label style={{ display: "block", gridColumn: full ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</div>
      <FieldInputWrap>{children}</FieldInputWrap>
    </label>
  );
}

function FieldInputWrap({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "block" }}>
      <style>{`
        .chart-form input, .chart-form select { width: 100%; background: var(--code-bg); border: 1px solid var(--border); color: var(--fg); padding: 0.7rem 0.7rem; border-radius: 7px; font-size: 16px; font-family: inherit; min-height: 44px; }
      `}</style>
      <div className="chart-form">{children}</div>
    </div>
  );
}

// ─── Results ────────────────────────────────────────────────────────────────

function fmtSign(s: { sign?: SignPosition } | undefined | null): string {
  if (!s?.sign) return "";
  return `${s.sign.degree}°${String(s.sign.minute).padStart(2, "0")}' ${s.sign.sign}`;
}

function ResultsView({ form, r }: { form: BirthForm; r: ChartResults }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <Header form={form} />
      <SnapshotCard r={r} />
      <AstrologyCard chart={r.natal} />
      <HumanDesignCard hd={r.hd} />
      <GeneKeysCard gk={r.gk} />
      <NumerologyCard lp={r.lifePath} dc={r.destiny} />
      <ProgressionsCard prog={r.progressions} />
      <SolarReturnCard sr={r.solarReturn} />
      <AstrocartographyCard acg={r.acg} />
    </div>
  );
}

function Header({ form }: { form: BirthForm }) {
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
      <div style={{ color: "var(--muted)", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>Chart for</div>
      <h2 style={{ margin: "0.3rem 0", fontSize: "1.7rem" }}>{form.name || "Anonymous"}</h2>
      <div style={{ color: "var(--muted)", fontSize: 14 }}>
        {form.date} · {form.time} · {form.timezone} · {form.latitude}, {form.longitude}
      </div>
    </div>
  );
}

function Card({ title, accent, children }: { title: string; accent?: string; children: ReactNode }) {
  return (
    <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.5rem" }}>
      <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem", letterSpacing: "-0.01em" }}>
        {accent && <span aria-hidden="true" style={{ color: "var(--accent)", marginRight: "0.5rem" }}>{accent}</span>}
        {title}
      </h3>
      {children}
    </section>
  );
}

function KV({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="kv-stack-on-mobile" style={{ display: "flex", gap: "0.75rem", padding: "0.35rem 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ flex: "0 0 180px", color: "var(--muted)", fontSize: 13 }}>{k}</div>
      <div style={{ flex: 1, fontFamily: mono ? "ui-monospace, monospace" : undefined, fontSize: mono ? 13 : 14, minWidth: 0, wordBreak: "break-word" }}>{v}</div>
    </div>
  );
}

function TableWrap({ children }: { children: ReactNode }) {
  return <div style={{ overflowX: "auto", maxWidth: "100%" }}>{children}</div>;
}

function SnapshotCard({ r }: { r: ChartResults }) {
  const sun = r.natal.planets.find((p) => p.name === "sun");
  const moon = r.natal.planets.find((p) => p.name === "moon");
  const asc = r.natal.houses.ascendant;
  if (!sun || !moon) return null;
  return (
    <Card title="Snapshot" accent="✦">
      <div className="stack-on-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <Big label="Sun" symbol="☉" value={sun.sign.sign} sub={fmtSign(sun)} />
        <Big label="Moon" symbol="☽" value={moon.sign.sign} sub={fmtSign(moon)} />
        <Big label="Ascendant" symbol="↑" value={asc.sign.sign} sub={fmtSign(asc)} />
        <Big label="HD Type" value={r.hd.type} sub={r.hd.profile + " · " + r.hd.authority} />
        <Big label="Life's Work" value={`${r.gk.activation.lifesWork.gate}.${r.gk.activation.lifesWork.line}`} sub="Gene Key" />
        <Big label="Birth Card" value={r.destiny.birthCard.symbol} sub={r.destiny.birthCard.name} />
      </div>
    </Card>
  );
}

function Big({ label, value, sub, symbol }: { label: string; value: string; sub?: string; symbol?: string }) {
  return (
    <div style={{ background: "var(--code-bg)", borderRadius: 8, padding: "0.9rem 1rem", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {symbol && <span aria-hidden="true" style={{ marginRight: 4 }}>{symbol}</span>}
        {label}
      </div>
      <div style={{ fontSize: "1.35rem", fontWeight: 600, margin: "0.2rem 0" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--muted)" }}>{sub}</div>}
    </div>
  );
}

function AstrologyCard({ chart }: { chart: NatalChart }) {
  return (
    <Card title="Western Astrology" accent="☉">
      <h4 style={{ margin: "0 0 0.5rem", color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>Planets</h4>
      <TableWrap>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--muted)", textAlign: "left" }}>
              <th scope="col" style={{ padding: "4px 8px" }}>Body</th>
              <th scope="col" style={{ padding: "4px 8px" }}>Position</th>
              <th scope="col" style={{ padding: "4px 8px" }}>House</th>
              <th scope="col" style={{ padding: "4px 8px" }}>
                <span className="sr-only">Retrograde</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {chart.planets.map((p) => (
              <tr key={p.name} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "5px 8px" }}>{p.name.replace("_", " ")}</td>
                <td style={{ padding: "5px 8px", fontFamily: "ui-monospace, monospace" }}>{fmtSign(p)}</td>
                <td style={{ padding: "5px 8px" }}>{p.house}</td>
                <td style={{ padding: "5px 8px", color: "var(--muted)" }} aria-label={p.retrograde ? "retrograde" : ""}>{p.retrograde ? "℞" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <div className="stack-on-mobile" style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.4rem" }}>
        <KV k="Ascendant" v={fmtSign(chart.houses.ascendant)} mono />
        <KV k="Midheaven (MC)" v={fmtSign(chart.houses.midheaven)} mono />
        <KV k="Vertex" v={fmtSign(chart.houses.vertex)} mono />
        <KV k="Part of Fortune" v={`${fmtSign(chart.partOfFortune)} · H${chart.partOfFortune.house}`} mono />
      </div>
      <details style={{ marginTop: "1rem" }}>
        <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 13 }}>
          Aspects ({chart.aspects.length} total — click to expand)
        </summary>
        <div className="stack-on-mobile" style={{ marginTop: "0.75rem", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.3rem 1rem", fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
          {chart.aspects.slice().sort((a, b) => a.orb - b.orb).map((a, i) => (
            <div key={i}>
              {a.from} <span aria-hidden="true" style={{ color: "var(--accent)" }}>{aspSym(a.type)}</span> {a.to}{" "}
              <span style={{ color: "var(--muted)" }}>({a.orb.toFixed(2)}°)</span>
            </div>
          ))}
        </div>
      </details>
    </Card>
  );
}

function aspSym(t: Aspect["type"]): string {
  const map: Record<Aspect["type"], string> = {
    conjunction: "☌", opposition: "☍", trine: "△", square: "□", sextile: "⚹", quincunx: "⚻",
  };
  return map[t] ?? t;
}

function HumanDesignCard({ hd }: { hd: HumanDesignChart }) {
  return (
    <Card title="Human Design" accent="◈">
      <KV k="Type" v={hd.type} />
      <KV k="Strategy" v={hd.strategy} />
      <KV k="Authority" v={hd.authority} />
      <KV k="Profile" v={hd.profile} />
      <KV k="Definition" v={hd.definition} />
      <KV k="Defined centers" v={hd.definedCenters.join(", ")} />
      <KV k="Channels" v={hd.channels.map((c) => `${c.gates[0]}-${c.gates[1]} ${c.name}`).join(" · ")} />
      <KV k="Incarnation Cross" v={hd.incarnationCross.name} />
      <h4 style={{ margin: "1.25rem 0 0.5rem", color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>Variables (4 arrows)</h4>
      <div className="stack-on-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.4rem 1rem" }}>
        <KV k="Digestion (PHS)" v={`${hd.variables.digestion.name} · ${hd.variables.digestion.direction}`} />
        <KV k="Environment" v={`${hd.variables.environment.name} · ${hd.variables.environment.direction}`} />
        <KV k="Perspective" v={`${hd.variables.perspective.name} · ${hd.variables.perspective.direction}`} />
        <KV k="Motivation" v={`${hd.variables.motivation.name} · ${hd.variables.motivation.direction}`} />
      </div>
    </Card>
  );
}

function GeneKeysCard({ gk }: { gk: GeneKeysProfile }) {
  const rows: [string, Sphere][] = [
    ["Life's Work", gk.activation.lifesWork],
    ["Evolution", gk.activation.evolution],
    ["Radiance", gk.activation.radiance],
    ["Purpose", gk.activation.purpose],
    ["Attraction", gk.venus.attraction],
    ["IQ", gk.venus.iq],
    ["EQ", gk.venus.eq],
    ["SQ", gk.venus.sq],
    ["Core", gk.venus.core],
    ["Pearl / Vocation", gk.pearl.vocation],
    ["Culture", gk.pearl.culture],
  ];
  return (
    <Card title="Gene Keys (Hologenetic Profile)" accent="✺">
      <TableWrap>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <tbody>
            {rows.map(([name, s]) => (
              <tr key={name} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "5px 8px", color: "var(--muted)" }}>{name}</td>
                <td style={{ padding: "5px 8px", fontFamily: "ui-monospace, monospace" }}>{s.gate}.{s.line}</td>
                <td style={{ padding: "5px 8px", color: "var(--muted)", fontSize: 12 }}>{s.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Card>
  );
}

function NumerologyCard({ lp, dc }: { lp: LifePathResult; dc: DestinyCardResult }) {
  return (
    <Card title="Life Path & Destiny Card" accent="✦">
      <KV k="Life Path" v={`${lp.lifePath}${lp.isMaster ? " (Master)" : ""}`} />
      <KV k="Birthday number" v={lp.birthday} />
      <KV k="Reduction" v={lp.reduction.join(" → ")} mono />
      <KV k="Birth Card" v={`${dc.birthCard.symbol} · ${dc.birthCard.name}`} />
    </Card>
  );
}

function ProgressionsCard({ prog }: { prog: ProgressedChart }) {
  return (
    <Card title={`Secondary Progressions (age ${prog.years})`} accent="↻">
      <TableWrap>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <tbody>
            {prog.planets.map((p) => (
              <tr key={p.name} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "5px 8px" }}>{p.name}</td>
                <td style={{ padding: "5px 8px", fontFamily: "ui-monospace, monospace" }}>{fmtSign(p)}</td>
                <td style={{ padding: "5px 8px", color: "var(--muted)" }} aria-label={p.retrograde ? "retrograde" : ""}>{p.retrograde ? "℞" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Card>
  );
}

function SolarReturnCard({ sr }: { sr: SolarReturnChart }) {
  const sun = sr.planets.find((p: NatalPlanet) => p.name === "sun");
  const moon = sr.planets.find((p: NatalPlanet) => p.name === "moon");
  if (!sun || !moon) return null;
  return (
    <Card title={`Solar Return ${sr.year}`} accent="☀">
      <KV k="Return Sun" v={`${fmtSign(sun)} · H${sun.house}`} mono />
      <KV k="Return Moon" v={`${fmtSign(moon)} · H${moon.house}`} mono />
      <KV k="Return ASC" v={fmtSign(sr.houses.ascendant)} mono />
      <KV k="Return MC" v={fmtSign(sr.houses.midheaven)} mono />
      <KV k="Return Part of Fortune" v={`${fmtSign(sr.partOfFortune)} · H${sr.partOfFortune.house}`} mono />
      <div style={{ marginTop: "0.5rem", fontSize: 12, color: "var(--muted)" }}>
        {sr.relocated ? "Relocated chart." : "Cast at natal location (default)."}
      </div>
    </Card>
  );
}

function AstrocartographyCard({ acg }: { acg: AstrocartographyResult }) {
  return (
    <Card title="Astrocartography" accent="✧">
      <h4 style={{ margin: "0 0 0.5rem", color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>MC line longitudes (career / public)</h4>
      <TableWrap>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <tbody>
            {acg.planets.map((p: PlanetLines) => {
              const mc = p.lines.find((l: LineSegment) => l.type === "MC");
              const ic = p.lines.find((l: LineSegment) => l.type === "IC");
              if (!mc || !ic) return null;
              return (
                <tr key={p.planet} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "5px 8px" }}>{p.planet}</td>
                  <td style={{ padding: "5px 8px", fontFamily: "ui-monospace, monospace" }}>MC {mc.coordinates[0].lon.toFixed(2)}°</td>
                  <td style={{ padding: "5px 8px", fontFamily: "ui-monospace, monospace" }}>IC {ic.coordinates[0].lon.toFixed(2)}°</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
      <details style={{ marginTop: "1rem" }}>
        <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 13 }}>
          Parans — line crossings ({acg.parans.length} total)
        </summary>
        <div style={{ marginTop: "0.75rem", maxHeight: "300px", overflowY: "auto", fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
          {acg.parans.slice(0, 50).map((p: Paran, i: number) => (
            <div key={i} style={{ padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--muted)" }}>{p.latitude >= 0 ? "+" : ""}{p.latitude.toFixed(2)}°, {p.longitude.toFixed(2)}°</span>
              {" — "}
              {p.planet1} {p.angle1} × {p.planet2} {p.angle2}
            </div>
          ))}
          {acg.parans.length > 50 && <div style={{ padding: "6px 0", color: "var(--muted)" }}>… and {acg.parans.length - 50} more</div>}
        </div>
      </details>
    </Card>
  );
}
