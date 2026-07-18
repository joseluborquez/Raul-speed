// Caché de resultados del proveedor de precios activo, por partNumber, en
// Supabase (compartida entre todas las instancias, a diferencia del rate
// limit en memoria). Evita repetir en la API la misma búsqueda que ya se
// hizo hace poco — el mayor volumen de tráfico real es gente re-buscando
// el mismo N/P.
//
// Genérica por `provider` (ej. "impex", "yumbo") en vez de específica de
// un solo proveedor: ya cambiamos de proveedor más de una vez y el
// próximo cambio no debería requerir tablas nuevas.
//
// Fail-open: si Supabase falla, se trata como "sin caché" (getCache) o
// simplemente no se guarda (setCache); nunca debe romper una cotización.

import { createAdminClient } from "./supabase/admin";

export interface ResultadoPrecioProveedor {
  precioJpy: number;
  fuente: string;
  maker: string;
  nombre: string;
  /**
   * Nombre nativo del proveedor (japonés/katakana), cuando viene distinto
   * del inglés en `nombre` — ver buscarYumbo() en yumbo.ts. null si no hay
   * una segunda variante genuina que evaluar. Se usa en clasificarEnvio()
   * (Filtros del cotizador v10): un código puede venir SOLO en katakana
   * sin versión en inglés, y evaluar ambos nombres evita perder esa señal.
   */
  nombreNativo: string | null;
  esGenuino: boolean;
  /** Peso en kg reportado por el proveedor. 0 = sin dato (posible pieza voluminosa). */
  pesoKg: number;
}

const TTL_ENCONTRADO_MS = 24 * 60 * 60 * 1000;
const TTL_NO_ENCONTRADO_MS = 6 * 60 * 60 * 1000;

export interface CacheHit {
  resultado: ResultadoPrecioProveedor | null;
}

export async function getCache(provider: string, partNumber: string): Promise<CacheHit | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("price_cache")
    .select("encontrado, resultado, updated_at")
    .eq("provider", provider)
    .eq("part_number", partNumber)
    .maybeSingle();

  if (error || !data) return null;

  const ttl = data.encontrado ? TTL_ENCONTRADO_MS : TTL_NO_ENCONTRADO_MS;
  const edadMs = Date.now() - new Date(data.updated_at).getTime();
  if (edadMs > ttl) return null;

  return { resultado: data.encontrado ? (data.resultado as ResultadoPrecioProveedor) : null };
}

export async function setCache(
  provider: string,
  partNumber: string,
  resultado: ResultadoPrecioProveedor | null,
): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("price_cache").upsert({
    provider,
    part_number: partNumber,
    encontrado: resultado !== null,
    resultado,
    updated_at: new Date().toISOString(),
  });
}
