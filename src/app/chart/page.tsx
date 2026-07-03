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
import type { TransitEvent, TransitEventsResult } from "@/lib/calculators/transit-events";
import type { SynastryResult } from "@/lib/calculators/synastry";
import { BirthFormFields, type BirthForm as SharedBirthForm } from "../_birth-form";

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
  return <div className="birth-input">{children}</div>;
}

// ─── Results ────────────────────────────────────────────────────────────────

function fmtSign(s: { sign?: SignPosition } | undefined | null): string {
  if (!s?.sign) return "";
  return `${s.sign.degree}°${String(s.sign.minute).padStart(2, "0")}' ${s.sign.sign}`;
}

type ResultsTab = "chart" | "transits" | "synastry";

function ResultsView({ form, r }: { form: BirthForm; r: ChartResults }) {
  const [tab, setTab] = useState<ResultsTab>("chart");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <Header form={form} />
      <TabBar active={tab} onChange={setTab} />
      {tab === "chart" && (
        <>
          <SnapshotCard r={r} />
          <AstrologyCard chart={r.natal} />
          <HumanDesignCard hd={r.hd} />
          <GeneKeysCard gk={r.gk} />
          <NumerologyCard lp={r.lifePath} dc={r.destiny} />
          <ProgressionsCard prog={r.progressions} />
          <SolarReturnCard sr={r.solarReturn} />
          <AstrocartographyCard acg={r.acg} />
        </>
      )}
      {tab === "transits" && <TransitsTab form={form} />}
      {tab === "synastry" && <SynastryTab form={form} />}
    </div>
  );
}

function TabBar({ active, onChange }: { active: ResultsTab; onChange: (t: ResultsTab) => void }) {
  const tabs: { id: ResultsTab; label: string }[] = [
    { id: "chart", label: "Chart" },
    { id: "transits", label: "Transits" },
    { id: "synastry", label: "Synastry" },
  ];
  return (
    <div style={{ display: "flex", gap: "1.5rem", borderBottom: "1px solid var(--border)" }}>
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              background: "none",
              border: "none",
              padding: "0.75rem 0",
              marginBottom: -1,
              color: isActive ? "var(--text)" : "var(--muted)",
              borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
              fontSize: 15,
              fontWeight: isActive ? 600 : 400,
              letterSpacing: "0.02em",
              transition: "color 0.15s",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

const TRANSIT_YEAR_OPTIONS = [1, 3, 5, 10, 20] as const;

function TransitsTab({ form }: { form: BirthForm }) {
  const [years, setYears] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<TransitEvent[] | null>(null);
  const [rangeMeta, setRangeMeta] = useState<{ start: string; end: string } | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const start = new Date();
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + years);
      const startStr = fmtISODate(start);
      const endStr = fmtISODate(end);
      const body = {
        natal: {
          datetime: `${form.date}T${form.time}:00`,
          timezone: form.timezone,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
        },
        start_date: startStr,
        end_date: endStr,
      };
      const result = await callApi<TransitEventsResult>("/api/v1/transit/events", body);
      setEvents(result.events);
      setRangeMeta({ start: startStr, end: endStr });
    } catch (e) {
      setError((e as Error).message);
      setEvents(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Transits" accent="⚹">
      <div
        className="stack-on-mobile"
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "0.5rem 0 1.25rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <label style={{ color: "var(--muted)", fontSize: 14 }}>
          Scan window:{" "}
          <select
            value={years}
            onChange={(e) => setYears(parseInt(e.target.value, 10))}
            style={{
              marginLeft: "0.5rem",
              background: "var(--card)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "0.4rem 0.6rem",
              fontSize: 14,
            }}
          >
            {TRANSIT_YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y} year{y === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          style={{
            background: loading ? "var(--border)" : "var(--accent)",
            color: loading ? "var(--muted)" : "var(--bg)",
            border: "none",
            padding: "0.5rem 1.25rem",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Computing…" : events ? "Regenerate" : "Generate transits"}
        </button>
        {rangeMeta && (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            {rangeMeta.start} → {rangeMeta.end}
          </div>
        )}
      </div>
      {error && (
        <div style={{ color: "#ff8b8b", padding: "1rem 0", fontSize: 14 }}>{error}</div>
      )}
      {!events && !loading && !error && (
        <div style={{ color: "var(--muted)", padding: "1.5rem 0", fontSize: 14 }}>
          Select a scan window and generate to see your upcoming transit events.
          The scanner detects when the outer planets (Jupiter, Saturn, Chiron,
          Uranus, Neptune, Pluto, Nodes) form aspects to your natal chart, and
          merges retrograde loops into single events with multiple exact-aspect
          peaks.
        </div>
      )}
      {events && <EventsList events={events} />}
    </Card>
  );
}

function EventsList({ events }: { events: TransitEvent[] }) {
  if (events.length === 0) {
    return (
      <div style={{ color: "var(--muted)", padding: "1.5rem 0", fontSize: 14 }}>
        No transit events in the selected window with default settings.
      </div>
    );
  }
  const byYear = new Map<string, TransitEvent[]>();
  for (const e of events) {
    const y = e.orbEnter.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(e);
  }
  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: 13, padding: "0.75rem 0 1rem" }}>
        {events.length} event{events.length === 1 ? "" : "s"} across {byYear.size} year{byYear.size === 1 ? "" : "s"}
      </div>
      {[...byYear.entries()].map(([year, evs]) => (
        <div key={year} style={{ marginBottom: "1.5rem" }}>
          <h4
            style={{
              margin: "0 0 0.75rem",
              fontSize: 15,
              letterSpacing: "0.05em",
              color: "var(--muted)",
              fontWeight: 500,
              textTransform: "uppercase",
            }}
          >
            {year} · {evs.length}
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {evs.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventRow({ e }: { e: TransitEvent }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "0.5rem 1rem",
        padding: "0.75rem",
        borderRadius: 6,
        background: "var(--bg)",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: 14, minWidth: 0 }}>
        <span style={{ fontWeight: 500 }}>{cap(e.transitPlanet)}</span>
        <span style={{ margin: "0 0.5rem", color: "var(--muted)" }}>{aspSymbol(e.aspect)}</span>
        <span style={{ fontWeight: 500 }}>natal {cap(e.natalPoint)}</span>
        <span style={{ color: "var(--muted)" }}>
          {" "}in {e.natalSign}
          {e.natalHouse ? ` · house ${e.natalHouse}` : ""}
        </span>
        {e.isRetrogradeLoop && (
          <span
            style={{
              marginLeft: "0.75rem",
              fontSize: 11,
              padding: "0.1rem 0.5rem",
              background: "var(--accent)",
              color: "var(--bg)",
              borderRadius: 3,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Rx loop · {e.peaks.length} peaks
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--muted)",
          fontFamily: "ui-monospace, monospace",
          textAlign: "right",
          whiteSpace: "nowrap",
        }}
      >
        {e.orbEnter} → {e.orbLeave}
      </div>
      <div
        style={{
          gridColumn: "1 / -1",
          fontSize: 12,
          color: "var(--muted)",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        Peak{e.peaks.length === 1 ? "" : "s"}: {e.peaks.join(" · ")}
      </div>
    </div>
  );
}

const SYNASTRY_SAMPLE_B: SharedBirthForm = {
  name: "Princess Diana",
  date: "1961-07-01",
  time: "19:45",
  timezone: "Europe/London",
  latitude: "52.8333",
  longitude: "0.5000",
};

function SynastryTab({ form: personA }: { form: BirthForm }) {
  // Second person's birth data — separate from the primary chart's form.
  // Defaults to Diana as a companion to the Einstein primary sample so the
  // "Compute synastry" button works on a fresh visit.
  const [personB, setPersonB] = useState<SharedBirthForm>(SYNASTRY_SAMPLE_B);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SynastryResult | null>(null);

  function birthPayload(f: { date: string; time: string; timezone: string; latitude: string; longitude: string }) {
    return {
      datetime: `${f.date}T${f.time}:00`,
      timezone: f.timezone,
      latitude: parseFloat(f.latitude),
      longitude: parseFloat(f.longitude),
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = {
        personA: birthPayload(personA),
        personB: birthPayload(personB),
      };
      const r = await callApi<SynastryResult>("/api/v1/synastry", body);
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const personAName = personA.name || "Person A";
  const personBName = personB.name || "Person B";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <div style={{ color: "var(--muted)", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Synastry
        </div>
        <h2 style={{ margin: "0.3rem 0 0.4rem", fontSize: "1.7rem", letterSpacing: "-0.02em" }}>
          {personAName} <span style={{ color: "var(--accent)", margin: "0 0.35rem" }}>⚭</span> …
        </h2>
        <p style={{ color: "var(--muted)", margin: 0, fontSize: 14 }}>
          Enter a second person&apos;s birth data. Returns inter-chart aspects, HD gate co-activations, and both directions of house overlays.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        aria-busy={loading}
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "1.5rem",
        }}
      >
        <div style={{ color: "var(--muted)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "1rem" }}>
          Person B
        </div>
        <BirthFormFields value={personB} onChange={setPersonB} idPrefix="synastry-b" />
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              background: "var(--accent)",
              color: "#1a1535",
              border: 0,
              borderRadius: 8,
              padding: "0.75rem 1.4rem",
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.6 : 1,
              fontSize: 15,
              minHeight: 44,
            }}
          >
            {loading ? "Computing…" : result ? "Recompute synastry" : "Compute synastry"}
          </button>
          <button
            type="button"
            onClick={() => setPersonB(SYNASTRY_SAMPLE_B)}
            style={{
              background: "transparent",
              color: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.7rem 1rem",
              cursor: "pointer",
              fontSize: 14,
              minHeight: 44,
            }}
          >
            Reset to sample
          </button>
          {error && (
            <span role="alert" style={{ color: "#ff6b6b", marginLeft: "0.5rem", fontSize: 14 }}>{error}</span>
          )}
        </div>
      </form>

      {result && <SynastryResultView result={result} personAName={personAName} personBName={personBName} />}
    </div>
  );
}

function SynastryResultView({
  result,
  personAName,
  personBName,
}: {
  result: SynastryResult;
  personAName: string;
  personBName: string;
}) {
  return (
    <>
      <Card title="Inter-chart aspects" accent="⚭">
        <SynastryAspectsSection result={result} personAName={personAName} personBName={personBName} />
      </Card>
      <Card title="House overlays" accent="⌂">
        <SynastryHouseOverlaySection result={result} personAName={personAName} personBName={personBName} />
      </Card>
      <Card title="Human Design co-activations" accent="◈">
        <SynastryHdSection result={result} personAName={personAName} personBName={personBName} />
      </Card>
    </>
  );
}

function SynastryAspectsSection({
  result,
  personAName,
  personBName,
}: {
  result: SynastryResult;
  personAName: string;
  personBName: string;
}) {
  const aspects = [...result.aspects].sort((a, b) => a.orb - b.orb);
  if (aspects.length === 0) {
    return <div style={{ color: "var(--muted)", fontSize: 14 }}>No aspects within default orbs.</div>;
  }
  return (
    <>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: "0.5rem" }}>
        {aspects.length} aspect{aspects.length === 1 ? "" : "s"} · showing tightest first
      </div>
      {aspects.slice(0, 40).map((a, i) => (
        <div
          key={`${a.transitPoint}-${a.natalPoint}-${a.aspect}-${i}`}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "0.5rem 1rem",
            padding: "0.55rem 0",
            borderBottom: "1px solid var(--border)",
            fontSize: 14,
          }}
        >
          <div>
            <span style={{ color: "var(--muted)" }}>{personBName}&apos;s</span>{" "}
            <span style={{ fontWeight: 500 }}>{cap(a.transitPoint)}</span>
            <span style={{ margin: "0 0.5rem", color: "var(--accent)" }}>{aspSymbol(a.aspect)}</span>
            <span style={{ color: "var(--muted)" }}>{personAName}&apos;s</span>{" "}
            <span style={{ fontWeight: 500 }}>{cap(a.natalPoint)}</span>
            {a.natalSign && <span style={{ color: "var(--muted)" }}> in {a.natalSign}</span>}
          </div>
          <div style={{ color: "var(--muted)", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
            orb {a.orb.toFixed(1)}°
          </div>
        </div>
      ))}
      {aspects.length > 40 && (
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: "0.75rem", fontStyle: "italic" }}>
          Showing 40 tightest of {aspects.length} · tighten orbs for a shorter list.
        </div>
      )}
    </>
  );
}

function SynastryHouseOverlaySection({
  result,
  personAName,
  personBName,
}: {
  result: SynastryResult;
  personAName: string;
  personBName: string;
}) {
  return (
    <div className="stack-on-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
      <HouseOverlayColumn
        heading={`${personBName}'s planets in ${personAName}'s houses`}
        overlays={result.bOnA.houseOverlays}
      />
      <HouseOverlayColumn
        heading={`${personAName}'s planets in ${personBName}'s houses`}
        overlays={result.aOnB.houseOverlays}
      />
    </div>
  );
}

function HouseOverlayColumn({
  heading,
  overlays,
}: {
  heading: string;
  overlays: SynastryResult["bOnA"]["houseOverlays"];
}) {
  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: "0.5rem" }}>
        {heading}
      </div>
      {overlays.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13 }}>—</div>
      ) : (
        overlays.map((h, i) => (
          <div
            key={`${h.transitPoint}-${i}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "0.3rem 0",
              borderBottom: "1px solid var(--border)",
              fontSize: 13,
            }}
          >
            <span>{cap(h.transitPoint)}</span>
            <span style={{ color: "var(--muted)", fontFamily: "ui-monospace, monospace" }}>
              House {h.inNatalHouse}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function SynastryHdSection({
  result,
  personAName,
  personBName,
}: {
  result: SynastryResult;
  personAName: string;
  personBName: string;
}) {
  // Filter to gates where the co-activation is meaningful — i.e., B's point
  // lands on a gate one of A's points also holds. That's the definition of
  // an HD connection-chart activation.
  const bActivatesA = result.bOnA.hdActivations.filter((a) => a.natalPointSharingGate !== "");
  const aActivatesB = result.aOnB.hdActivations.filter((a) => a.natalPointSharingGate !== "");
  if (bActivatesA.length === 0 && aActivatesB.length === 0) {
    return (
      <div style={{ color: "var(--muted)", fontSize: 14 }}>
        No shared-gate activations between the two charts.
      </div>
    );
  }
  return (
    <div className="stack-on-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
      <HdColumn
        heading={`${personBName} lands on ${personAName}'s gates`}
        activations={bActivatesA}
      />
      <HdColumn
        heading={`${personAName} lands on ${personBName}'s gates`}
        activations={aActivatesB}
      />
    </div>
  );
}

function HdColumn({
  heading,
  activations,
}: {
  heading: string;
  activations: SynastryResult["bOnA"]["hdActivations"];
}) {
  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: "0.5rem" }}>{heading}</div>
      {activations.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13 }}>—</div>
      ) : (
        activations.map((a, i) => (
          <div
            key={`${a.transitPoint}-${a.gate}-${i}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "0.3rem 0",
              borderBottom: "1px solid var(--border)",
              fontSize: 13,
            }}
          >
            <span>{cap(a.transitPoint)}</span>
            <span style={{ color: "var(--muted)", fontFamily: "ui-monospace, monospace" }}>
              Gate {a.gate}.{a.line} <span style={{ color: "var(--accent)" }}>· with {cap(a.natalPointSharingGate)}</span>
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function fmtISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function aspSymbol(a: string): string {
  switch (a) {
    case "conjunction": return "☌";
    case "sextile":     return "⚹";
    case "square":      return "□";
    case "trine":       return "△";
    case "quincunx":    return "⚻";
    case "opposition":  return "☍";
    default:            return a;
  }
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
      <KV k="Signature" v={hd.signature} />
      <KV k="Not-Self theme" v={hd.notSelfTheme} />
      <KV k="Defined centers" v={hd.definedCenters.join(", ")} />
      <KV k="Channels" v={hd.channels.map((c) => `${c.gates[0]}-${c.gates[1]} ${c.name}`).join(" · ")} />
      <KV k="Incarnation Cross" v={hd.incarnationCross.name} />
      <h4 style={{ margin: "1.25rem 0 0.5rem", color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>Variables (4 arrows)</h4>
      <div className="stack-on-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.4rem 1rem" }}>
        <KV k="Digestion (PHS)" v={`${hd.variables.digestion.name} · ${hd.variables.digestion.direction}`} />
        <KV k="Environment" v={`${hd.variables.environment.name} · ${hd.variables.environment.direction}`} />
        <KV k="Perspective" v={`${hd.variables.perspective.name} · ${hd.variables.perspective.direction}`} />
        <KV k="Motivation" v={`${hd.variables.motivation.name} · ${hd.variables.motivation.direction}`} />
        <KV k="Cognition (Sense)" v={hd.variables.cognition.name} />
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
