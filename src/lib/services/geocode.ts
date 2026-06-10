// Place-name → (lat, lon, timezone) lookup.
//
// Uses OpenStreetMap's free Nominatim service. Nominatim's terms of use
// require a descriptive User-Agent and rate ≤ 1 req/sec. We comply by:
//   • setting a descriptive UA identifying this project
//   • this endpoint is user-driven (one click → one request), so well
//     below the rate cap
//
// Timezone is derived from the returned lat/lon via the `tz-lookup` package
// (pure JS shape-lookup, no API calls).

import tzlookup from "tz-lookup";

export interface GeocodeResult {
  /** Full human-readable name from Nominatim ("New Orleans, Louisiana, USA"). */
  display_name: string;
  latitude: number;
  longitude: number;
  /** IANA timezone for the point (e.g. "America/Chicago"). */
  timezone: string;
  /** Two-letter country code where available (lower-case). */
  country_code?: string;
}

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
  address?: { country_code?: string };
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  "AstroCalculator/0.1 (public AGPL chart API; contact via repo issues)";

export async function geocodePlace(query: string, limit = 5): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: String(limit),
  });
  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Geocoder returned HTTP ${res.status}`);
  }
  const items = (await res.json()) as NominatimItem[];
  return items.map((item) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    let timezone = "UTC";
    try {
      timezone = tzlookup(lat, lon);
    } catch {
      // tz-lookup throws on invalid coords; default to UTC.
    }
    return {
      display_name: item.display_name,
      latitude: lat,
      longitude: lon,
      timezone,
      country_code: item.address?.country_code,
    };
  });
}
