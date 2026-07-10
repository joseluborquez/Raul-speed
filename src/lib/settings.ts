import { createClient } from "./supabase/server";

export interface Settings {
  costoLogisticaClp: number;
  /** Tasa JPY→CLP fijada por el admin. null = usar el Banco Central automáticamente. */
  tipoCambioManual: number | null;
  /**
   * Descuento (%) aplicado al costo de envío DHL antes de cobrarlo como
   * sobrecargo por volumen en piezas sin peso/tamaño estándar en Yumbo.
   * Ej: 50 = se cobra la mitad del flete DHL real.
   */
  descuentoSobrecargoDhlPct: number;
}

const DESCUENTO_SOBRECARGO_DHL_PCT_DEFAULT = 50;

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("costo_logistica_clp, tipo_cambio_manual, descuento_sobrecargo_dhl_pct")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return {
      costoLogisticaClp: 0,
      tipoCambioManual: null,
      descuentoSobrecargoDhlPct: DESCUENTO_SOBRECARGO_DHL_PCT_DEFAULT,
    };
  }

  return {
    costoLogisticaClp: Number(data.costo_logistica_clp),
    tipoCambioManual:
      data.tipo_cambio_manual === null ? null : Number(data.tipo_cambio_manual),
    descuentoSobrecargoDhlPct:
      data.descuento_sobrecargo_dhl_pct === null
        ? DESCUENTO_SOBRECARGO_DHL_PCT_DEFAULT
        : Number(data.descuento_sobrecargo_dhl_pct),
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

export async function updateDescuentoSobrecargoDhlPct(valor: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ descuento_sobrecargo_dhl_pct: valor, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) throw new Error(error.message);
}
