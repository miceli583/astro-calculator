import { calculateHumanDesign } from "@/lib/calculators/human-design";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { humanDesignInputSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, humanDesignInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(calculateHumanDesign(parsed.data));
  } catch (err) {
    return handleCalculatorError(err);
  }
}
