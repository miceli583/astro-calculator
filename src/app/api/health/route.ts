import { NextResponse } from "next/server";
import { env } from "@/env.js";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "astro-calculator",
    version: env.npm_package_version ?? "0.1.0",
    timestamp: new Date().toISOString(),
  });
}
