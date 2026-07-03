import { calculateTransitToNatal } from "@/lib/calculators/transit";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { transitToNatalInputSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, transitToNatalInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(calculateTransitToNatal(parsed.data));
  } catch (err) {
    return handleCalculatorError(err);
  }
}
