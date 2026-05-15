import { NextResponse } from "next/server";
import { buildOpenAPISpec } from "@/lib/openapi/spec";

export const runtime = "nodejs";

export function GET(req: Request) {
  const url = new URL(req.url);
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? `${url.protocol}//${url.host}`;
  return NextResponse.json(buildOpenAPISpec(baseUrl));
}
