// Punto de entrada del cotizador de repuestos OEM.

import { calcularPrecioClp, getJpyToClp } from "./calculator";
import { cargarFiltroEnvio } from "./filtroEnvioConfig";
import { buscarImpex } from "./impex";
import { buscarPesoPorPrefijo, registrarUsoPrefijo } from "./prefijosLivianos";
import {
  conservarNombreGuardado,
  DATOS_CATALOGO_DEFAULT,
  getDatosCatalogo,
  registrarCotizacion,
  tocarCotizacion,
  type DatosCatalogo,
} from "./repuestosCatalogo";
import {
  clasificarEnvio,
  nombreIndicaPiezaGrande,
  type ClasificacionEnvio,
  type ConfigFiltroEnvio,
  type DatosClasificacion,
  type ListasFiltroEnvio,
  type ResultadoEnvio,
} from "./sobrecargoEnvio";
import { getSettings } from "./settings";

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
   * Peso en kg efectivo: el que reporta el proveedor si lo trae, si no el
   * cargado a mano por el admin en el catálogo de repuestos. 0 = sin dato
   * de ningún lado (posible pieza voluminosa).
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

  // La alarma por nombre manda: si el catálogo dio un nombre de pieza
  // grande/pesada (VOLUMINOSAS/PESADAS no neutralizada), no se rescata por
  // prefijo aunque exista una familia liviana con ese prefijo — un peso
  // asumido no puede pisar una señal de nombre dura.
  if (nombreIndicaPiezaGrande(datos, listasFiltro)) {
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
 * RESPALDO: costo del catálogo interno en JPY (ver getDatosCatalogo() en
 * repuestosCatalogo.ts). Se usa cuando Impex no está disponible — no
 * cuando responde que la pieza no existe, ver cotizar() más abajo.
 *
 * Pasa por la misma fórmula de negocio y la misma tasa de cambio vigente
 * (manual o Banco Central) que el camino de Impex, así que reacciona igual
 * a un cambio de tasa manual del admin. Lo único distinto es de cuándo es
 * el costo en JPY: acá es el de la última cotización que sí alcanzó a
 * Impex (o el del import inicial).
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
      fecha: hoyIso(),
    };
  }

  const { config: configFiltro, listas: listasFiltro } = await cargarFiltroEnvio();
  const precioJpy = datosCatalogo.costoJpy ?? 0;
  const precioRepuestoClp = calcularPrecioClp(precioJpy, tipoCambio);

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
    precioJpy,
    tipoCambioClp: Number(tipoCambio.toFixed(6)),
    fuenteTipoCambio: fuenteTc,
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

  // 0. Datos del catálogo interno. Se leen SIEMPRE, para dos cosas
  // distintas: el peso manual y la calidad del dato (oem_valido /
  // nombre_confiable), que alimentan clasificarEnvio() más abajo aunque el
  // precio venga de Impex; y costo_jpy, que es el respaldo si Impex no
  // está disponible.
  let datosCatalogo: DatosCatalogo = DATOS_CATALOGO_DEFAULT;
  try {
    datosCatalogo = await getDatosCatalogo(partNumber);
  } catch {
    // sin catálogo esta vez: se sigue con los defaults permisivos. Si
    // además Impex falla, la cotización sale con error_proveedor.
  }

  // Un código marcado oem_valido=false explícito no se sirve desde el
  // catálogo ni siquiera como respaldo: ya está señalado como problemático
  // y se prefiere no cotizarlo antes que cotizarlo con un precio viejo.
  const hayRespaldo = datosCatalogo.oemValido !== false && datosCatalogo.costoJpy !== null;

  // 1. Precio en vivo desde Impex.
  //
  // ORDEN: Impex primero, base de datos como respaldo. Antes era al revés
  // —un código con costo_jpy cortocircuitaba acá y nunca se volvía a
  // llamar al proveedor—, lo que dejaba el precio congelado en el de la
  // primera cotización. Con la cuenta nueva de 500 consultas/día se
  // prefiere precio fresco, y los resguardos de impex.ts hacen que agotar
  // la cuota degrade a este mismo respaldo en vez de romper nada.
  //
  // Si la cuota no diera abasto, volver al orden anterior es adelantar el
  // bloque `if (hayRespaldo) return cotizarDesdeCatalogo(...)` a acá.
  let resultadoProveedor;
  try {
    resultadoProveedor = await buscarImpex(partNumber);
  } catch (exc) {
    // Impex no pudo responder: sin key, cuota diaria agotada, circuito
    // abierto, límite por minuto o error de red. Nada de eso dice algo
    // sobre la pieza, así que se sirve el último costo conocido.
    if (hayRespaldo) return cotizarDesdeCatalogo(partNumber, datosCatalogo);
    return {
      partNumber,
      estado: "error_proveedor",
      mensaje: exc instanceof Error ? exc.message : String(exc),
      fecha: hoyIso(),
    };
  }

  if (resultadoProveedor === null) {
    // Respuesta limpia del proveedor: la pieza no existe. Acá NO se cae al
    // respaldo a propósito — impexApiFetch() descarta las piezas con
    // is_discontinued, así que este null incluye "ya no se fabrica", y
    // cotizarla con un precio viejo del catálogo sería venderle al cliente
    // algo que no se puede conseguir. Cuando el proveedor responde limpio,
    // su respuesta manda sobre el catálogo.
    return {
      partNumber,
      estado: "no_encontrado",
      mensaje: "Repuesto no encontrado o sin stock",
      fecha: hoyIso(),
    };
  }

  const { precioJpy, fuente } = resultadoProveedor;

  // PESO: manda el que reporta Impex; el manual del catálogo es el
  // respaldo. Es lo contrario de como estaba, y el cambio se apoya en que
  // Impex sí trae peso —a diferencia de Yumbo, que no traía nunca (0 de 49
  // códigos en la verificación de sobrecargoEnvio.ts), que es la razón por
  // la que existe peso_kg_manual.
  //
  // 0 = el proveedor no lo reportó, no "pesa cero", así que ahí entra el
  // manual. Si tampoco hay manual, queda en 0 y clasificarEnvio() lo trata
  // como "sin peso" (paso 3).
  //
  // fuentePeso acompaña al peso que realmente se usó: si quedara la
  // etiqueta del catálogo mientras se usa el peso de Impex, un código con
  // Fuente_Peso "NIVEL 3 · estimado" mostraría la leyenda de peso estimado
  // sobre un peso que el proveedor sí midió (ver la leyenda en
  // clasificarEnvio()).
  const usaPesoProveedor = resultadoProveedor.pesoKg > 0;
  const pesoEfectivo = usaPesoProveedor
    ? resultadoProveedor.pesoKg
    : (datosCatalogo.pesoKgManual ?? 0);
  const fuentePesoEfectiva = usaPesoProveedor
    ? "Reportado por el proveedor (Impex)"
    : datosCatalogo.fuentePeso;

  // Nombre real solo se muestra al cliente si es confiable (inglés,
  // evaluable contra las listas de alarma). Si no, se oculta pero se sigue
  // guardando el real en el catálogo — ver registrarCotizacion() abajo.
  //
  // Cuando Impex manda el nombre solo en katakana pero el catálogo tiene
  // uno en alfabeto latino, gana el del catálogo: al cliente chileno "SEAL"
  // le dice algo y "ｼ-ﾙ" no. Misma regla que conservarNombreGuardado() usa
  // para no degradar la fila; acá aplicada a lo que se muestra. Sin esto,
  // invertir el orden (proveedor antes que catálogo) empeoró nombres que
  // antes se veían bien, porque el atajo del catálogo ya no los servía.
  const nombreCatalogo = datosCatalogo.nombre?.trim() || null;
  const nombreMostrable =
    nombreCatalogo && conservarNombreGuardado(resultadoProveedor.nombre, nombreCatalogo)
      ? nombreCatalogo
      : resultadoProveedor.nombre;
  //
  // El nombre vacío entra al mismo respaldo que el no confiable: Impex
  // tiene filas con name y name_eng en blanco, y sin este freno el
  // repuesto viaja sin nombre hasta el carrito, el pedido y el panel de
  // admin, donde queda un "HONDA — $55.350" que parece un dato cortado
  // (pedido cfe3ea29).
  const nombreParaCliente =
    datosCatalogo.nombreConfiable && nombreMostrable.trim()
      ? nombreMostrable
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
      nombre: resultadoProveedor.nombre,
      nombreNativo: resultadoProveedor.nombreNativo,
      pesoKg: pesoEfectivo,
      precioRepuestoClp,
      oemValido: datosCatalogo.oemValido,
      nombreConfiable: datosCatalogo.nombreConfiable,
      fuentePeso: fuentePesoEfectiva,
    },
    partNumber,
    resultadoProveedor.maker,
    configFiltro,
    listasFiltro,
  );
  const precioClpFinal = precioRepuestoClp + costoLogisticaClp + clasificacion.extraClp;

  // Catálogo de repuestos cotizados (para /admin/repuestos): registra o
  // actualiza este N° de parte con lo que acaba de devolver Impex —
  // costo_jpy, costo_clp, peso y nombre. Como este camino ahora corre en
  // CADA cotización (Impex va primero), el catálogo se refresca solo: deja
  // de ser una foto del día en que se cotizó el código por primera vez y
  // pasa a ser el último dato bueno conocido, que es justo lo que
  // cotizarDesdeCatalogo() sirve cuando Impex no está disponible.
  // Nunca debe romper la cotización si Supabase falla acá.
  try {
    await registrarCotizacion({
      partNumber,
      maker: resultadoProveedor.maker,
      nombre: resultadoProveedor.nombre,
      pesoKgProveedor: resultadoProveedor.pesoKg,
      costoClp: precioRepuestoClp,
      costoJpy: precioJpy,
    });
  } catch {
    // no rompe la cotización si falla el catálogo.
  }

  return {
    partNumber,
    estado: "ok",
    maker: resultadoProveedor.maker,
    nombre: nombreParaCliente,
    precioJpy,
    tipoCambioClp: Number(tipoCambio.toFixed(6)),
    fuenteTipoCambio: fuenteTc,
    precioRepuestoClp,
    costoLogisticaClp,
    precioClpFinal,
    fuente,
    esGenuino: resultadoProveedor.esGenuino,
    pesoKg: pesoFinal,
    envioResultado: clasificacion.resultado,
    envioExtraClp: clasificacion.extraClp,
    envioMensaje: clasificacion.mensaje,
    fecha: hoyIso(),
  };
}
