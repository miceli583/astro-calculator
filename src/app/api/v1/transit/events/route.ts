import { calculateTransitEvents } from "@/lib/calculators/transit-events";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { transitEventsInputSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, transitEventsInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(calculateTransitEvents(parsed.data));
  } catch (err) {
    return handleCalculatorError(err);
  }
}
