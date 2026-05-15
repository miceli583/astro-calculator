import { calculateNatalChart } from "@/lib/calculators/astrology";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { natalInputSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, natalInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(calculateNatalChart(parsed.data));
  } catch (err) {
    return handleCalculatorError(err);
  }
}
