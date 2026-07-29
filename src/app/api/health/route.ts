import { NextResponse } from "next/server";
import { version } from "../../../../package.json";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "astro-calculator",
    version,
    timestamp: new Date().toISOString(),
  });
}
