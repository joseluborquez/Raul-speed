import { createAdminClient } from "./supabase/admin";

export interface CrearSolicitudInput {
  nombreApellido: string;
  contacto: string;
  moto: string;
  chasisVinPatente: string;
  descripcionRepuesto: string;
}

/**
 * Guarda una solicitud de "no sé mi número de parte" (cliente deja los
 * datos de su moto para que el admin la busque manualmente). Usa el
 * cliente service-role por el mismo motivo que crearPedido: hay que leer
 * de vuelta el id generado y no hay policy pública de SELECT.
 */
export async function crearSolicitud(input: CrearSolicitudInput): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("solicitudes_parte")
    .insert({
      nombre_apellido: input.nombreApellido,
      descripcion_repuesto: input.descripcionRepuesto,
      contacto: input.contacto,
      moto: input.moto,
      chasis_vin_patente: input.chasisVinPatente,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "No se pudo enviar la solicitud");
  return data.id as string;
}

/**
 * Lista las solicitudes más recientes para el panel admin. Se llama solo
 * desde una ruta ya protegida por sesión (ver /api/admin/solicitudes).
 */
export async function listarSolicitudes() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("solicitudes_parte")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return data;
}
