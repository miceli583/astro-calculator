import { calculateTransitSky } from "@/lib/calculators/transit";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { transitSkyInputSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, transitSkyInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(calculateTransitSky(parsed.data));
  } catch (err) {
    return handleCalculatorError(err);
  }
}
