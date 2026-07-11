// Caché de resultados de Yumbo por partNumber, en Supabase (compartida
// entre todas las instancias, a diferencia del rate limit en memoria).
// Evita repetir en la API la misma búsqueda que ya se hizo hace poco —
// el mayor volumen de tráfico real es gente re-buscando el mismo N/P.
//
// Fail-open: si Supabase falla, se trata como "sin caché" (getCache) o
// simplemente no se guarda (setCache); nunca debe romper una cotización.

import { createAdminClient } from "./supabase/admin";
import type { YumboResultado } from "./yumbo";

const TTL_ENCONTRADO_MS = 24 * 60 * 60 * 1000;
const TTL_NO_ENCONTRADO_MS = 6 * 60 * 60 * 1000;

export interface CacheHit {
  resultado: YumboResultado | null;
}

export async function getCache(partNumber: string): Promise<CacheHit | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("yumbo_price_cache")
    .select("encontrado, resultado, updated_at")
    .eq("part_number", partNumber)
    .maybeSingle();

  if (error || !data) return null;

  const ttl = data.encontrado ? TTL_ENCONTRADO_MS : TTL_NO_ENCONTRADO_MS;
  const edadMs = Date.now() - new Date(data.updated_at).getTime();
  if (edadMs > ttl) return null;

  return { resultado: data.encontrado ? (data.resultado as YumboResultado) : null };
}

export async function setCache(partNumber: string, resultado: YumboResultado | null): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("yumbo_price_cache").upsert({
    part_number: partNumber,
    encontrado: resultado !== null,
    resultado,
    updated_at: new Date().toISOString(),
  });
}
