// Convert a wall-clock datetime in an IANA timezone to UTC, then to Julian Day.
// Uses the built-in Intl API to resolve historical timezone offsets including
// DST transitions; no external timezone library is required.

export interface ParsedDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/;

export function parseLocalISO(iso: string): ParsedDateTime {
  const m = ISO_RE.exec(iso.trim());
  if (!m) throw new Error(`Invalid datetime "${iso}". Expected "YYYY-MM-DDTHH:mm[:ss]".`);
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
    second: m[6] ? Number(m[6]) : 0,
  };
}

// Returns offset (minutes east-of-UTC) that the named timezone applied at the
// given wall-clock instant. E.g. America/New_York on 1980-07-15T14:30:00 → -240.
export function timezoneOffsetMinutes(local: ParsedDateTime, timeZone: string): number {
  const asUtcMs = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second
  );

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(new Date(asUtcMs));
  const lookup: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") lookup[p.type] = Number(p.value);
  }
  const tzMs = Date.UTC(
    lookup.year,
    lookup.month - 1,
    lookup.day,
    lookup.hour === 24 ? 0 : lookup.hour,
    lookup.minute,
    lookup.second
  );
  return (tzMs - asUtcMs) / 60000;
}

// Convert local wall-clock + IANA timezone → UTC parsed datetime.
export function toUTC(local: ParsedDateTime, timeZone: string): ParsedDateTime {
  const offsetMin = timezoneOffsetMinutes(local, timeZone);
  const localMs = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second
  );
  const utcMs = localMs - offsetMin * 60_000;
  const d = new Date(utcMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds() + d.getUTCMilliseconds() / 1000,
  };
}
