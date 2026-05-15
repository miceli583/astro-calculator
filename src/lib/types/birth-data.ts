// Shared input shapes used by every calculator.

export interface BirthData {
  /** ISO 8601 local datetime, e.g. "1980-07-15T14:30:00". */
  datetime: string;
  /** IANA timezone, e.g. "America/New_York". */
  timezone: string;
  /** Latitude in decimal degrees. North positive. */
  latitude: number;
  /** Longitude in decimal degrees. East positive. */
  longitude: number;
}

export interface BirthDataWithoutLocation {
  datetime: string;
  timezone: string;
}

export interface DateOnly {
  date: string; // "YYYY-MM-DD"
}
