// Cotizador OEM — fuente única: Impex Japan API.
// (Motors Head Japan y Yumbo Japan fueron retirados: solo se cotiza vía Impex.)

import { IMPEX_API_KEY } from "./config";

export interface ImpexResultado {
  precioJpy: number;
  fuente: string;
  maker: string;
  nombre: string;
  esGenuino: boolean;
  /** Peso en kg reportado por Impex. 0 = Impex no tiene el dato (típico en piezas grandes/voluminosas). */
  pesoKg: number;
}

const IMPEX_API_URL = "https://www.impex-jp.com/api/parts/search.html";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  accept: "application/json",
};

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
 *
 * Endpoint: GET https://www.impex-jp.com/api/parts/search.html
 * Auth:     query param key=API_KEY
 * Búsqueda: query param part_no=NUMERO_PARTE
 * Solo se toman original_parts con price_yen > 0 y is_discontinued == false.
 */
export async function buscarImpexApi(partNumber: string): Promise<ImpexResultado | null> {
  if (!IMPEX_API_KEY) return null;

  for (const variante of normalizar(partNumber)) {
    const resultado = await impexApiFetch(variante);
    if (resultado) return resultado;
  }
  return null;
}

async function impexApiFetch(partNumber: string): Promise<ImpexResultado | null> {
  const params = new URLSearchParams({
    key: IMPEX_API_KEY,
    part_no: partNumber,
    original_only: "0",
    price_factor: "1",
    price_increase: "0",
  });

  const resp = await fetch(`${IMPEX_API_URL}?${params.toString()}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) throw new Error(`Impex respondió con estado ${resp.status}`);

  const data = await resp.json();

  // Impex puede responder 200 con un {"error": "..."} en vez de resultados
  // (ej. clave suspendida, cuenta marcada para revisión) — eso no es lo
  // mismo que "no encontrado" y no debe tratarse como tal.
  if (data?.error) throw new Error(`Impex: ${data.error}`);

  for (const part of data?.original_parts ?? []) {
    if (part.is_discontinued) continue;

    const precioJpy = part.price_yen;
    if (!precioJpy || precioJpy <= 0) continue;

    return {
      precioJpy: Math.trunc(precioJpy),
      fuente: "impex-jp.com",
      maker: part.mark ?? "",
      nombre: part.name_eng || part.name || "",
      esGenuino: true,
      pesoKg: Number(part.weight) || 0,
    };
  }
  return null;
}
