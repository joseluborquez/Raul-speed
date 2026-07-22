// Punto de entrada del cotizador de repuestos OEM.

import { calcularPrecioClp, getJpyToClp } from "./calculator";
import { cargarFiltroEnvio } from "./filtroEnvioConfig";
import { buscarPesoPorPrefijo, registrarUsoPrefijo } from "./prefijosLivianos";
import {
  DATOS_CATALOGO_DEFAULT,
  getDatosCatalogo,
  registrarCotizacion,
  tocarCotizacion,
  type DatosCatalogo,
} from "./repuestosCatalogo";
import {
  clasificarEnvio,
  type ClasificacionEnvio,
  type ConfigFiltroEnvio,
  type DatosClasificacion,
  type ListasFiltroEnvio,
  type ResultadoEnvio,
} from "./sobrecargoEnvio";
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
 * Filtro adicional por prefijo de código OEM (ver
 * supabase/migrations/0015_prefijos_livianos.sql y prefijosLivianos.ts):
 * reduce cotizaciones que caen a WhatsApp sin necesidad. Corre SOLO
 * cuando clasificarEnvio() ya dio "alerta_whatsapp" con el peso normal —
 * nunca toca un resultado que ya pasaba. Si la familia marca+prefijo del
 * código es conocida (confianza ALTA/MEDIA), reintenta la clasificación
 * asumiendo el Peso_p95_kg de esa familia; si eso también evita la
 * alerta, lo usa y registra el rescate para auditoría. Si no hay match, o
 * el reintento sigue alarmando (ej. nombre en PESADAS/VOLUMINOSAS), se
 * conserva el resultado original sin cambios.
 */
async function conFiltroPrefijo(
  datos: DatosClasificacion,
  partNumber: string,
  maker: string | null | undefined,
  configFiltro: ConfigFiltroEnvio,
  listasFiltro: ListasFiltroEnvio,
): Promise<{ pesoKg: number; clasificacion: ClasificacionEnvio }> {
  const clasificacion = clasificarEnvio(datos, configFiltro, listasFiltro);
  if (clasificacion.resultado !== "alerta_whatsapp") {
    return { pesoKg: datos.pesoKg, clasificacion };
  }

  let prefijo;
  try {
    prefijo = await buscarPesoPorPrefijo(partNumber, maker);
  } catch {
    return { pesoKg: datos.pesoKg, clasificacion };
  }
  if (!prefijo) return { pesoKg: datos.pesoKg, clasificacion };

  const clasificacionConPrefijo = clasificarEnvio(
    {
      ...datos,
      pesoKg: prefijo.pesoKg,
      fuentePeso: `Estimado por familia de prefijo OEM (${prefijo.categoria ?? "sin categoría"}, confianza ${prefijo.confianza})`,
    },
    configFiltro,
    listasFiltro,
  );
  if (clasificacionConPrefijo.resultado === "alerta_whatsapp") {
    return { pesoKg: datos.pesoKg, clasificacion };
  }

  registrarUsoPrefijo({
    partNumber,
    marca: prefijo.marca,
    prefijo: prefijo.prefijo,
    categoriaDominante: prefijo.categoria,
    confianza: prefijo.confianza,
    pesoAsignadoKg: prefijo.pesoKg,
  }).catch(() => {});

  return { pesoKg: prefijo.pesoKg, clasificacion: clasificacionConPrefijo };
}

/**
 * Precio ya final de venta (Base_Cotizador_RaulSpeed_COMPLETA.csv — ver
 * migración 0013), sin multiplicador de calculator.ts: no es un costo en
 * JPY, es el precio en CLP que se le cobra al cliente tal cual.
 */
async function cotizarDesdeCatalogo(
  partNumber: string,
  datosCatalogo: DatosCatalogo,
): Promise<ResultadoCotizacion> {
  const pesoEfectivo = datosCatalogo.pesoKgManual ?? 0;
  const nombreCatalogo = datosCatalogo.nombre?.trim() || null;
  const nombreParaCliente =
    datosCatalogo.nombreConfiable && nombreCatalogo
      ? nombreCatalogo
      : `Repuesto original [${partNumber}]`;

  const { costoLogisticaClp } = await getSettings();
  const { config: configFiltro, listas: listasFiltro } = await cargarFiltroEnvio();
  const precioRepuestoClp = datosCatalogo.precioVentaClp ?? 0;

  const { pesoKg: pesoFinal, clasificacion } = await conFiltroPrefijo(
    {
      nombre: nombreCatalogo ?? "",
      nombreNativo: null,
      pesoKg: pesoEfectivo,
      precioRepuestoClp,
      oemValido: datosCatalogo.oemValido,
      nombreConfiable: datosCatalogo.nombreConfiable,
      fuentePeso: datosCatalogo.fuentePeso,
    },
    partNumber,
    datosCatalogo.maker,
    configFiltro,
    listasFiltro,
  );
  const precioClpFinal = precioRepuestoClp + costoLogisticaClp + clasificacion.extraClp;

  // Solo cuenta la búsqueda (veces_cotizado) — no toca maker/nombre/peso/
  // costo, ver tocarCotizacion() en repuestosCatalogo.ts.
  try {
    await tocarCotizacion(partNumber);
  } catch {
    // no rompe la cotización si falla el contador.
  }

  return {
    partNumber,
    estado: "ok",
    maker: datosCatalogo.maker ?? "",
    nombre: nombreParaCliente,
    precioRepuestoClp,
    costoLogisticaClp,
    precioClpFinal,
    fuente: "Catálogo interno",
    esGenuino: true,
    pesoKg: pesoFinal,
    envioResultado: clasificacion.resultado,
    envioExtraClp: clasificacion.extraClp,
    envioMensaje: clasificacion.mensaje,
    fecha: hoyIso(),
  };
}

/**
 * Cotiza una pieza OEM dado su número de parte.
 */
export async function cotizar(partNumberInput: string): Promise<ResultadoCotizacion> {
  const partNumber = partNumberInput.trim().toUpperCase();

  // 0. Catálogo interno primero: si el código ya tiene precio_venta_clp
  // cargado (Base_Cotizador_RaulSpeed_COMPLETA.csv), se cotiza directo
  // desde ahí y NI SIQUIERA se llama a Yumbo — el proveedor ha fallado
  // repetidas veces (cuota agotada, respuestas malformadas, ver
  // price_circuit_breaker). Un código marcado oem_valido=false explícito
  // no toma este atajo: se prefiere que pase por la verificación en vivo
  // de Yumbo en vez de servir un precio importado para un código ya
  // señalado como problemático.
  let datosCatalogo: DatosCatalogo = DATOS_CATALOGO_DEFAULT;
  try {
    datosCatalogo = await getDatosCatalogo(partNumber);
  } catch {
    // sin catálogo esta vez, sigue con los defaults permisivos y el
    // flujo de Yumbo de abajo.
  }

  if (datosCatalogo.oemValido !== false && datosCatalogo.precioVentaClp !== null) {
    return cotizarDesdeCatalogo(partNumber, datosCatalogo);
  }

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

  // Peso cargado a mano por el admin (o importado) para este N° de parte
  // en el catálogo manda sobre el que trae el proveedor — ver
  // getDatosCatalogo() en repuestosCatalogo.ts. oemValido/nombreConfiable
  // se usan en clasificarEnvio() más abajo (Filtros del cotizador v3).
  let pesoEfectivo = resultadoYumbo.pesoKg;
  if (datosCatalogo.pesoKgManual !== null) pesoEfectivo = datosCatalogo.pesoKgManual;

  // Nombre real solo se muestra al cliente si es confiable (inglés,
  // evaluable contra las listas de alarma). Si no, se oculta pero se sigue
  // guardando el real en el catálogo — ver registrarCotizacion() abajo.
  const nombreParaCliente = datosCatalogo.nombreConfiable
    ? resultadoYumbo.nombre
    : `Repuesto original [${partNumber}]`;

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

  // 3. Aplicar fórmula de negocio y clasificar el envío (peso + nombre +
  // precio + calidad del dato — ver Filtros del cotizador v3).
  const precioRepuestoClp = calcularPrecioClp(precioJpy, tipoCambio);
  const { config: configFiltro, listas: listasFiltro } = await cargarFiltroEnvio();
  const { pesoKg: pesoFinal, clasificacion } = await conFiltroPrefijo(
    {
      nombre: resultadoYumbo.nombre,
      nombreNativo: resultadoYumbo.nombreNativo,
      pesoKg: pesoEfectivo,
      precioRepuestoClp,
      oemValido: datosCatalogo.oemValido,
      nombreConfiable: datosCatalogo.nombreConfiable,
      fuentePeso: datosCatalogo.fuentePeso,
    },
    partNumber,
    resultadoYumbo.maker,
    configFiltro,
    listasFiltro,
  );
  const precioClpFinal = precioRepuestoClp + costoLogisticaClp + clasificacion.extraClp;

  // Catálogo de repuestos cotizados (para /admin/repuestos): registra o
  // actualiza este N° de parte con el costo recién calculado. Nunca debe
  // romper la cotización si Supabase falla acá.
  try {
    await registrarCotizacion({
      partNumber,
      maker: resultadoYumbo.maker,
      nombre: resultadoYumbo.nombre,
      pesoKgProveedor: resultadoYumbo.pesoKg,
      costoClp: precioRepuestoClp,
    });
  } catch {
    // no rompe la cotización si falla el catálogo.
  }

  return {
    partNumber,
    estado: "ok",
    maker: resultadoYumbo.maker,
    nombre: nombreParaCliente,
    precioJpy,
    tipoCambioClp: Number(tipoCambio.toFixed(6)),
    fuenteTipoCambio: fuenteTc,
    precioRepuestoClp,
    costoLogisticaClp,
    precioClpFinal,
    fuente,
    esGenuino: resultadoYumbo.esGenuino,
    pesoKg: pesoFinal,
    envioResultado: clasificacion.resultado,
    envioExtraClp: clasificacion.extraClp,
    envioMensaje: clasificacion.mensaje,
    fecha: hoyIso(),
  };
}
