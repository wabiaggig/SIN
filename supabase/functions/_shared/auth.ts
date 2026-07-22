import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/**
 * Autentica al llamador por su JWT y devuelve un cliente admin (service
 * role, evade RLS) para el resto de la función. Nunca confiar en un
 * playerId/userId que venga en el body — siempre usar `user.id` de acá.
 */
export async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new HttpError(401, "UNAUTHENTICATED", "Falta el header Authorization.");
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    throw new HttpError(401, "UNAUTHENTICATED", "Token inválido o expirado.");
  }

  // deno-lint-ignore no-explicit-any
  const adminClient: any = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  return { user: data.user, adminClient };
}
