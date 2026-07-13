// Cotizador OEM — fuente: Impex Japan API.
//
// Segunda vuelta con este proveedor: ya se usó antes y se retiró porque la
// cuenta empezó a devolver {"error":"contact with manager"} para todo (ver
// commit 7212e05), lo que llevó a migrar a Yumbo. Yumbo después agotó su
// propia cuota, así que esta vez Impex queda protegido por la misma
// infraestructura de resiliencia que se construyó para Yumbo: caché
// (priceCache.ts), circuit breaker (priceCircuitBreaker.ts) y un límite
// propio de llamadas por minuto (rateLimit.ts), para no golpear la API con
// más frecuencia de la necesaria.
//
// Endpoint: GET https://www.impex-jp.com/api/parts/search.html
// Auth:     query param key=API_KEY
// Búsqueda: query param part_no=NUMERO_PARTE

import { IMPEX_API_KEY } from "./config";
import { getCache, setCache, type ResultadoPrecioProveedor } from "./priceCache";
import { isPaused, recordFailure, recordSuccess } from "./priceCircuitBreaker";
import { rateLimitExcedido } from "./rateLimit";

const PROVIDER = "impex";
const IMPEX_API_URL = "https://www.impex-jp.com/api/parts/search.html";

// Límite propio, best-effort en memoria (ver rateLimit.ts) — no hay un
// número documentado de Impex, así que se parte con algo conservador.
const LIMITE_LLAMADAS_POR_MINUTO = 20;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  accept: "application/json",
};

interface ImpexParte {
  mark?: string;
  name?: string;
  name_eng?: string;
  weight?: number;
  price_yen: number;
  is_discontinued: boolean;
}

/**
 * Devuelve variantes del N/P: con y sin guión.
 * "90915-YZZD4" → ["90915-YZZD4", "90915YZZD4"]
 * "90915YZZD4"  → ["90915YZZD4", "90915-YZZD4"]
 */
function normalizar(partNumber: string): string[] {
  const pn = partNumber.trim().toUpperCase();
  const variantes = [pn];
  if (pn.includes("-")) {
    variantes.push(pn.replaceAll("-", ""));
  } else {
    const m = pn.match(/^(\d{5})([A-Z0-9]+)$/);
    if (m) variantes.push(`${m[1]}-${m[2]}`);
  }
  return variantes;
}

/**
 * Busca precio OEM en Impex Japan vía API oficial.
 */
export async function buscarImpex(partNumber: string): Promise<ResultadoPrecioProveedor | null> {
  if (!IMPEX_API_KEY) return null;

  const clave = partNumber.trim().toUpperCase();

  const cacheado = await getCache(PROVIDER, clave);
  if (cacheado) return cacheado.resultado;

  const circuito = await isPaused(PROVIDER);
  if (circuito.pausado) {
    const minutos = circuito.pausadoHasta
      ? Math.ceil((circuito.pausadoHasta.getTime() - Date.now()) / 60_000)
      : null;
    throw new Error(
      `Proveedor de precios pausado temporalmente por exceso de consultas.` +
        (minutos ? ` Reintenta en ~${minutos} min.` : ""),
    );
  }

  // Si una variante (ej. sin el guión que puso el cliente) devuelve un
  // error de Impex, no hay que rendirse ahí: puede que la otra variante
  // (con el guión en la posición correcta) sí encuentre la pieza. Solo se
  // propaga un error si TODAS las variantes fallaron con error — si
  // alguna respondió limpio (encontrada o no), esa respuesta manda.
  let resultado: ResultadoPrecioProveedor | null = null;
  let huboRespuestaLimpia = false;
  let ultimoError: Error | null = null;

  for (const variante of normalizar(clave)) {
    try {
      resultado = await impexApiFetch(variante);
      huboRespuestaLimpia = true;
      if (resultado) break;
    } catch (exc) {
      ultimoError = exc instanceof Error ? exc : new Error(String(exc));
    }
  }

  if (!resultado && !huboRespuestaLimpia && ultimoError) {
    throw ultimoError;
  }

  await setCache(PROVIDER, clave, resultado);
  return resultado;
}

async function impexApiFetch(partNumber: string): Promise<ResultadoPrecioProveedor | null> {
  if (rateLimitExcedido("impex-global", LIMITE_LLAMADAS_POR_MINUTO, 60_000)) {
    throw new Error("Límite propio de consultas a Impex alcanzado. Reintenta en un minuto.");
  }

  const params = new URLSearchParams({
    key: IMPEX_API_KEY,
    part_no: partNumber,
    original_only: "0",
    price_factor: "1",
    price_increase: "0",
  });

  let resp: Response;
  try {
    resp = await fetch(`${IMPEX_API_URL}?${params.toString()}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (exc) {
    const mensaje = exc instanceof Error ? exc.message : String(exc);
    await recordFailure(PROVIDER, null, mensaje);
    throw exc;
  }

  if (!resp.ok) {
    await recordFailure(PROVIDER, resp.status, `Impex respondió con estado ${resp.status}`);
    throw new Error(`Impex respondió con estado ${resp.status}`);
  }

  const data = await resp.json();

  // Impex puede responder 200 con un {"error": "..."} en vez de resultados
  // (ej. clave suspendida, cuenta marcada para revisión) — eso no es lo
  // mismo que "no encontrado" y no debe tratarse como tal.
  if (data?.error) {
    await recordFailure(PROVIDER, resp.status, `Impex: ${data.error}`);
    throw new Error(`Impex: ${data.error}`);
  }

  await recordSuccess(PROVIDER);

  const partes: ImpexParte[] = data?.original_parts ?? [];
  for (const parte of partes) {
    if (parte.is_discontinued) continue;

    const precioJpy = parte.price_yen;
    if (!precioJpy || precioJpy <= 0) continue;

    return {
      precioJpy: Math.trunc(precioJpy),
      fuente: "impex-jp.com",
      maker: parte.mark ?? "",
      nombre: parte.name_eng || parte.name || "",
      esGenuino: true,
      pesoKg: Number(parte.weight) || 0,
    };
  }
  return null;
}
