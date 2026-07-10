// Punto de entrada del cotizador de repuestos OEM.

import { calcularPrecioClp, getJpyToClp } from "./calculator";
import { getSettings } from "./settings";
import { buscarYumbo } from "./yumbo";

export interface ResultadoCotizacion {
  partNumber: string;
  estado: "ok" | "no_encontrado" | "error_tipo_cambio" | "error_proveedor";
  mensaje?: string;
  maker?: string;
  nombre?: string;
  precioJpy?: number;
  tipoCambioClp?: number;
  fuenteTipoCambio?: string;
  precioRepuestoClp?: number;
  costoLogisticaClp?: number;
  precioClpFinal?: number;
  fuente?: string;
  esGenuino?: boolean;
  /** Peso en kg reportado por Yumbo. 0 = sin dato (posible pieza voluminosa). */
  pesoKg?: number;
  fecha: string;
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface TipoCambioActivo {
  tasa: number;
  fuente: string;
}

/**
 * Devuelve la tasa JPY→CLP a usar: la manual del admin si está fijada,
 * si no la del Banco Central (con fallback). Compartida entre el
 * cotizador principal y el cálculo de sobrecargo por volumen para que
 * ambos usen siempre la misma tasa.
 */
export async function obtenerTipoCambioActivo(
  tipoCambioManual: number | null,
): Promise<TipoCambioActivo> {
  if (tipoCambioManual !== null) {
    return { tasa: tipoCambioManual, fuente: "Manual (administrador)" };
  }
  const tc = await getJpyToClp();
  return { tasa: tc.tasa, fuente: tc.fuente };
}

/**
 * Cotiza una pieza OEM dado su número de parte.
 */
export async function cotizar(partNumberInput: string): Promise<ResultadoCotizacion> {
  const partNumber = partNumberInput.trim().toUpperCase();

  // 1. Obtener precio JPY desde Yumbo Japan.
  let resultadoYumbo;
  try {
    resultadoYumbo = await buscarYumbo(partNumber);
  } catch (exc) {
    return {
      partNumber,
      estado: "error_proveedor",
      mensaje: exc instanceof Error ? exc.message : String(exc),
      fecha: hoyIso(),
    };
  }

  if (resultadoYumbo === null) {
    return {
      partNumber,
      estado: "no_encontrado",
      mensaje: "Repuesto no encontrado o sin stock",
      fecha: hoyIso(),
    };
  }

  const { precioJpy, fuente } = resultadoYumbo;

  // 2. Obtener tipo de cambio JPY → CLP.
  // Si el admin fijó una tasa manual (global, en Supabase), se usa para
  // todas las cotizaciones; si no, se consulta el Banco Central.
  const { costoLogisticaClp, tipoCambioManual } = await getSettings();

  let tipoCambio: number;
  let fuenteTc: string;

  try {
    const tc = await obtenerTipoCambioActivo(tipoCambioManual);
    tipoCambio = tc.tasa;
    fuenteTc = tc.fuente;
  } catch (exc) {
    return {
      partNumber,
      estado: "error_tipo_cambio",
      mensaje: exc instanceof Error ? exc.message : String(exc),
      precioJpy,
      fuente,
      fecha: hoyIso(),
    };
  }

  // 3. Aplicar fórmula de negocio y sumar el costo de logística.
  const precioRepuestoClp = calcularPrecioClp(precioJpy, tipoCambio);
  const precioClpFinal = precioRepuestoClp + costoLogisticaClp;

  return {
    partNumber,
    estado: "ok",
    maker: resultadoYumbo.maker,
    nombre: resultadoYumbo.nombre,
    precioJpy,
    tipoCambioClp: Number(tipoCambio.toFixed(6)),
    fuenteTipoCambio: fuenteTc,
    precioRepuestoClp,
    costoLogisticaClp,
    precioClpFinal,
    fuente,
    esGenuino: resultadoYumbo.esGenuino,
    pesoKg: resultadoYumbo.pesoKg,
    fecha: hoyIso(),
  };
}
