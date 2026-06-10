import { geocodePlace } from "@/lib/services/geocode";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { geocodeInputSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, geocodeInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const results = await geocodePlace(parsed.data.query, parsed.data.limit);
    return ok({ results });
  } catch (err) {
    return handleCalculatorError(err);
  }
}
