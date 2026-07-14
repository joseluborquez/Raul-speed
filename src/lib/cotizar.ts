// Punto de entrada del cotizador de repuestos OEM.

import { calcularPrecioClp, getJpyToClp } from "./calculator";
import { getPesoManual, registrarCotizacion } from "./repuestosCatalogo";
import { clasificarEnvio, type ResultadoEnvio } from "./sobrecargoEnvio";
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
  /**
   * Peso en kg efectivo: el cargado a mano por el admin en el catálogo
   * de repuestos si existe, si no el que reporta el proveedor. 0 = sin
   * dato de ningún lado (posible pieza voluminosa).
   */
  pesoKg?: number;
  /** Clasificación de envío según la tabla de reglas (ver sobrecargoEnvio.ts). */
  envioResultado?: ResultadoEnvio;
  /** Monto en CLP ya incluido en precioClpFinal cuando envioResultado es "extra_automatico". */
  envioExtraClp?: number;
  envioMensaje?: string;
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

  // Catálogo de repuestos cotizados (para /admin/repuestos): registra o
  // actualiza este N° de parte, y si el admin ya cargó un peso a mano
  // para él, ese peso manda sobre el que trae el proveedor — ver
  // repuestosCatalogo.ts. Nunca debe romper la cotización si Supabase
  // falla acá.
  let pesoEfectivo = resultadoYumbo.pesoKg;
  try {
    const pesoManual = await getPesoManual(partNumber);
    if (pesoManual !== null) pesoEfectivo = pesoManual;

    await registrarCotizacion({
      partNumber,
      maker: resultadoYumbo.maker,
      nombre: resultadoYumbo.nombre,
      pesoKgProveedor: resultadoYumbo.pesoKg,
    });
  } catch {
    // sin catálogo esta vez, pero la cotización sigue con el peso del proveedor.
  }

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

  // 3. Aplicar fórmula de negocio y clasificar el envío (peso + nombre + precio).
  const precioRepuestoClp = calcularPrecioClp(precioJpy, tipoCambio);
  const clasificacion = clasificarEnvio({
    nombre: resultadoYumbo.nombre,
    pesoKg: pesoEfectivo,
    precioRepuestoClp,
  });
  const precioClpFinal = precioRepuestoClp + costoLogisticaClp + clasificacion.extraClp;

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
    pesoKg: pesoEfectivo,
    envioResultado: clasificacion.resultado,
    envioExtraClp: clasificacion.extraClp,
    envioMensaje: clasificacion.mensaje,
    fecha: hoyIso(),
  };
}
