// Shared response helpers for API routes.

import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function fail(code: string, message: string, status = 400, details?: unknown): NextResponse {
  const body: { error: ApiError } = { error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return NextResponse.json(body, { status });
}

export async function parseJson<T>(req: Request, schema: ZodSchema<T>): Promise<
  { ok: true; data: T } | { ok: false; response: NextResponse }
> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, response: fail("invalid_json", "Request body must be valid JSON") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const err = parsed.error as ZodError;
    return {
      ok: false,
      response: fail("invalid_input", "Request body failed validation", 422, err.flatten()),
    };
  }
  return { ok: true, data: parsed.data };
}

export function handleCalculatorError(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("Ephemeris data path not found")) {
    return fail("ephemeris_missing", message, 500);
  }
  if (message.includes("Invalid datetime") || message.includes("Invalid date")) {
    return fail("invalid_input", message, 422);
  }
  return fail("calculation_error", message, 500);
}
