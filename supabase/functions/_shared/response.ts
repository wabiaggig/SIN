import { buildCorsHeaders } from "./cors.ts";
import { HttpError } from "./auth.ts";

export function jsonResponse(body: unknown, status: number, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(origin), "Content-Type": "application/json" },
  });
}

export function errorResponse(err: unknown, origin: string | null = null): Response {
  if (err instanceof HttpError) {
    return jsonResponse({ error: { code: err.code, message: err.message } }, err.status, origin);
  }
  console.error(err);
  return jsonResponse(
    { error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Error inesperado." } },
    500,
    origin,
  );
}
