import { createClient } from "./supabase/server";

export interface Settings {
  costoLogisticaClp: number;
  /** Tasa JPY→CLP fijada por el admin. null = usar el Banco Central automáticamente. */
  tipoCambioManual: number | null;
}

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("costo_logistica_clp, tipo_cambio_manual")
    .eq("id", 1)
    .single();

  if (error || !data) return { costoLogisticaClp: 0, tipoCambioManual: null };

  return {
    costoLogisticaClp: Number(data.costo_logistica_clp),
    tipoCambioManual:
      data.tipo_cambio_manual === null ? null : Number(data.tipo_cambio_manual),
  };
}

export async function updateCostoLogisticaClp(valor: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ costo_logistica_clp: valor, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) throw new Error(error.message);
}

export async function updateTipoCambioManual(valor: number | null): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ tipo_cambio_manual: valor, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) throw new Error(error.message);
}
