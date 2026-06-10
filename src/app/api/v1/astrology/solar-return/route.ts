import { calculateSolarReturn } from "@/lib/calculators/astrology";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { solarReturnInputSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, solarReturnInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(calculateSolarReturn(parsed.data));
  } catch (err) {
    return handleCalculatorError(err);
  }
}
