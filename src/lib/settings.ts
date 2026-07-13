import { createAdminClient } from "./supabase/admin";
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

  if (error || !data) {
    return {
      costoLogisticaClp: 0,
      tipoCambioManual: null,
    };
  }

  return {
    costoLogisticaClp: Number(data.costo_logistica_clp),
    tipoCambioManual:
      data.tipo_cambio_manual === null ? null : Number(data.tipo_cambio_manual),
  };
}

// Estas dos escrituras usan el cliente de service-role (no el de sesión del
// admin) porque /api/settings ya valida que quien llama sea admin vía
// esEmailAdmin() antes de invocarlas. Usar el cliente de sesión acá dependía
// además de la policy RLS "settings_admin_update" (email del JWT contra la
// tabla admin_emails): cuando ese chequeo no calzaba exactamente, el UPDATE
// no tocaba ninguna fila pero tampoco devolvía error, así que la app
// mostraba "Guardado" sin haber guardado nada. Por eso ahora se verifica
// que el UPDATE haya afectado la fila.

export async function updateCostoLogisticaClp(valor: number): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("settings")
    .update({ costo_logistica_clp: valor, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("No se encontró la configuración a actualizar");
}

export async function updateTipoCambioManual(valor: number | null): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("settings")
    .update({ tipo_cambio_manual: valor, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("No se encontró la configuración a actualizar");
}
