"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { SkyEvent } from "@/lib/calculators/sky-events";

interface SkyEventsResponse {
  scannedDateRange: { start: string; end: string; days: number };
  events: SkyEvent[];
}

const YEAR_OPTIONS = [1, 3, 5, 10, 20] as const;

type Category = "retrograde" | "lunation" | "ingress" | "eclipse";
const CATEGORY_LABELS: Record<Category, string> = {
  retrograde: "Retrogrades",
  lunation: "Moon phases",
  ingress: "Ingresses",
  eclipse: "Eclipses",
};
const ALL_CATEGORIES: readonly Category[] = ["retrograde", "lunation", "ingress", "eclipse"];

async function fetchSky(body: unknown): Promise<SkyEventsResponse> {
  const r = await fetch("/api/v1/sky/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message ?? "sky events failed");
  return j.data as SkyEventsResponse;
}

export default function SkyPage() {
  const [years, setYears] = useState<number>(1);
  const [enabled, setEnabled] = useState<Set<Category>>(new Set(ALL_CATEGORIES));
  const [planetFilter, setPlanetFilter] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SkyEventsResponse | null>(null);

  useEffect(() => {
    void load(1);
  }, []);

  async function load(y: number) {
    setLoading(true);
    setError(null);
    try {
      const start = new Date();
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + y);
      const result = await fetchSky({
        start_date: fmtISODate(start),
        end_date: fmtISODate(end),
      });
      setData(result);
      setPlanetFilter(new Set());
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // Planets that appear in the loaded events (retrogrades + ingresses have a
  // `body`; lunations and eclipses do not, so they always pass this filter).
  const availablePlanets = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    for (const e of data.events) if (e.body) seen.add(e.body);
    const order = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
    return order.filter((p) => seen.has(p));
  }, [data]);

  const filteredEvents = useMemo(() => {
    if (!data) return [];
    return data.events.filter((e) => {
      const c = categoryOf(e.type);
      if (!c || !enabled.has(c)) return false;
      // Planet filter only applies to events with a body; empty set means "all".
      if (e.body && planetFilter.size > 0 && !planetFilter.has(e.body)) return false;
      return true;
    });
  }, [data, enabled, planetFilter]);

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "3rem 1.5rem 6rem" }}>
      <header style={{ marginBottom: "2.5rem" }}>
        <div style={{ color: "var(--muted)", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Sky Weather · Live
        </div>
        <h1 style={{ fontSize: "2.2rem", margin: "0.5rem 0 0.6rem", letterSpacing: "-0.02em" }}>What&apos;s coming up</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Retrograde stations, moon phases, sign ingresses, and eclipses — no birth chart required.
        </p>
      </header>

      <Controls
        years={years}
        enabled={enabled}
        availablePlanets={availablePlanets}
        planetFilter={planetFilter}
        onYearsChange={(y) => {
          setYears(y);
          void load(y);
        }}
        onToggleCategory={(cat) => {
          const next = new Set(enabled);
          if (next.has(cat)) next.delete(cat);
          else next.add(cat);
          setEnabled(next);
        }}
        onTogglePlanet={(p) => {
          const next = new Set(planetFilter);
          if (next.has(p)) next.delete(p);
          else next.add(p);
          setPlanetFilter(next);
        }}
        rangeMeta={data?.scannedDateRange ?? null}
        eventCount={filteredEvents.length}
        loading={loading}
      />

      {loading && (
        <div style={{ padding: "3rem 0", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
          Computing sky events…
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "1rem 1.25rem",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            color: "#ff8b8b",
            fontSize: 14,
            marginBottom: "1.5rem",
          }}
        >
          {error}
        </div>
      )}

      {!loading && data && <EventsFeed events={filteredEvents} />}
    </main>
  );
}

function Controls({
  years,
  enabled,
  availablePlanets,
  planetFilter,
  onYearsChange,
  onToggleCategory,
  onTogglePlanet,
  rangeMeta,
  eventCount,
  loading,
}: {
  years: number;
  enabled: Set<Category>;
  availablePlanets: string[];
  planetFilter: Set<string>;
  onYearsChange: (y: number) => void;
  onToggleCategory: (c: Category) => void;
  onTogglePlanet: (p: string) => void;
  rangeMeta: { start: string; end: string } | null;
  eventCount: number;
  loading: boolean;
}) {
  return (
    <section
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "1.5rem",
        marginBottom: "2rem",
      }}
    >
      <div className="stack-on-mobile" style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ color: "var(--muted)", fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Horizon
          </span>
          <select
            value={years}
            onChange={(e) => onYearsChange(parseInt(e.target.value, 10))}
            style={{
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "0.5rem 0.75rem",
              fontSize: 14,
              fontFamily: "inherit",
            }}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y} year{y === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </div>

        <div style={{ height: 22, width: 1, background: "var(--border)" }} aria-hidden="true" />

        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
          {ALL_CATEGORIES.map((cat) => {
            const on = enabled.has(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onToggleCategory(cat)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: on ? "var(--fg)" : "var(--muted)",
                  fontSize: 14,
                  fontWeight: on ? 500 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  letterSpacing: "0.02em",
                  borderBottom: on ? "1px solid var(--accent)" : "1px solid transparent",
                  paddingBottom: 2,
                  transition: "color 0.15s",
                }}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </div>

      {availablePlanets.length > 0 && (
        <div
          style={{
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem",
            alignItems: "center",
          }}
        >
          <span style={{
            color: "var(--muted)",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginRight: "0.25rem",
            minWidth: 54,
          }}>
            Planet
          </span>
          {availablePlanets.map((p) => {
            const on = planetFilter.has(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => onTogglePlanet(p)}
                aria-pressed={on}
                style={{
                  background: on ? "var(--accent)" : "transparent",
                  color: on ? "var(--bg)" : "var(--muted)",
                  border: on ? "1px solid var(--accent)" : "1px solid var(--border)",
                  padding: "0.25rem 0.6rem",
                  borderRadius: 999,
                  fontSize: 12,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                  lineHeight: 1.4,
                }}
              >
                {capitalize(p)}
              </button>
            );
          })}
          <span style={{ color: "var(--muted)", fontSize: 11, marginLeft: "0.5rem" }}>
            Applies to retrogrades &amp; ingresses only.
          </span>
        </div>
      )}

      {rangeMeta && !loading && (
        <div
          style={{
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border)",
            color: "var(--muted)",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <span>{rangeMeta.start} → {rangeMeta.end}</span>
          <span>{eventCount} event{eventCount === 1 ? "" : "s"}</span>
        </div>
      )}
    </section>
  );
}

function EventsFeed({ events }: { events: SkyEvent[] }) {
  if (events.length === 0) {
    return (
      <div style={{ padding: "3rem 0", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
        No events in the selected filters.
      </div>
    );
  }
  const byMonth = new Map<string, SkyEvent[]>();
  for (const ev of events) {
    const key = ev.datetime.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(ev);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {[...byMonth.entries()].map(([key, evs]) => (
        <Card key={key} title={formatMonth(key)} accent={monthAccentGlyph(key)}>
          <div>
            {evs.map((ev, i) => (
              <EventRow key={`${ev.datetime}-${ev.type}-${ev.body ?? "n"}-${i}`} ev={ev} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function EventRow({ ev }: { ev: SkyEvent }) {
  const meta = eventMeta(ev);
  return (
    <div
      className="sky-event-row"
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr auto",
        gap: "1rem",
        padding: "0.75rem 0",
        borderBottom: "1px solid var(--border)",
        alignItems: "baseline",
      }}
    >
      <div
        style={{
          color: "var(--muted)",
          fontSize: 12,
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.03em",
          whiteSpace: "nowrap",
        }}
      >
        {formatDayTime(ev.datetime)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14 }}>
          <span aria-hidden="true" style={{ color: "var(--accent)", marginRight: "0.5rem" }}>
            {meta.glyph}
          </span>
          {meta.title}
        </div>
        {meta.subtitle && (
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{meta.subtitle}</div>
        )}
      </div>
      <div
        style={{
          color: "var(--muted)",
          fontSize: 12,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {meta.kind}
      </div>
    </div>
  );
}

function Card({ title, accent, children }: { title: string; accent?: string; children: ReactNode }) {
  return (
    <section
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "1.5rem",
      }}
    >
      <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem", letterSpacing: "-0.01em" }}>
        {accent && (
          <span aria-hidden="true" style={{ color: "var(--accent)", marginRight: "0.5rem" }}>
            {accent}
          </span>
        )}
        {title}
      </h3>
      {children}
    </section>
  );
}

function categoryOf(type: SkyEvent["type"]): Category | null {
  switch (type) {
    case "retrograde_station":
    case "direct_station":
      return "retrograde";
    case "new_moon":
    case "first_quarter":
    case "full_moon":
    case "last_quarter":
      return "lunation";
    case "sign_ingress":
      return "ingress";
    case "solar_eclipse":
    case "lunar_eclipse":
      return "eclipse";
    default:
      return null;
  }
}

function eventMeta(ev: SkyEvent): { glyph: string; kind: string; title: string; subtitle: string | null } {
  const body = ev.body ? capitalize(ev.body.replace(/_/g, " ")) : "";
  switch (ev.type) {
    case "retrograde_station":
      return { glyph: "℞", kind: "Retrograde", title: `${body} stations retrograde`, subtitle: ev.sign ? `In ${ev.sign}` : null };
    case "direct_station":
      return { glyph: "→", kind: "Direct",     title: `${body} stations direct`,     subtitle: ev.sign ? `In ${ev.sign}` : null };
    case "new_moon":
      return { glyph: "●", kind: "Lunation", title: "New Moon", subtitle: ev.sign ? `In ${ev.sign}` : null };
    case "first_quarter":
      return { glyph: "◐", kind: "Lunation", title: "First Quarter Moon", subtitle: ev.sign ? `In ${ev.sign}` : null };
    case "full_moon":
      return { glyph: "○", kind: "Lunation", title: "Full Moon", subtitle: ev.sign ? `In ${ev.sign}` : null };
    case "last_quarter":
      return { glyph: "◑", kind: "Lunation", title: "Last Quarter Moon", subtitle: ev.sign ? `In ${ev.sign}` : null };
    case "sign_ingress":
      return {
        glyph: "⇨",
        kind: "Ingress",
        title: `${body} enters ${ev.sign}`,
        subtitle: ev.fromSign ? `Leaves ${ev.fromSign}` : null,
      };
    case "solar_eclipse":
      return {
        glyph: "☉",
        kind: "Eclipse",
        title: "Solar Eclipse",
        subtitle: `New Moon${ev.sign ? ` in ${ev.sign}` : ""} · ${ev.eclipseNodeDistance?.toFixed(1)}° from node`,
      };
    case "lunar_eclipse":
      return {
        glyph: "☾",
        kind: "Eclipse",
        title: "Lunar Eclipse",
        subtitle: `Full Moon${ev.sign ? ` in ${ev.sign}` : ""} · ${ev.eclipseNodeDistance?.toFixed(1)}° from node`,
      };
    default:
      return { glyph: "•", kind: "Event", title: ev.type, subtitle: null };
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-");
  const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** A tiny accent glyph per month — cycles subtly through zodiac symbols. */
function monthAccentGlyph(yyyyMm: string): string {
  const m = parseInt(yyyyMm.split("-")[1] ?? "1", 10);
  const glyphs = ["♑", "♒", "♓", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐"];
  return glyphs[(m - 1 + 12) % 12];
}

function formatDayTime(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} · ${time}`;
}
