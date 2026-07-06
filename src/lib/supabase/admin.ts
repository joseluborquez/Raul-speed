import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la service-role key: salta RLS por completo.
 * Server-only — nunca importar desde un componente cliente ni exponer
 * la clave con el prefijo NEXT_PUBLIC_. Se usa solo en rutas de
 * webhook/confirmación de pago y en la API de administración de pedidos.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
