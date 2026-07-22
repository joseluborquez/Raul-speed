// Filtro adicional por prefijo de código OEM — reduce cotizaciones que
// caen a WhatsApp sin necesidad (ver supabase/migrations/0015_prefijos_livianos.sql
// para el contexto completo y el origen de los datos). Es una fuente de
// peso de RESPALDO: solo la consulta conFiltroPrefijo() en cotizar.ts, y
// solo cuando clasificarEnvio() ya dio "alerta_whatsapp" con el peso
// normal — nunca cambia una cotización que ya pasaba.

import { createAdminClient } from "./supabase/admin";

const MARCAS_SOPORTADAS = ["HONDA", "SUZUKI", "YAMAHA", "KAWASAKI"] as const;
type MarcaSoportada = (typeof MARCAS_SOPORTADAS)[number];

/**
 * Confianza mínima activa en el lookup: partir conservador (ALTA = 10+
 * piezas de referencia, MEDIA = 5-9). Sumar "MINIMA" acá cuando el filtro
 * se valide en producción — no requiere tocar la tabla ni el resto del
 * código.
 */
const CONFIANZAS_ACTIVAS = ["ALTA", "MEDIA"];

/** El proveedor/catálogo trae "HONDA MOTO", "SUZUKI MOTO", etc. (ver
 * distribución real en repuestos_catalogo) — nunca el nombre corto exacto
 * de la tabla de prefijos. Substring, no igualdad. */
function marcaSoportada(makerRaw: string | null | undefined): MarcaSoportada | null {
  const m = (makerRaw ?? "").toUpperCase();
  return MARCAS_SOPORTADAS.find((marca) => m.includes(marca)) ?? null;
}

export interface PrefijoExtraido {
  marca: MarcaSoportada;
  prefijo: string;
}

/**
 * Extrae marca+prefijo de un código OEM completo, según las reglas reales
 * de cada fabricante (ver Prefijos_Livianos_Filtro_Adicional.csv):
 * - Honda/Suzuki/Kawasaki: los primeros 5 caracteres del código (el
 *   bloque antes del primer guión, que siempre mide 5 en estas marcas).
 * - Yamaha: dos formatos. Si el código empieza con 5 dígitos (formato
 *   estándar, ej. "90109-06013-00") el prefijo son esos 5 dígitos. Si
 *   empieza con un bloque corto no numérico de modelo (ej.
 *   "20S-26335-02-00") el prefijo es el bloque de 5 dígitos que sigue
 *   ("26335"), que es el que identifica el tipo de pieza — el bloque de
 *   modelo no sirve para esto.
 *
 * Detecta el formato por posición de caracteres, no por separador: da lo
 * mismo si el cliente escribe el código con o sin guiones.
 */
export function extraerPrefijoLiviano(
  partNumberInput: string,
  makerRaw: string | null | undefined,
): PrefijoExtraido | null {
  const marca = marcaSoportada(makerRaw);
  if (!marca) return null;

  const codigo = partNumberInput.trim().toUpperCase().replace(/[\s-]/g, "");
  if (codigo.length === 0) return null;

  if (marca === "YAMAHA") {
    if (/^\d{5}/.test(codigo)) return { marca, prefijo: codigo.slice(0, 5) };
    const segundoBloque = codigo.slice(3, 8);
    if (/^\d{5}$/.test(segundoBloque)) return { marca, prefijo: segundoBloque };
    return null;
  }

  if (codigo.length < 5) return null;
  return { marca, prefijo: codigo.slice(0, 5) };
}

export interface PesoPrefijo {
  marca: MarcaSoportada;
  prefijo: string;
  pesoKg: number;
  categoria: string | null;
  confianza: string;
}

/**
 * Busca el peso p95 (conservador — ninguna familia pasa de 0,35 kg) para
 * la familia marca+prefijo del código, si existe con confianza
 * suficiente. null si el código no calza con ningún formato conocido, la
 * familia no está en la tabla, o solo tiene confianza MINIMA.
 */
export async function buscarPesoPorPrefijo(
  partNumber: string,
  makerRaw: string | null | undefined,
): Promise<PesoPrefijo | null> {
  const extraido = extraerPrefijoLiviano(partNumber, makerRaw);
  if (!extraido) return null;

  const supabase = createAdminClient();
  // ilike sin comodines se compara case-insensitive: la tabla guarda la
  // marca tal cual el CSV original ("Honda"), acá se llega en mayúsculas.
  const { data, error } = await supabase
    .from("prefijos_livianos")
    .select("peso_p95_kg, categoria_dominante, confianza")
    .ilike("marca", extraido.marca)
    .eq("prefijo", extraido.prefijo)
    .in("confianza", CONFIANZAS_ACTIVAS)
    .maybeSingle();

  if (error || !data) return null;

  return {
    marca: extraido.marca,
    prefijo: extraido.prefijo,
    pesoKg: Number(data.peso_p95_kg),
    categoria: data.categoria_dominante,
    confianza: data.confianza,
  };
}

/**
 * Log de auditoría: una fila cada vez que este filtro efectivamente
 * rescata una cotización de "alerta_whatsapp" (ver prefijos_livianos_uso
 * en la migración). Permite responder después "cuántas se generan, de
 * qué familias, y si algún envío real contradice el peso asumido". Quien
 * llama debe tratarlo como best-effort (no debe romper la cotización si
 * falla) — ver conFiltroPrefijo() en cotizar.ts.
 */
export async function registrarUsoPrefijo(input: {
  partNumber: string;
  marca: string;
  prefijo: string;
  categoriaDominante: string | null;
  confianza: string;
  pesoAsignadoKg: number;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("prefijos_livianos_uso").insert({
    part_number: input.partNumber,
    marca: input.marca,
    prefijo: input.prefijo,
    categoria_dominante: input.categoriaDominante,
    confianza: input.confianza,
    peso_asignado_kg: input.pesoAsignadoKg,
  });
  if (error) throw new Error(error.message);
}
