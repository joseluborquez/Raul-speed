// Catálogo de repuestos ya cotizados (una fila por N° de parte), para que
// el admin pueda cargar el peso a mano cuando el proveedor no lo trae —
// ver 0004_repuestos_catalogo.sql para el porqué. El peso manual, una vez
// cargado, tiene prioridad sobre el del proveedor (ver getDatosCatalogo(),
// usado desde cotizar()).

import { createAdminClient } from "./supabase/admin";

export interface RepuestoCatalogo {
  partNumber: string;
  maker: string | null;
  nombre: string | null;
  pesoKgProveedor: number | null;
  pesoKgManual: number | null;
  costoClp: number | null;
  vecesCotizado: number;
  primeraCotizacion: string;
  ultimaCotizacion: string;
}

/**
 * Registra o actualiza un repuesto en el catálogo tras una cotización
 * exitosa. No incluye peso_kg_manual ni primera_cotizacion en el upsert
 * a propósito: Postgres solo pisa las columnas listadas en ON CONFLICT
 * DO UPDATE, así que el peso que el admin ya haya cargado queda intacto.
 */
export async function registrarCotizacion(input: {
  partNumber: string;
  maker: string;
  nombre: string;
  pesoKgProveedor: number;
  costoClp: number;
}): Promise<void> {
  const supabase = createAdminClient();

  const { data: existente } = await supabase
    .from("repuestos_catalogo")
    .select("veces_cotizado")
    .eq("part_number", input.partNumber)
    .maybeSingle();

  const ahora = new Date().toISOString();

  const { error } = await supabase.from("repuestos_catalogo").upsert({
    part_number: input.partNumber,
    maker: input.maker,
    nombre: input.nombre,
    peso_kg_proveedor: input.pesoKgProveedor,
    costo_clp: input.costoClp,
    veces_cotizado: (existente?.veces_cotizado ?? 0) + 1,
    ultima_cotizacion: ahora,
    updated_at: ahora,
  });

  if (error) throw new Error(error.message);
}

export interface DatosCatalogo {
  /** Peso cargado a mano por el admin (o importado), si existe. */
  pesoKgManual: number | null;
  /** false = código marcado inválido en el catálogo. Default true (permisivo:
   * la mayoría del catálogo no tiene esta info todavía). */
  oemValido: boolean;
  /** false = el nombre no está en un formato/idioma evaluable (español,
   * ruso, japonés) — el peso igual sirve, pero no se evalúan las alarmas de
   * nombre (están en inglés) ni se muestra el nombre real al cliente.
   * Default true. */
  nombreConfiable: boolean;
  /** Texto de la columna Fuente_Peso, si existe. */
  fuentePeso: string | null;
}

const DATOS_CATALOGO_DEFAULT: DatosCatalogo = {
  pesoKgManual: null,
  oemValido: true,
  nombreConfiable: true,
  fuentePeso: null,
};

/**
 * Datos de calidad/peso cargados para este N° de parte, si existe en el
 * catálogo. Se llama desde cotizar() para clasificarEnvio() — ver Filtros
 * del cotizador v3. Sin fila en el catálogo, se asume permisivo (válido,
 * confiable, sin peso propio) en vez de bloquear algo que no está marcado
 * explícitamente como problemático.
 */
export async function getDatosCatalogo(partNumber: string): Promise<DatosCatalogo> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("repuestos_catalogo")
    .select("peso_kg_manual, oem_valido, nombre_confiable, fuente_peso")
    .eq("part_number", partNumber)
    .maybeSingle();

  if (error || !data) return DATOS_CATALOGO_DEFAULT;

  return {
    pesoKgManual: data.peso_kg_manual === null ? null : Number(data.peso_kg_manual),
    oemValido: data.oem_valido !== false,
    nombreConfiable: data.nombre_confiable !== false,
    fuentePeso: data.fuente_peso,
  };
}

function mapearFila(fila: {
  part_number: string;
  maker: string | null;
  nombre: string | null;
  peso_kg_proveedor: string | number | null;
  peso_kg_manual: string | number | null;
  costo_clp: string | number | null;
  veces_cotizado: number;
  primera_cotizacion: string;
  ultima_cotizacion: string;
}): RepuestoCatalogo {
  return {
    partNumber: fila.part_number,
    maker: fila.maker,
    nombre: fila.nombre,
    pesoKgProveedor: fila.peso_kg_proveedor === null ? null : Number(fila.peso_kg_proveedor),
    pesoKgManual: fila.peso_kg_manual === null ? null : Number(fila.peso_kg_manual),
    costoClp: fila.costo_clp === null ? null : Number(fila.costo_clp),
    vecesCotizado: fila.veces_cotizado,
    primeraCotizacion: fila.primera_cotizacion,
    ultimaCotizacion: fila.ultima_cotizacion,
  };
}

const LIMITE_BUSQUEDA = 200;
const LIMITE_RECIENTES = 50;

/**
 * Lista para /admin/repuestos — ya no trae la tabla entera (el catálogo
 * importado desde Excel tiene decenas de miles de filas, tirarlas todas
 * al navegador de una sola vez lo dejaría inutilizable). Con texto de
 * búsqueda o marca, busca en toda la tabla (tope LIMITE_BUSQUEDA). Sin
 * ningún filtro, muestra solo lo realmente cotizado por un cliente o
 * admin (veces_cotizado > 0), lo más reciente primero — el catálogo
 * importado (veces_cotizado = 0) no aparece hasta que se lo busque.
 */
export async function listarRepuestosCatalogo(filtros: {
  q?: string;
  marca?: string;
} = {}): Promise<{ repuestos: RepuestoCatalogo[]; marcas: string[]; truncado: boolean }> {
  const supabase = createAdminClient();
  const q = filtros.q?.trim() ?? "";
  const marca = filtros.marca?.trim() ?? "";
  const hayFiltro = q !== "" || marca !== "";

  let query = supabase.from("repuestos_catalogo").select("*");

  if (q) {
    const patron = `%${q.replace(/[%_]/g, "\\$&")}%`;
    query = query.or(`part_number.ilike.${patron},nombre.ilike.${patron}`);
  }
  if (marca) {
    query = marca === "Sin marca" ? query.is("maker", null) : query.eq("maker", marca);
  }

  if (hayFiltro) {
    query = query.order("part_number", { ascending: true }).limit(LIMITE_BUSQUEDA + 1);
  } else {
    query = query
      .gt("veces_cotizado", 0)
      .order("ultima_cotizacion", { ascending: false })
      .limit(LIMITE_RECIENTES);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const truncado = hayFiltro && (data ?? []).length > LIMITE_BUSQUEDA;
  const filas = truncado ? (data ?? []).slice(0, LIMITE_BUSQUEDA) : (data ?? []);

  // Marcas para los botones de filtro. PostgREST tiene un tope de 1000
  // filas por consulta (project-level, ignora .range()), así que traer
  // la columna "maker" entera para deduplicar en Node no sirve con 63k
  // filas — se agrupa server-side con una función SQL (ver migración
  // 0006_repuestos_catalogo_marcas_fn.sql).
  const { data: marcasData, error: marcasError } = await supabase.rpc(
    "repuestos_catalogo_marcas",
  );
  if (marcasError) throw new Error(marcasError.message);
  const marcas = (marcasData ?? []).map((fila: { marca: string }) => fila.marca);

  return { repuestos: filas.map(mapearFila), marcas, truncado };
}

/**
 * Guarda (o limpia, con null) el peso manual de un N° de parte. El
 * repuesto debe ya existir en el catálogo (se creó solo con la primera
 * cotización exitosa) — si no afectó ninguna fila, el N° de parte no
 * está catalogado todavía.
 */
export async function actualizarPesoManual(
  partNumber: string,
  pesoKgManual: number | null,
): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("repuestos_catalogo")
    .update({ peso_kg_manual: pesoKgManual, updated_at: new Date().toISOString() })
    .eq("part_number", partNumber)
    .select("part_number");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Ese N° de parte todavía no está en el catálogo");
  }
}
