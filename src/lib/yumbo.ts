// Cotizador OEM — fuente: Yumbo Japan API.
// Reemplaza a Impex Japan (retirado por problemas repetidos con esa API).
//
// Endpoint: GET https://yumbo-jp.com/api/v1/parts/search.json
// Doc:      https://yumbo-jp.com/en/api.html#/New%20spare%20parts/get_api_v1_parts_search_json
// Auth:     header X-Api-Key (se obtiene en https://yumbo-jp.com/user/user/profile.html)

import { YUMBO_API_KEY } from "./config";
import { getCache, setCache } from "./yumboCache";
import { isPaused, recordFailure, recordSuccess } from "./yumboCircuitBreaker";

export interface YumboResultado {
  precioJpy: number;
  fuente: string;
  maker: string;
  nombre: string;
  esGenuino: boolean;
  /** Peso en kg reportado por Yumbo. 0 = Yumbo no tiene el dato (típico en piezas grandes/voluminosas). */
  pesoKg: number;
}

const YUMBO_API_URL = "https://yumbo-jp.com/api/v1/parts/search.json";

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
 * Busca precio OEM en Yumbo Japan vía API oficial.
 *
 * Endpoint: GET https://yumbo-jp.com/api/v1/parts/search.json
 * Auth:     header X-Api-Key: YUMBO_API_KEY
 * Búsqueda: query param partNo=NUMERO_PARTE
 * Solo se toman piezas originales (se ignora notOriginalReplacements) con
 * priceYen > 0 e isDiscontinued == false.
 */
export async function buscarYumbo(partNumber: string): Promise<YumboResultado | null> {
  if (!YUMBO_API_KEY) return null;

  const clave = partNumber.trim().toUpperCase();

  const cacheado = await getCache(clave);
  if (cacheado) return cacheado.resultado;

  const circuito = await isPaused();
  if (circuito.pausado) {
    const minutos = circuito.pausadoHasta
      ? Math.ceil((circuito.pausadoHasta.getTime() - Date.now()) / 60_000)
      : null;
    throw new Error(
      `Proveedor de precios pausado temporalmente por exceso de consultas.` +
        (minutos ? ` Reintenta en ~${minutos} min.` : ""),
    );
  }

  let resultado: YumboResultado | null = null;
  for (const variante of normalizar(clave)) {
    resultado = await yumboApiFetch(variante);
    if (resultado) break;
  }

  await setCache(clave, resultado);
  return resultado;
}

async function yumboApiFetch(partNumber: string): Promise<YumboResultado | null> {
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
    await recordFailure(null, mensaje);
    throw exc;
  }

  if (!resp.ok) {
    await recordFailure(resp.status, `Yumbo respondió con estado ${resp.status}`);
    throw new Error(`Yumbo respondió con estado ${resp.status}`);
  }

  const data: YumboParte[] = await resp.json();
  if (!Array.isArray(data)) {
    await recordFailure(resp.status, "Yumbo: respuesta inesperada");
    throw new Error("Yumbo: respuesta inesperada");
  }

  await recordSuccess();

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
