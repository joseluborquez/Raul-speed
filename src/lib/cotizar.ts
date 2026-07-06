// Punto de entrada del cotizador de repuestos OEM.

import { calcularPrecioClp, getJpyToClp } from "./calculator";
import { buscarImpexApi } from "./impex";
import { getSettings } from "./settings";

export interface ResultadoCotizacion {
  partNumber: string;
  estado: "ok" | "no_encontrado" | "error_tipo_cambio";
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
  fecha: string;
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Cotiza una pieza OEM dado su número de parte.
 */
export async function cotizar(partNumberInput: string): Promise<ResultadoCotizacion> {
  const partNumber = partNumberInput.trim().toUpperCase();

  // 1. Obtener precio JPY desde Impex Japan.
  const resultadoImpex = await buscarImpexApi(partNumber);

  if (resultadoImpex === null) {
    return {
      partNumber,
      estado: "no_encontrado",
      mensaje: "Repuesto no encontrado o sin stock",
      fecha: hoyIso(),
    };
  }

  const { precioJpy, fuente } = resultadoImpex;

  // 2. Obtener tipo de cambio JPY → CLP.
  // Si el admin fijó una tasa manual (global, en Supabase), se usa para
  // todas las cotizaciones; si no, se consulta el Banco Central.
  const { costoLogisticaClp, tipoCambioManual } = await getSettings();

  let tipoCambio: number;
  let fuenteTc: string;

  if (tipoCambioManual !== null) {
    tipoCambio = tipoCambioManual;
    fuenteTc = "Manual (administrador)";
  } else {
    try {
      const tc = await getJpyToClp();
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
  }

  // 3. Aplicar fórmula de negocio y sumar el costo de logística.
  const precioRepuestoClp = calcularPrecioClp(precioJpy, tipoCambio);
  const precioClpFinal = precioRepuestoClp + costoLogisticaClp;

  return {
    partNumber,
    estado: "ok",
    maker: resultadoImpex.maker,
    nombre: resultadoImpex.nombre,
    precioJpy,
    tipoCambioClp: Number(tipoCambio.toFixed(6)),
    fuenteTipoCambio: fuenteTc,
    precioRepuestoClp,
    costoLogisticaClp,
    precioClpFinal,
    fuente,
    esGenuino: resultadoImpex.esGenuino,
    fecha: hoyIso(),
  };
}
