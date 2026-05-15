import { calculateTransits } from "@/lib/calculators/astrology";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { transitInputSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, transitInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(calculateTransits(parsed.data));
  } catch (err) {
    return handleCalculatorError(err);
  }
}
