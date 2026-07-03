"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { SkyEvent } from "@/lib/calculators/sky-events";

interface SkyEventsResponse {
  scannedDateRange: { start: string; end: string; days: number };
  events: SkyEvent[];
}

const YEAR_OPTIONS = [1, 3, 5, 10, 20] as const;

type Category = "retrograde" | "lunation" | "ingress" | "eclipse";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SkyEventsResponse | null>(null);

  // Auto-load 1 year of everything on mount.
  useEffect(() => {
    void load(1, new Set(ALL_CATEGORIES));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(y: number, cats: Set<Category>) {
    setLoading(true);
    setError(null);
    try {
      const start = new Date();
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + y);
      const result = await fetchSky({
        start_date: fmtISODate(start),
        end_date: fmtISODate(end),
        categories: [...cats],
      });
      setData(result);
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const filteredEvents = data?.events.filter((e) => categoryOf(e.type) && enabled.has(categoryOf(e.type)!)) ?? [];

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.25rem", minHeight: "100vh" }}>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ color: "var(--muted)", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Sky Weather
        </div>
        <h1 style={{ margin: "0.3rem 0 0.5rem", fontSize: "2.2rem", letterSpacing: "-0.02em" }}>What's coming up</h1>
        <p style={{ color: "var(--muted)", margin: 0, maxWidth: 640 }}>
          Retrograde stations, moon phases, sign ingresses, and eclipses — the collective sky, no birth chart needed.
        </p>
      </div>

      <section
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "1.25rem",
          marginBottom: "2rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "1.25rem",
          alignItems: "center",
        }}
      >
        <label style={{ color: "var(--muted)", fontSize: 14 }}>
          Horizon:{" "}
          <select
            value={years}
            onChange={(e) => {
              const y = parseInt(e.target.value, 10);
              setYears(y);
              void load(y, enabled);
            }}
            style={{
              marginLeft: "0.5rem",
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "0.4rem 0.6rem",
              fontSize: 14,
            }}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y} year{y === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {ALL_CATEGORIES.map((cat) => {
            const on = enabled.has(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  const next = new Set(enabled);
                  if (on) next.delete(cat);
                  else next.add(cat);
                  setEnabled(next);
                }}
                style={{
                  background: on ? "var(--accent)" : "transparent",
                  color: on ? "var(--bg)" : "var(--muted)",
                  border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                  padding: "0.4rem 0.85rem",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: on ? 500 : 400,
                  cursor: "pointer",
                  textTransform: "capitalize",
                  transition: "all 0.15s",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {data && !loading && (
          <div style={{ color: "var(--muted)", fontSize: 13, marginLeft: "auto" }}>
            {filteredEvents.length} event{filteredEvents.length === 1 ? "" : "s"} · {data.scannedDateRange.start} → {data.scannedDateRange.end}
          </div>
        )}
      </section>

      {loading && (
        <div style={{ padding: "3rem 0", textAlign: "center", color: "var(--muted)" }}>
          Computing sky events…
        </div>
      )}

      {error && (
        <div style={{ padding: "1rem", background: "var(--card)", borderRadius: 6, color: "#ff8b8b", fontSize: 14 }}>
          {error}
        </div>
      )}

      {!loading && data && <EventsFeed events={filteredEvents} />}
    </main>
  );
}

function EventsFeed({ events }: { events: SkyEvent[] }) {
  if (events.length === 0) {
    return (
      <div style={{ padding: "3rem 0", textAlign: "center", color: "var(--muted)" }}>
        No events in the selected filters.
      </div>
    );
  }
  // Group by year-month for a clean chronological feed.
  const byMonth = new Map<string, SkyEvent[]>();
  for (const ev of events) {
    const key = ev.datetime.slice(0, 7); // YYYY-MM
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(ev);
  }
  return (
    <div>
      {[...byMonth.entries()].map(([key, evs]) => (
        <section key={key} style={{ marginBottom: "2rem" }}>
          <h3
            style={{
              margin: "0 0 0.75rem",
              fontSize: 14,
              letterSpacing: "0.1em",
              color: "var(--muted)",
              fontWeight: 500,
              textTransform: "uppercase",
            }}
          >
            {formatMonth(key)}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {evs.map((ev, i) => (
              <EventRow key={`${ev.datetime}-${ev.type}-${ev.body ?? "n"}-${i}`} ev={ev} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EventRow({ ev }: { ev: SkyEvent }) {
  const meta = eventMeta(ev);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: "0.75rem 1rem",
        alignItems: "center",
        padding: "0.85rem 1rem",
        borderRadius: 8,
        background: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: 22,
          color: meta.color,
          width: 32,
          height: 32,
          display: "grid",
          placeItems: "center",
          borderRadius: 6,
          background: "var(--bg)",
        }}
      >
        {meta.icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{meta.title}</div>
        {meta.subtitle && (
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{meta.subtitle}</div>
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
        {formatDateTime(ev.datetime)}
      </div>
    </div>
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

function eventMeta(ev: SkyEvent): { icon: ReactNode; color: string; title: string; subtitle: string | null } {
  const body = ev.body ? capitalize(ev.body.replace(/_/g, " ")) : "";
  switch (ev.type) {
    case "retrograde_station":
      return {
        icon: "℞",
        color: "#ff9ac1",
        title: `${body} stations retrograde`,
        subtitle: ev.sign ? `In ${ev.sign}` : null,
      };
    case "direct_station":
      return {
        icon: "→",
        color: "#a1e8b0",
        title: `${body} stations direct`,
        subtitle: ev.sign ? `In ${ev.sign}` : null,
      };
    case "new_moon":
      return { icon: "●", color: "#7f7f8f", title: "New Moon", subtitle: ev.sign ? `In ${ev.sign}` : null };
    case "first_quarter":
      return { icon: "◐", color: "#c5b4ff", title: "First Quarter Moon", subtitle: ev.sign ? `In ${ev.sign}` : null };
    case "full_moon":
      return { icon: "○", color: "#f5f0d9", title: "Full Moon", subtitle: ev.sign ? `In ${ev.sign}` : null };
    case "last_quarter":
      return { icon: "◑", color: "#c5b4ff", title: "Last Quarter Moon", subtitle: ev.sign ? `In ${ev.sign}` : null };
    case "sign_ingress":
      return {
        icon: "⇨",
        color: "#c5b4ff",
        title: `${body} enters ${ev.sign}`,
        subtitle: ev.fromSign ? `Leaves ${ev.fromSign}` : null,
      };
    case "solar_eclipse":
      return {
        icon: "☀",
        color: "#ffb37a",
        title: "Solar Eclipse",
        subtitle: `New Moon${ev.sign ? ` in ${ev.sign}` : ""} · ${ev.eclipseNodeDistance?.toFixed(1)}° from node`,
      };
    case "lunar_eclipse":
      return {
        icon: "☾",
        color: "#ffb37a",
        title: "Lunar Eclipse",
        subtitle: `Full Moon${ev.sign ? ` in ${ev.sign}` : ""} · ${ev.eclipseNodeDistance?.toFixed(1)}° from node`,
      };
    default:
      return { icon: "•", color: "var(--muted)", title: ev.type, subtitle: null };
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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " UTC";
}
