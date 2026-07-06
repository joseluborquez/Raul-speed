// Conversión de moneda (JPY → CLP) y fórmula de negocio.

import { BCENTRAL, FORMULA } from "./config";

export interface TipoCambio {
  tasa: number;
  fuente: string;
}

// ---------------------------------------------------------------------------
// Tipo de cambio JPY → CLP
// ---------------------------------------------------------------------------

function toFechaStr(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Consulta el Banco Central de Chile para obtener JPY → CLP.
 * El Banco Central publica el tipo de cambio en CLP por 100 JPY,
 * por eso se divide el resultado entre 100.
 */
async function fetchRateBCentral(fecha: Date): Promise<number | null> {
  const fechaStr = toFechaStr(fecha);
  const params = new URLSearchParams({
    user: BCENTRAL.user,
    pass: BCENTRAL.pass,
    function: "GetSeries",
    timeseries: BCENTRAL.seriesJpy,
    firstdate: fechaStr,
    lastdate: fechaStr,
  });

  try {
    const resp = await fetch(
      `https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?${params.toString()}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!resp.ok) return null;
    const data = await resp.json();

    // Estructura: {"Series": {"Obs": [{"StatusCode": "OK", "value": "8.22"}]}}
    const obsList = data?.Series?.Obs ?? [];
    for (const obs of obsList) {
      if (obs.StatusCode === "OK") {
        const rawValue = parseFloat(String(obs.value).replace(",", "."));
        // El Banco Central publica JPY/CLP como CLP por 100 JPY
        return rawValue / 100.0;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fallback: obtiene JPY/CLP desde la API pública de exchangerate-api.
 * No requiere credenciales. Se usa cuando el Banco Central falla.
 */
async function fetchRateFallback(): Promise<number | null> {
  try {
    const resp = await fetch("https://open.er-api.com/v6/latest/JPY", {
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();

    if (data?.result !== "success") return null;

    const clpPerJpy = data?.rates?.CLP;
    return clpPerJpy ? Number(clpPerJpy) : null;
  } catch {
    return null;
  }
}

/**
 * Retorna la tasa JPY → CLP y su fuente.
 * Intenta primero el Banco Central; si falla, usa exchangerate-api.
 * Busca hasta 5 días hábiles anteriores si el día actual no tiene datos.
 */
export async function getJpyToClp(): Promise<TipoCambio> {
  const today = new Date();

  for (let delta = 0; delta < 5; delta++) {
    const fecha = new Date(today);
    fecha.setDate(fecha.getDate() - delta);
    const rate = await fetchRateBCentral(fecha);
    if (rate !== null) {
      return { tasa: rate, fuente: `Banco Central Chile (${toFechaStr(fecha)})` };
    }
  }

  const rate = await fetchRateFallback();
  if (rate !== null) {
    return { tasa: rate, fuente: `exchangerate-api.com (${toFechaStr(today)})` };
  }

  throw new Error(
    "No se pudo obtener el tipo de cambio JPY/CLP. Verifica credenciales del Banco Central.",
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
