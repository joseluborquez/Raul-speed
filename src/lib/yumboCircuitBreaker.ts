// Circuit breaker para la API de Yumbo, persistido en Supabase (una sola
// fila compartida entre todas las instancias — a diferencia del rate
// limit en memoria de rateLimit.ts, que es por instancia).
//
// La idea es simple: si Yumbo responde 429 (o falla varias veces
// seguidas), dejamos de golpearlo por un rato en vez de seguir
// insistiendo en cada búsqueda nueva — que es justo lo que ya pasó con
// Impex y luego con Yumbo (ver commit 7212e05 y comentarios en
// rateLimit.ts). Mientras está pausado, cotizar() devuelve
// "error_proveedor" sin hacer ningún request de red.

import { createAdminClient } from "./supabase/admin";

const COOLDOWN_429_MS = 10 * 60 * 1000;
const COOLDOWN_ERRORES_MS = 3 * 60 * 1000;
const UMBRAL_ERRORES_CONSECUTIVOS = 3;

export interface EstadoCircuito {
  pausado: boolean;
  pausadoHasta: Date | null;
}

export async function isPaused(): Promise<EstadoCircuito> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("yumbo_circuit_breaker")
    .select("paused_until")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data || !data.paused_until) {
    return { pausado: false, pausadoHasta: null };
  }

  const hasta = new Date(data.paused_until);
  return { pausado: hasta.getTime() > Date.now(), pausadoHasta: hasta };
}

/**
 * Registra un fallo al llamar a Yumbo. Un 429 pausa de inmediato; otros
 * errores (timeout, 5xx) solo pausan tras varios seguidos, para no
 * activar el circuito por un problema puntual de red.
 */
export async function recordFailure(status: number | null, message: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("yumbo_circuit_breaker")
    .select("consecutive_fails, paused_until")
    .eq("id", 1)
    .maybeSingle();

  const fails = (data?.consecutive_fails ?? 0) + 1;
  const pausaExistenteMs = data?.paused_until ? new Date(data.paused_until).getTime() : 0;

  let pausaNuevaMs = 0;
  if (status === 429) {
    pausaNuevaMs = Date.now() + COOLDOWN_429_MS;
  } else if (fails >= UMBRAL_ERRORES_CONSECUTIVOS) {
    pausaNuevaMs = Date.now() + COOLDOWN_ERRORES_MS;
  }

  const pausedUntilMs = Math.max(pausaExistenteMs, pausaNuevaMs);

  await supabase
    .from("yumbo_circuit_breaker")
    .update({
      consecutive_fails: fails,
      last_status: status,
      last_message: message.slice(0, 500),
      paused_until: pausedUntilMs > Date.now() ? new Date(pausedUntilMs).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
}

export async function recordSuccess(): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("yumbo_circuit_breaker")
    .update({
      consecutive_fails: 0,
      paused_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
}
