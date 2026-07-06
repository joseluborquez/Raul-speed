import { createClient } from "./supabase/server";

/**
 * Costo de logística (CLP), configurable por el admin, se suma al
 * precio de cada repuesto cotizado.
 */
export async function getCostoLogisticaClp(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("costo_logistica_clp")
    .eq("id", 1)
    .single();

  if (error || !data) return 0;
  return Number(data.costo_logistica_clp);
}

export async function updateCostoLogisticaClp(valor: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ costo_logistica_clp: valor, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) throw new Error(error.message);
}
