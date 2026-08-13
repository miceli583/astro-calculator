import { NextResponse } from "next/server";
import { API_VERSION } from "@/lib/version";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "astro-calculator",
    version: API_VERSION,
    timestamp: new Date().toISOString(),
  });
}
