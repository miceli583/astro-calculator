import { calculateProgressions } from "@/lib/calculators/astrology";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { progressedInputSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, progressedInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(calculateProgressions(parsed.data));
  } catch (err) {
    return handleCalculatorError(err);
  }
}
