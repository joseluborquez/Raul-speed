// Carga (cacheada, fail-open) y escritura admin de la configuración
// editable del filtro de envío — ver supabase/migrations/0011_filtro_envio_editable.sql
// y CONFIG_DEFAULT/LISTAS_DEFAULT en sobrecargoEnvio.ts (que siguen siendo
// el valor de respaldo si Supabase falla o si el caller no pasa nada).
//
// Mismo espíritu que settings.ts: lecturas con el cliente de sesión (RLS
// pública), escrituras con el cliente service-role (la API ya validó
// admin con esEmailAdmin() antes de llamar). A diferencia de settings.ts,
// acá se agrega un caché en memoria de 60s (mismo patrón best-effort que
// rateLimit.ts) porque clasificarEnvio() se llama por cada cotización —
// sin caché, cada búsqueda le pegaría dos veces a Supabase antes de
// siquiera consultar al proveedor de precios.

import {
  CONFIG_DEFAULT,
  esCategoriaValida,
  LISTAS_DEFAULT,
  normalizar,
  RE_JAPONES,
  type CategoriaFiltro,
  type ConfigFiltroEnvio,
  type ListasFiltroEnvio,
  type TerminoFiltro,
} from "./sobrecargoEnvio";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

export interface FiltroEnvioData {
  config: ConfigFiltroEnvio;
  listas: ListasFiltroEnvio;
}

const TTL_MS = 60_000;
let cache: { data: FiltroEnvioData; loadedAt: number } | null = null;

/**
 * Lee config + listas vigentes desde Supabase, cacheado 60s en memoria
 * (best-effort por instancia, como LIMITE_LLAMADAS_POR_MINUTO en
 * rateLimit.ts). Fail-open: cualquier error de Supabase, o si las tablas
 * están vacías, devuelve los defaults hardcodeados sin lanzar — nunca
 * debe romper una cotización. No cachea el fallo, así que el próximo
 * llamado reintenta contra Supabase.
 */
export async function cargarFiltroEnvio(): Promise<FiltroEnvioData> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache.data;

  try {
    const supabase = await createClient();
    const [configRes, terminosRes] = await Promise.all([
      supabase
        .from("filtro_envio_config")
        .select(
          "peso_incluido_kg, cobro_kilo_extra_clp, peso_maximo_kg, precio_seguro_sin_peso_clp, exencion_voluminosas_kg, precio_minimo_voluminosa_clp",
        )
        .eq("id", 1)
        .single(),
      supabase.from("filtro_envio_terminos").select("categoria, termino"),
    ]);

    if (configRes.error || !configRes.data || terminosRes.error || !terminosRes.data) {
      return { config: CONFIG_DEFAULT, listas: LISTAS_DEFAULT };
    }

    const config: ConfigFiltroEnvio = {
      pesoIncluidoKg: Number(configRes.data.peso_incluido_kg),
      cobroKiloExtraClp: Number(configRes.data.cobro_kilo_extra_clp),
      pesoMaximoKg: Number(configRes.data.peso_maximo_kg),
      precioSeguroSinPesoClp: Number(configRes.data.precio_seguro_sin_peso_clp),
      exencionVoluminosasKg: Number(configRes.data.exencion_voluminosas_kg),
      precioMinimoVoluminosaClp: Number(configRes.data.precio_minimo_voluminosa_clp),
    };

    const listas: ListasFiltroEnvio = {
      voluminosas: [],
      pesadas: [],
      precision: [],
      exclusiones: [],
      subpiezas: [],
    };
    for (const fila of terminosRes.data) {
      if (esCategoriaValida(fila.categoria)) {
        listas[fila.categoria].push(fila.termino);
      }
    }
    // Tabla vacía (ej. recién creada, antes del seed) es tan inválido como
    // un error — sin términos, todo pasaría "estándar" por defecto.
    const listasVacias = Object.values(listas).every((l) => l.length === 0);
    if (listasVacias) {
      return { config, listas: LISTAS_DEFAULT };
    }

    const data = { config, listas };
    cache = { data, loadedAt: Date.now() };
    return data;
  } catch {
    return { config: CONFIG_DEFAULT, listas: LISTAS_DEFAULT };
  }
}

/**
 * Vista para el panel admin: términos CON id (para poder borrarlos) y
 * config sin caché (el admin quiere ver el valor real vigente, no uno
 * de hasta 60s de antigüedad). A diferencia de cargarFiltroEnvio(), si
 * Supabase falla acá se propaga el error — el panel debe mostrarlo, no
 * disimularlo con los defaults.
 */
export async function listarFiltroEnvioAdmin(): Promise<{
  config: ConfigFiltroEnvio;
  listas: Record<CategoriaFiltro, TerminoFiltro[]>;
}> {
  const supabase = await createClient();
  const [configRes, terminosRes] = await Promise.all([
    supabase
      .from("filtro_envio_config")
      .select(
        "peso_incluido_kg, cobro_kilo_extra_clp, peso_maximo_kg, precio_seguro_sin_peso_clp, exencion_voluminosas_kg, precio_minimo_voluminosa_clp",
      )
      .eq("id", 1)
      .single(),
    supabase
      .from("filtro_envio_terminos")
      .select("id, categoria, termino")
      .order("termino", { ascending: true }),
  ]);

  if (configRes.error || !configRes.data) {
    throw new Error(configRes.error?.message ?? "No se encontró la configuración del filtro");
  }
  if (terminosRes.error || !terminosRes.data) {
    throw new Error(terminosRes.error?.message ?? "No se pudieron leer los términos del filtro");
  }

  const config: ConfigFiltroEnvio = {
    pesoIncluidoKg: Number(configRes.data.peso_incluido_kg),
    cobroKiloExtraClp: Number(configRes.data.cobro_kilo_extra_clp),
    pesoMaximoKg: Number(configRes.data.peso_maximo_kg),
    precioSeguroSinPesoClp: Number(configRes.data.precio_seguro_sin_peso_clp),
    exencionVoluminosasKg: Number(configRes.data.exencion_voluminosas_kg),
    precioMinimoVoluminosaClp: Number(configRes.data.precio_minimo_voluminosa_clp),
  };

  const listas: Record<CategoriaFiltro, TerminoFiltro[]> = {
    voluminosas: [],
    pesadas: [],
    precision: [],
    exclusiones: [],
    subpiezas: [],
  };
  for (const fila of terminosRes.data) {
    if (esCategoriaValida(fila.categoria)) {
      listas[fila.categoria].push({ id: fila.id, termino: fila.termino });
    }
  }

  return { config, listas };
}

/** Normaliza un término antes de guardarlo, con la MISMA transformación
 * que reciben los nombres en normalizar() (sobrecargoEnvio.ts) — si el
 * término guardado no coincide con esa forma, jamás calzará:
 * - NFKC primero: convierte katakana half-width (ｶｳﾙ, como a veces lo
 *   pega el admin desde Yumbo) a full-width, que es lo que RE_JAPONES
 *   detecta y lo que producen los nombres normalizados.
 * - Japonés: se conserva la forma legible (kana chica y ー intactos — la
 *   limpieza fina la hace normalizarTermino() al comparar), pero la
 *   puntuación se vuelve espacio igual que en los nombres: un término
 *   pegado con coma ("...ユニツト,FI") jamás calzaría por substring.
 * - EN/ES: mayúsculas, tildes/Ñ fuera (un "PUÑO" con Ñ nunca calzaría
 *   contra el nombre normalizado "PUNO"), guiones y espacios dobles. */
function normalizarParaGuardar(termino: string): string {
  const t = termino.trim().normalize("NFKC");
  if (RE_JAPONES.test(t)) {
    return t.replace(/[,·、，．./]/g, " ").replace(/\s+/g, " ").trim();
  }
  return normalizar(t);
}

export async function agregarTermino(categoria: CategoriaFiltro, termino: string): Promise<void> {
  const valor = normalizarParaGuardar(termino);
  if (!valor) throw new Error("El término no puede estar vacío");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("filtro_envio_terminos")
    .insert({ categoria, termino: valor });

  if (error) {
    if (error.code === "23505") throw new Error("Ese término ya existe en esta categoría");
    throw new Error(error.message);
  }
  cache = null;
}

export async function eliminarTermino(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("filtro_envio_terminos")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("No se encontró el término a eliminar");
  cache = null;
}

const CAMPOS_CONFIG = {
  pesoIncluidoKg: "peso_incluido_kg",
  cobroKiloExtraClp: "cobro_kilo_extra_clp",
  pesoMaximoKg: "peso_maximo_kg",
  precioSeguroSinPesoClp: "precio_seguro_sin_peso_clp",
  exencionVoluminosasKg: "exencion_voluminosas_kg",
  precioMinimoVoluminosaClp: "precio_minimo_voluminosa_clp",
} as const satisfies Record<keyof ConfigFiltroEnvio, string>;

export async function actualizarConfigFiltroEnvio(
  cambios: Partial<ConfigFiltroEnvio>,
): Promise<void> {
  const update: Record<string, number> = {};
  for (const [campo, columna] of Object.entries(CAMPOS_CONFIG)) {
    const valor = cambios[campo as keyof ConfigFiltroEnvio];
    if (valor !== undefined) update[columna] = valor;
  }
  if (Object.keys(update).length === 0) return;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("filtro_envio_config")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("No se encontró la configuración a actualizar");
  cache = null;
}
