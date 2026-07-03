// GET /api/v1/transit/theme?transitPlanet=&aspect=&natalPoint=&natalSign=
//
// Returns a prose theme for a specific transit key, if the theme table has been
// populated. Consumers should check `populated` before relying on `prose`.

import { NextResponse } from "next/server";
import { lookupTransitTheme, themesStatus } from "@/lib/calculators/transit-themes";
import { aspectTypeSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const transitPlanet = url.searchParams.get("transitPlanet");
  const aspect = url.searchParams.get("aspect");
  const natalPoint = url.searchParams.get("natalPoint");
  const natalSign = url.searchParams.get("natalSign");

  // If no query params, return status metadata about the theme table.
  if (!transitPlanet && !aspect && !natalPoint && !natalSign) {
    return NextResponse.json({ status: themesStatus() });
  }

  const missing = [];
  if (!transitPlanet) missing.push("transitPlanet");
  if (!aspect) missing.push("aspect");
  if (!natalPoint) missing.push("natalPoint");
  if (!natalSign) missing.push("natalSign");
  if (missing.length) {
    return NextResponse.json(
      { error: { code: "MISSING_PARAMS", message: `Missing required query params: ${missing.join(", ")}` } },
      { status: 400 }
    );
  }

  const aspectParsed = aspectTypeSchema.safeParse(aspect);
  if (!aspectParsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_ASPECT", message: `Invalid aspect: ${aspect}` } },
      { status: 400 }
    );
  }

  const result = lookupTransitTheme({
    transitPlanet: transitPlanet!,
    aspect: aspectParsed.data,
    natalPoint: natalPoint!,
    natalSign: natalSign!,
  });
  return NextResponse.json(result);
}
