import { calculateComposite } from "@/lib/calculators/composite";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { compositeInputSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, compositeInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(calculateComposite(parsed.data));
  } catch (err) {
    return handleCalculatorError(err);
  }
}
