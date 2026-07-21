// Conversión de moneda (JPY → CLP) y fórmula de negocio.

import { BCENTRAL, FORMULA } from "./config";

export interface TipoCambio {
  tasa: number;
  fuente: string;
}

/**
 * Rango de plausibilidad para CLP por 1 JPY. Referencia: la tasa ronda
 * 5–8 CLP/JPY hace años; el rango es deliberadamente holgado para no
 * rechazar variación cambiaria real, y solo atrapa respuestas rotas de
 * las APIs (0, negativo, o un valor con la escala corrida) antes de que
 * lleguen a los precios del sitio. La tasa manual del admin NO pasa por
 * este filtro — es su herramienta para forzar cualquier valor.
 */
const TASA_JPY_CLP_MIN = 1;
const TASA_JPY_CLP_MAX = 50;

function tasaJpyPlausible(tasa: number): boolean {
  return Number.isFinite(tasa) && tasa >= TASA_JPY_CLP_MIN && tasa <= TASA_JPY_CLP_MAX;
}

/** Mismo criterio que tasaJpyPlausible() pero para USD/CLP (dólar
 * observado ronda 500–1.200 CLP en los últimos años) — usada solo por
 * getUsdToClp() al importar Base_Cotizador_RaulSpeed_COMPLETA.csv. */
const TASA_USD_CLP_MIN = 200;
const TASA_USD_CLP_MAX = 3000;

function tasaUsdPlausible(tasa: number): boolean {
  return Number.isFinite(tasa) && tasa >= TASA_USD_CLP_MIN && tasa <= TASA_USD_CLP_MAX;
}

// ---------------------------------------------------------------------------
// Tipo de cambio JPY → CLP
// ---------------------------------------------------------------------------

function toFechaStr(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Convierte "DD-MM-YYYY" (formato de indexDateString del Banco Central) a "YYYY-MM-DD".
 */
function indexDateToIso(indexDateString: string): string {
  const [dd, mm, yyyy] = indexDateString.split("-");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Consulta el Banco Central de Chile para obtener una tasa de cambio a
 * CLP dada una serie (JPY: F072.CLP.JPY.N.O.D, USD/Dólar Observado:
 * F073.TCO.PRE.Z.D — ver BCENTRAL en config.ts), ambas publican
 * directamente CLP por 1 unidad de la otra moneda.
 *
 * El Banco Central no publica valores los fines de semana ni feriados
 * (esos días vienen con statusCode "ND" y value "NaN"), por lo que se
 * consulta un rango de varios días y se toma la observación más
 * reciente con statusCode "OK".
 */
async function fetchRateBCentral(
  hoy: Date,
  diasAtras: number,
  seriesId: string,
  esPlausible: (tasa: number) => boolean,
): Promise<{ tasa: number; fecha: string } | null> {
  const desde = new Date(hoy);
  desde.setDate(desde.getDate() - diasAtras);

  const params = new URLSearchParams({
    user: BCENTRAL.user,
    pass: BCENTRAL.pass,
    function: "GetSeries",
    timeseries: seriesId,
    firstdate: toFechaStr(desde),
    lastdate: toFechaStr(hoy),
  });

  try {
    const resp = await fetch(
      `https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?${params.toString()}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!resp.ok) return null;
    const data = await resp.json();

    // Estructura: {"Series": {"Obs": [{"indexDateString": "06-07-2026", "statusCode": "OK", "value": "5.71"}]}}
    // La doc oficial usa "statusCode" en minúscula; se acepta también "StatusCode".
    // statusCode "ND" indica día sin dato disponible (feriado/fin de semana).
    const obsList: unknown[] = data?.Series?.Obs ?? [];

    // Recorrer desde el final (fecha más reciente) hacia atrás y quedarse
    // con la primera observación válida.
    for (let i = obsList.length - 1; i >= 0; i--) {
      const obs = obsList[i] as Record<string, unknown>;
      const statusCode = obs.statusCode ?? obs.StatusCode;
      if (statusCode !== "OK") continue;

      const rawValue = parseFloat(String(obs.value).replace(",", "."));
      if (!esPlausible(rawValue)) continue;

      const indexDateString = String(obs.indexDateString ?? "");
      const fecha = indexDateString ? indexDateToIso(indexDateString) : toFechaStr(hoy);
      return { tasa: rawValue, fecha };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fallback: obtiene <moneda>/CLP desde la API pública de exchangerate-api.
 * No requiere credenciales. Se usa cuando el Banco Central falla.
 */
async function fetchRateFallback(
  moneda: "JPY" | "USD",
  esPlausible: (tasa: number) => boolean,
): Promise<number | null> {
  try {
    const resp = await fetch(`https://open.er-api.com/v6/latest/${moneda}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();

    if (data?.result !== "success") return null;

    const clpPorUnidad = Number(data?.rates?.CLP);
    return esPlausible(clpPorUnidad) ? clpPorUnidad : null;
  } catch {
    return null;
  }
}

/**
 * Retorna la tasa JPY → CLP y su fuente.
 * Intenta primero el Banco Central; si falla, usa exchangerate-api.
 * El Banco Central no publica los fines de semana ni feriados, por lo
 * que se consultan los últimos 5 días y se toma el más reciente con
 * statusCode "OK".
 */
export async function getJpyToClp(): Promise<TipoCambio> {
  const today = new Date();

  const resultado = await fetchRateBCentral(today, 4, BCENTRAL.seriesJpy, tasaJpyPlausible);
  if (resultado !== null) {
    return { tasa: resultado.tasa, fuente: `Banco Central Chile (${resultado.fecha})` };
  }

  const rate = await fetchRateFallback("JPY", tasaJpyPlausible);
  if (rate !== null) {
    return { tasa: rate, fuente: `exchangerate-api.com (${toFechaStr(today)})` };
  }

  throw new Error(
    "No se pudo obtener el tipo de cambio JPY/CLP. Verifica credenciales del Banco Central.",
  );
}

/**
 * Retorna la tasa USD → CLP (Dólar Observado) y su fuente. Uso puntual:
 * solo la usa el import de Base_Cotizador_RaulSpeed_COMPLETA.csv para
 * convertir a CLP el precio en USD de Honda/Kawasaki/Yamaha (Suzuki ya
 * viene en CLP) — no es parte del flujo de cotización en vivo.
 */
export async function getUsdToClp(): Promise<TipoCambio> {
  const today = new Date();

  const resultado = await fetchRateBCentral(today, 4, BCENTRAL.seriesUsd, tasaUsdPlausible);
  if (resultado !== null) {
    return { tasa: resultado.tasa, fuente: `Banco Central Chile (${resultado.fecha})` };
  }

  const rate = await fetchRateFallback("USD", tasaUsdPlausible);
  if (rate !== null) {
    return { tasa: rate, fuente: `exchangerate-api.com (${toFechaStr(today)})` };
  }

  throw new Error(
    "No se pudo obtener el tipo de cambio USD/CLP. Verifica credenciales del Banco Central.",
  );
}

// ---------------------------------------------------------------------------
// Fórmula de negocio
// ---------------------------------------------------------------------------

/**
 * Aplica la fórmula de negocio:
 *   precio_base_JPY × tipo_cambio_CLP × multiplicador_1 × multiplicador_2
 *
 * Retorna el precio final redondeado al entero más cercano en CLP.
 */
export function calcularPrecioClp(precioJpy: number, tipoCambio: number): number {
  const precioClp =
    precioJpy * tipoCambio * FORMULA.multiplicador1 * FORMULA.multiplicador2;
  return Math.round(precioClp);
}
