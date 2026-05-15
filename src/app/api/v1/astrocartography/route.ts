import { calculateAstrocartography } from "@/lib/calculators/astrocartography";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { astrocartoInputSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, astrocartoInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(calculateAstrocartography(parsed.data));
  } catch (err) {
    return handleCalculatorError(err);
  }
}
