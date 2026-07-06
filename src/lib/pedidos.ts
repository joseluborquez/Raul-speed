import { createAdminClient } from "./supabase/admin";
import type { MetodoEnvio } from "./metodoEnvio";

export type { MetodoEnvio } from "./metodoEnvio";
export type MetodoPago = "mercadopago" | "webpay" | "flow";
export type EstadoPedido = "pendiente" | "pagado" | "fallido" | "expirado";

export interface ItemPedido {
  partNumber: string;
  maker?: string;
  nombre?: string;
  precioRepuestoClp: number;
}

export interface CrearPedidoInput {
  items: ItemPedido[];
  subtotalRepuestosClp: number;
  costoLogisticaClp: number;
  totalClp: number;
  nombreCompleto: string;
  rut: string;
  telefono: string;
  email: string;
  metodoEnvio: MetodoEnvio;
  envioDetalle?: string;
  region: string;
  ciudad: string;
  comuna: string;
  direccion: string;
}

/**
 * Crea un pedido en estado "pendiente". Se usa el cliente service-role
 * porque necesitamos leer de vuelta el id generado (INSERT ... RETURNING),
 * y la tabla no tiene policy pública de SELECT a propósito. La validación
 * real de los datos ocurre en la ruta de la API antes de llegar acá — la
 * policy de RLS de INSERT queda como defensa adicional solo para el caso
 * de que alguien llame a Supabase directo con la anon key, sin pasar por
 * nuestra API.
 */
export async function crearPedido(input: CrearPedidoInput): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("pedidos")
    .insert({
      items: input.items,
      subtotal_repuestos_clp: input.subtotalRepuestosClp,
      costo_logistica_clp: input.costoLogisticaClp,
      total_clp: input.totalClp,
      nombre_completo: input.nombreCompleto,
      rut: input.rut,
      telefono: input.telefono,
      email: input.email,
      metodo_envio: input.metodoEnvio,
      envio_detalle: input.envioDetalle ?? null,
      region: input.region,
      ciudad: input.ciudad,
      comuna: input.comuna,
      direccion: input.direccion,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "No se pudo crear el pedido");
  return data.id as string;
}

/**
 * Asigna el método de pago elegido y guarda la referencia del proveedor
 * (preference id / token) antes de redirigir al cliente. Usa el cliente
 * service-role porque no hay policy pública de UPDATE.
 */
export async function asignarMetodoPago(
  pedidoId: string,
  metodoPago: MetodoPago,
  proveedorRef: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("pedidos")
    .update({ metodo_pago: metodoPago, proveedor_ref: proveedorRef })
    .eq("id", pedidoId);

  if (error) throw new Error(error.message);
}

/**
 * Devuelve solo el estado del pedido (sin datos personales) — pensado
 * para la ruta pública de polling del checkout.
 */
export async function getPedidoEstado(pedidoId: string): Promise<EstadoPedido | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pedidos")
    .select("estado")
    .eq("id", pedidoId)
    .single();

  if (error || !data) return null;
  return data.estado as EstadoPedido;
}

/**
 * Devuelve el pedido completo (para armar el pago con el proveedor:
 * monto, referencia interna, etc). Server-only.
 */
export async function getPedido(pedidoId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pedidos")
    .select("*")
    .eq("id", pedidoId)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Marca un pedido como pagado. Idempotente: si ya estaba pagado, no hace
 * nada (el filtro por estado = 'pendiente' evita que una notificación
 * repetida del proveedor pise datos).
 */
export async function marcarPedidoPagado(
  pedidoId: string,
  rawProviderPayload: unknown,
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("pedidos")
    .update({
      estado: "pagado",
      paid_at: new Date().toISOString(),
      raw_provider_payload: rawProviderPayload,
    })
    .eq("id", pedidoId)
    .eq("estado", "pendiente");
}

export async function marcarPedidoFallido(
  pedidoId: string,
  rawProviderPayload: unknown,
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("pedidos")
    .update({ estado: "fallido", raw_provider_payload: rawProviderPayload })
    .eq("id", pedidoId)
    .eq("estado", "pendiente");
}

/**
 * Lista los pedidos más recientes para el panel admin. Se llama solo
 * desde una ruta ya protegida por sesión (ver /api/admin/pedidos).
 */
export async function listarPedidos() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pedidos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return data;
}
