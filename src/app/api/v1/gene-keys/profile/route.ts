import { calculateGeneKeys } from "@/lib/calculators/gene-keys";
import { handleCalculatorError, ok, parseJson } from "@/lib/api/respond";
import { geneKeysInputSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, geneKeysInputSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(calculateGeneKeys(parsed.data));
  } catch (err) {
    return handleCalculatorError(err);
  }
}
