import { corsHeaders } from "./cors.ts";
import { HttpError } from "./auth.ts";

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return jsonResponse({ error: { code: err.code, message: err.message } }, err.status);
  }
  console.error(err);
  return jsonResponse(
    { error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Error inesperado." } },
    500,
  );
}
