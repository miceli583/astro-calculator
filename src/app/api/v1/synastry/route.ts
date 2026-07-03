import { calculateSynastry } from "@/lib/calculators/synastry";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { synastryInputSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, synastryInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(calculateSynastry(parsed.data));
  } catch (err) {
    return handleCalculatorError(err);
  }
}
