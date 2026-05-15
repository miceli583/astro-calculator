import { calculateDestinyCard } from "@/lib/calculators/destiny-card";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { dateOnlySchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, dateOnlySchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(calculateDestinyCard(parsed.data));
  } catch (err) {
    return handleCalculatorError(err);
  }
}
