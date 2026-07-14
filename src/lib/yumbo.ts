// Cotizador OEM — fuente: Yumbo Japan API.
//
// Tercera vuelta con este proveedor: se retiró la primera vez porque la
// cuenta agotó su cuota, se probó con Impex como reemplazo y esa cuenta
// empezó a bloquear las consultas que salían desde la red de Vercel
// (devolvía {"error":"contact with manager"} solo para tráfico de
// datacenter, confirmado en vivo — mismo N/P, mismo minuto: falla desde
// Vercel, funciona desde una IP normal). Se vuelve a Yumbo mientras se
// resuelve eso con Impex, protegido por la misma infraestructura de
// resiliencia genérica por proveedor: caché (priceCache.ts), circuit
// breaker (priceCircuitBreaker.ts) y un límite propio de llamadas por
// minuto (rateLimit.ts).
//
// Endpoint: GET https://yumbo-jp.com/api/v1/parts/search.json
// Doc:      https://yumbo-jp.com/en/api.html#/New%20spare%20parts/get_api_v1_parts_search_json
// Auth:     header X-Api-Key (se obtiene en https://yumbo-jp.com/user/user/profile.html)

import { YUMBO_API_KEY } from "./config";
import { getCache, setCache, type ResultadoPrecioProveedor } from "./priceCache";
import { isPaused, recordFailure, recordSuccess } from "./priceCircuitBreaker";
import { rateLimitExcedido } from "./rateLimit";

const PROVIDER = "yumbo";
const YUMBO_API_URL = "https://yumbo-jp.com/api/v1/parts/search.json";

// Límite propio, best-effort en memoria (ver rateLimit.ts) — no hay un
// número documentado de Yumbo, así que se parte con algo conservador.
const LIMITE_LLAMADAS_POR_MINUTO = 20;

interface YumboParte {
  markName: string;
  partNo: string;
  name?: string;
  nameEn?: string;
  weight?: number;
  priceYen: number;
  isDiscontinued: boolean;
}

/**
 * Devuelve variantes del N/P probando los formatos de guión más comunes
 * en repuestos OEM japoneses:
 * - 2 segmentos (Toyota/Suzuki/Kawasaki): 5 caracteres + resto.
 *   "13089-1075" → ["13089-1075", "130891075"]
 *   "130891075"  → ["130891075", "13089-1075"]
 * - 3 segmentos (Yamaha): código de modelo (3) + básico (5) + diseño (2).
 *   "4XV-25384-00" → ["4XV-25384-00", "4XV2538400"]
 *   "4XV2538400"   → ["4XV2538400", "4XV25-38400" (2 seg.), "4XV-25384-00" (3 seg.)]
 */
function normalizar(partNumber: string): string[] {
  const pn = partNumber.trim().toUpperCase();
  const variantes = new Set<string>([pn]);

  if (pn.includes("-")) {
    variantes.add(pn.replaceAll("-", ""));
  } else {
    if (pn.length > 5) {
      variantes.add(`${pn.slice(0, 5)}-${pn.slice(5)}`);
    }
    if (pn.length === 10) {
      variantes.add(`${pn.slice(0, 3)}-${pn.slice(3, 8)}-${pn.slice(8)}`);
    }
  }

  return [...variantes];
}

/**
 * Busca precio OEM en Yumbo Japan vía API oficial.
 */
export async function buscarYumbo(partNumber: string): Promise<ResultadoPrecioProveedor | null> {
  if (!YUMBO_API_KEY) return null;

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
  // error de Yumbo, no hay que rendirse ahí: puede que la otra variante
  // (con el guión en la posición correcta) sí encuentre la pieza. Solo se
  // propaga un error si TODAS las variantes fallaron con error — si
  // alguna respondió limpio (encontrada o no), esa respuesta manda.
  let resultado: ResultadoPrecioProveedor | null = null;
  let huboRespuestaLimpia = false;
  let ultimoError: Error | null = null;

  for (const variante of normalizar(clave)) {
    try {
      resultado = await yumboApiFetch(variante);
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

async function yumboApiFetch(partNumber: string): Promise<ResultadoPrecioProveedor | null> {
  if (rateLimitExcedido("yumbo-global", LIMITE_LLAMADAS_POR_MINUTO, 60_000)) {
    throw new Error("Límite propio de consultas a Yumbo alcanzado. Reintenta en un minuto.");
  }

  const params = new URLSearchParams({
    partNo: partNumber,
    ignoreAlternate: "true",
  });

  let resp: Response;
  try {
    resp = await fetch(`${YUMBO_API_URL}?${params.toString()}`, {
      headers: {
        "X-Api-Key": YUMBO_API_KEY,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (exc) {
    const mensaje = exc instanceof Error ? exc.message : String(exc);
    await recordFailure(PROVIDER, null, mensaje);
    throw exc;
  }

  if (!resp.ok) {
    await recordFailure(PROVIDER, resp.status, `Yumbo respondió con estado ${resp.status}`);
    throw new Error(`Yumbo respondió con estado ${resp.status}`);
  }

  const data: YumboParte[] = await resp.json();
  if (!Array.isArray(data)) {
    await recordFailure(PROVIDER, resp.status, "Yumbo: respuesta inesperada");
    throw new Error("Yumbo: respuesta inesperada");
  }

  await recordSuccess(PROVIDER);

  for (const parte of data) {
    if (parte.isDiscontinued) continue;

    const precioJpy = parte.priceYen;
    if (!precioJpy || precioJpy <= 0) continue;

    return {
      precioJpy: Math.trunc(precioJpy),
      fuente: "yumbo-jp.com",
      maker: parte.markName ?? "",
      nombre: parte.nameEn || parte.name || "",
      esGenuino: true,
      pesoKg: Number(parte.weight) || 0,
    };
  }
  return null;
}
