// Cuota diaria del proveedor de precios, persistida en Supabase (ver
// 0017_cuota_diaria_proveedor.sql). Complementa a los otros dos
// resguardos, que no cubren este caso:
//
// - rateLimit.ts limita por minuto pero vive en memoria de cada instancia,
//   así que varias instancias en paralelo pueden quemar la cuota diaria
//   entre todas sin que ninguna lo note.
// - priceCircuitBreaker.ts reacciona DESPUÉS de que el proveedor falla; la
//   cuota hay que respetarla antes de gastar la llamada.

import { createAdminClient } from "./supabase/admin";

/**
 * Tope diario de llamadas a la API de Impex.
 *
 * El plan de la cuenta son 500/día; se opera con 450 para dejar colchón:
 * pruebas del admin, reintentos manuales y el desfase entre nuestro corte
 * del día y el suyo. Pasado el tope el cotizador no se cae — degrada al
 * respaldo de repuestos_catalogo (ver cotizar.ts).
 */
export const LIMITE_DIARIO_IMPEX = 450;

/**
 * Zona horaria en la que el proveedor corta el día. Impex es japonés, así
 * que se asume medianoche JST. Si resultara ser otra, acá se corrige: un
 * corte adelantado respecto del real solo desperdicia cuota (empezamos a
 * contar de nuevo más tarde que ellos), nunca la excede.
 */
const ZONA_HORARIA_RESET = "Asia/Tokyo";

/** Día actual en JST, formato YYYY-MM-DD (el locale en-CA da ISO). */
function diaJst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: ZONA_HORARIA_RESET });
}

/**
 * Cuenta una llamada al proveedor y dice si cabía en la cuota del día.
 * Se llama UNA VEZ POR REQUEST HTTP REAL, no por cotización: normalizar()
 * puede probar hasta 3 variantes del mismo N/P y cada una es una consulta
 * que el proveedor cobra.
 *
 * Fail-closed, al revés que priceCache.ts: si Supabase no responde,
 * devuelve false y el cotizador cae al respaldo. Un contador de cuota que
 * falla abierto es exactamente la forma en que se agota una cuota sin que
 * nadie se entere — que es lo que este módulo viene a evitar.
 */
export async function consumirCuota(provider: string, limite: number): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("consumir_cuota_proveedor", {
    p_provider: provider,
    p_dia: diaJst(),
    p_limite: limite,
  });

  if (error) return false;
  return data === true;
}

export interface ConsumoCuota {
  usadas: number;
  limite: number;
  restantes: number;
  dia: string;
}

/**
 * Consumo del día para mostrarlo en /admin. Solo lee — no incrementa.
 */
export async function consumoDelDia(provider: string, limite: number): Promise<ConsumoCuota> {
  const dia = diaJst();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("price_provider_quota")
    .select("llamadas")
    .eq("provider", provider)
    .eq("dia", dia)
    .maybeSingle();

  const usadas = Number(data?.llamadas ?? 0);
  return { usadas, limite, restantes: Math.max(0, limite - usadas), dia };
}
