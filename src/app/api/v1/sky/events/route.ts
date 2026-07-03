import { calculateSkyEvents } from "@/lib/calculators/sky-events";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { skyEventsInputSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, skyEventsInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(calculateSkyEvents(parsed.data));
  } catch (err) {
    return handleCalculatorError(err);
  }
}
