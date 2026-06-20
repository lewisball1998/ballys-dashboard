import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { ZodError, ZodTypeAny } from "zod";
import { ok, err } from "@/lib/types";

/**
 * Route-handler helpers. Every API route returns the shared `ApiResponse`
 * envelope; validation failures become a 400 `validation_error` with field-level
 * messages. Backend-owned; consumed by all route handlers.
 */

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(ok(data), { status });
}

export function jsonError(
  code: string,
  message: string,
  status = 400,
  fields?: Record<string, string[]>,
): NextResponse {
  return NextResponse.json(err(code, message, fields), { status });
}

export function validationError(error: ZodError): NextResponse {
  const flat = error.flatten();
  const fields: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flat.fieldErrors)) {
    if (value && value.length > 0) fields[key] = value;
  }
  return jsonError(
    "validation_error",
    "Validation failed",
    400,
    Object.keys(fields).length > 0 ? fields : undefined,
  );
}

export type ParseResult<T> = { success: true; data: T } | { success: false; response: NextResponse };

/** Validate an already-parsed value against a schema. */
export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): ParseResult<z.infer<S>> {
  const result = schema.safeParse(body);
  if (!result.success) return { success: false, response: validationError(result.error) };
  return { success: true, data: result.data };
}

/** Read + validate a JSON request body (400 on invalid JSON or schema). */
export async function parseJson<S extends ZodTypeAny>(
  req: NextRequest,
  schema: S,
): Promise<ParseResult<z.infer<S>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { success: false, response: jsonError("invalid_json", "Request body must be valid JSON", 400) };
  }
  return parseBody(schema, body);
}

/** Validate URL query params against a schema (use z.coerce for numbers). */
export function parseQuery<S extends ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: S,
): ParseResult<z.infer<S>> {
  const obj: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) obj[key] = value;
  return parseBody(schema, obj);
}

/** Wrap a handler so any uncaught error becomes a 500 envelope instead of a throw. */
export function route<C = unknown>(handler: (req: NextRequest, ctx: C) => Promise<NextResponse> | NextResponse) {
  return async (req: NextRequest, ctx: C): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      console.error("[api] unhandled error:", error);
      return jsonError("internal_error", "Internal server error", 500);
    }
  };
}
