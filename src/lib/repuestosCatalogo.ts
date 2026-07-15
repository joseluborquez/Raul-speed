// Catálogo de repuestos ya cotizados (una fila por N° de parte), para que
// el admin pueda cargar el peso a mano cuando el proveedor no lo trae —
// ver 0004_repuestos_catalogo.sql para el porqué. El peso manual, una vez
// cargado, tiene prioridad sobre el del proveedor (ver getPesoManual(),
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

/**
 * Peso cargado a mano por el admin para este N° de parte, si existe.
 * Se llama desde cotizar() para que tenga prioridad sobre el del
 * proveedor.
 */
export async function getPesoManual(partNumber: string): Promise<number | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("repuestos_catalogo")
    .select("peso_kg_manual")
    .eq("part_number", partNumber)
    .maybeSingle();

  if (error || !data) return null;
  return data.peso_kg_manual === null ? null : Number(data.peso_kg_manual);
}

/**
 * Lista completa para /admin/repuestos — se agrupa por marca en el
 * cliente. Se llama solo desde una ruta ya protegida por sesión (ver
 * /api/admin/repuestos).
 */
export async function listarRepuestosCatalogo(): Promise<RepuestoCatalogo[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("repuestos_catalogo")
    .select("*")
    .order("maker", { ascending: true })
    .order("part_number", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((fila) => ({
    partNumber: fila.part_number,
    maker: fila.maker,
    nombre: fila.nombre,
    pesoKgProveedor: fila.peso_kg_proveedor === null ? null : Number(fila.peso_kg_proveedor),
    pesoKgManual: fila.peso_kg_manual === null ? null : Number(fila.peso_kg_manual),
    costoClp: fila.costo_clp === null ? null : Number(fila.costo_clp),
    vecesCotizado: fila.veces_cotizado,
    primeraCotizacion: fila.primera_cotizacion,
    ultimaCotizacion: fila.ultima_cotizacion,
  }));
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
