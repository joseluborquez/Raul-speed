import { createAdminClient } from "./supabase/admin";
import type { EstadoSolicitud } from "./estadoGestion";

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
 * Anota en qué va la solicitud (buscando, cotizada, respondida…). Lo
 * escribe solo el admin desde el panel; el formulario público únicamente
 * inserta, así que nada más toca esta columna.
 */
export async function actualizarEstadoSolicitud(
  solicitudId: string,
  estado: EstadoSolicitud,
): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("solicitudes_parte")
    .update({ estado })
    .eq("id", solicitudId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Solicitud no encontrada");
}

/** Borra una solicitud del panel. Destructivo y sin papelera. */
export async function eliminarSolicitud(solicitudId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("solicitudes_parte")
    .delete()
    .eq("id", solicitudId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Solicitud no encontrada");
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
