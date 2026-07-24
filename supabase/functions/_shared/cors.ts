// Orígenes reales de la app: producción en Vercel, sus preview deployments
// (mismo proyecto, subdominio generado por commit) y desarrollo local vía
// `expo start --web`. Nativo (Expo Go / app instalada) no pasa por acá —
// CORS solo lo aplica el navegador, un fetch nativo no tiene "Origin".
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/mobile-seven-sable\.vercel\.app$/,
  /^https:\/\/mobile-[a-z0-9]+-wabiaggigs-projects\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
];

const DEFAULT_ORIGIN = "https://mobile-seven-sable.vercel.app";

function resolveOrigin(origin: string | null): string {
  if (origin && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) {
    return origin;
  }
  return DEFAULT_ORIGIN;
}

/**
 * Cabeceras CORS para una respuesta puntual, calculadas a partir del
 * Origin real del pedido — antes esto era un objeto estático con
 * Access-Control-Allow-Origin: "*". No es una defensa por sí sola (la
 * autorización real es el JWT en el header, no el origen), pero evita que
 * cualquier sitio pueda leer las respuestas desde el navegador de un
 * usuario.
 */
export function buildCorsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveOrigin(origin),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
