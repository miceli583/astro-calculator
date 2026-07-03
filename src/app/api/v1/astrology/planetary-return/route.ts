import { calculatePlanetaryReturn } from "@/lib/calculators/astrology";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { planetaryReturnInputSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, planetaryReturnInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(calculatePlanetaryReturn(parsed.data));
  } catch (err) {
    return handleCalculatorError(err);
  }
}
