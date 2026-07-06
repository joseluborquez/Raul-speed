// Punto de entrada del cotizador de repuestos OEM.

import { calcularPrecioClp, getJpyToClp } from "./calculator";
import { buscarImpexApi } from "./impex";

export interface ResultadoCotizacion {
  partNumber: string;
  estado: "ok" | "no_encontrado" | "error_tipo_cambio";
  mensaje?: string;
  maker?: string;
  nombre?: string;
  precioJpy?: number;
  tipoCambioClp?: number;
  fuenteTipoCambio?: string;
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
export async function cotizar(
  partNumberInput: string,
  tipoCambioOverride?: number | null,
): Promise<ResultadoCotizacion> {
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
  let tipoCambio: number;
  let fuenteTc: string;

  if (tipoCambioOverride) {
    tipoCambio = tipoCambioOverride;
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

  // 3. Aplicar fórmula de negocio.
  const precioClpFinal = calcularPrecioClp(precioJpy, tipoCambio);

  return {
    partNumber,
    estado: "ok",
    maker: resultadoImpex.maker,
    nombre: resultadoImpex.nombre,
    precioJpy,
    tipoCambioClp: Number(tipoCambio.toFixed(6)),
    fuenteTipoCambio: fuenteTc,
    precioClpFinal,
    fuente,
    esGenuino: resultadoImpex.esGenuino,
    fecha: hoyIso(),
  };
}
