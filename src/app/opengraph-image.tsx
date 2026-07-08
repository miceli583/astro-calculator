import { ImageResponse } from "next/og";

export const alt = "Astro Calculator — Open API";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0c",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="88" height="88" viewBox="0 0 64 64">
            <ellipse
              cx="32"
              cy="32"
              rx="22"
              ry="9"
              fill="none"
              stroke="#c5b4ff"
              strokeWidth="2.5"
              opacity="0.45"
              transform="rotate(-24 32 32)"
            />
            <path
              d="M32 12 L35.6 28.4 L52 32 L35.6 35.6 L32 52 L28.4 35.6 L12 32 L28.4 28.4 Z"
              fill="#c5b4ff"
            />
            <circle cx="49.5" cy="21.5" r="3.5" fill="#e9e8f0" />
          </svg>
          <div style={{ fontSize: 76, fontWeight: 700, color: "#e9e8f0" }}>
            Astro Calculator
          </div>
        </div>
        <div style={{ fontSize: 30, color: "#8b8a99", marginTop: 24 }}>
          Open-source API for astrology, Human Design, Gene Keys & more
        </div>
        <div style={{ fontSize: 24, color: "#c5b4ff", marginTop: 12 }}>
          AGPL-3.0 · Swiss Ephemeris
        </div>
      </div>
    ),
    size
  );
}
