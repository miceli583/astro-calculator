"use client";

// Shared birth-form primitives — used by /chart (single form) and /synastry
// (two side-by-side forms). Handles the geocode autocomplete internally.

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface BirthForm {
  name: string;
  date: string;
  time: string;
  timezone: string;
  latitude: string;
  longitude: string;
}

export const COMMON_TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Athens",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata", "Asia/Dubai",
  "Australia/Sydney", "Pacific/Auckland", "UTC",
];

interface GeocodeResult {
  display_name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label style={{ display: "block", gridColumn: full ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</div>
      <FieldInputWrap>{children}</FieldInputWrap>
    </label>
  );
}

export function FieldInputWrap({ children }: { children: ReactNode }) {
  return (
    <div className="field-wrap">
      {children}
    </div>
  );
}

/**
 * All the fields of a single birth form, with geocode autocomplete on the
 * city input. Purely a controlled component — parent owns the state.
 */
export function BirthFormFields({
  value,
  onChange,
  idPrefix,
  showNameField = true,
}: {
  value: BirthForm;
  onChange: (next: BirthForm) => void;
  /** Unique per instance to avoid duplicate DOM ids when rendering multiple forms. */
  idPrefix: string;
  showNameField?: boolean;
}) {
  const [placeQuery, setPlaceQuery] = useState<string>("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoOptions, setGeoOptions] = useState<GeocodeResult[]>([]);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoOpen, setGeoOpen] = useState(false);
  const lastQueryRef = useRef<string>("");
  const cityFieldRef = useRef<HTMLDivElement>(null);

  const update = <K extends keyof BirthForm>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...value, [k]: e.target.value });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!cityFieldRef.current) return;
      if (!cityFieldRef.current.contains(e.target as Node)) setGeoOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      void runGeocode(q);
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
    onChange({
      ...value,
      latitude: g.latitude.toFixed(4),
      longitude: g.longitude.toFixed(4),
      timezone: g.timezone,
    });
    setPlaceQuery(g.display_name);
    lastQueryRef.current = g.display_name;
    setGeoOptions([]);
    setGeoOpen(false);
    setGeoError(null);
  }

  const listboxId = `${idPrefix}-geo-listbox`;

  return (
    <div className="stack-on-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem 1.25rem" }}>
      {showNameField && (
        <Field label="Name (optional)" full>
          <input type="text" value={value.name} onChange={update("name")} placeholder="e.g. Matthew Miceli" />
        </Field>
      )}
      <Field label="Birth date">
        <input type="date" value={value.date} onChange={update("date")} required />
      </Field>
      <Field label="Birth time (24h)">
        <input type="time" value={value.time} onChange={update("time")} required />
      </Field>
      <Field label="Birthplace (city) — auto-fills lat/lon + timezone as you type" full>
        <div ref={cityFieldRef} style={{ position: "relative" }}>
          <input
            type="text"
            value={placeQuery}
            onChange={(e) => setPlaceQuery(e.target.value)}
            onFocus={() => { if (geoOptions.length > 0) setGeoOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (geoOpen && geoOptions.length > 0) applyGeocoded(geoOptions[0]);
              } else if (e.key === "Escape") {
                setGeoOpen(false);
              }
            }}
            placeholder='Start typing — e.g. "New Orleans" or "Berlin"'
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={geoOpen && geoOptions.length > 0}
          />
          {geoLoading && (
            <div aria-hidden="true" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--muted)" }}>
              searching…
            </div>
          )}
          {geoOpen && geoOptions.length > 0 && (
            <div
              id={listboxId}
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
        <select value={value.timezone} onChange={update("timezone")} required>
          {COMMON_TIMEZONES.includes(value.timezone) ? null : (
            <option value={value.timezone}>{value.timezone} (from city)</option>
          )}
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </Field>
      <Field label="Latitude (°N positive)">
        <input type="number" step="0.0001" min={-90} max={90} value={value.latitude} onChange={update("latitude")} required />
      </Field>
      <Field label="Longitude (°E positive)">
        <input type="number" step="0.0001" min={-180} max={180} value={value.longitude} onChange={update("longitude")} required />
      </Field>
    </div>
  );
}
