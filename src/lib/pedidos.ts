import { createAdminClient } from "./supabase/admin";
import type { MetodoEnvio } from "./metodoEnvio";

export type { MetodoEnvio } from "./metodoEnvio";
export type MetodoPago = "mercadopago" | "webpay" | "flow";
export type EstadoPedido = "pendiente" | "pagado" | "fallido" | "expirado" | "reembolsado";

/**
 * Un pedido "pendiente" más viejo que esto se trata como expirado la
 * próxima vez que se lee (polling del checkout o intento de iniciar un
 * pago): el tipo de cambio/precio que congeló ya no es confiable, y sin
 * esto un pedido de hace semanas se podía pagar igual al precio viejo.
 * No hay cron: la expiración es perezosa, en lectura.
 */
const HORAS_EXPIRACION_PEDIDO = 24;

function haExpirado(createdAt: string): boolean {
  const limite = Date.now() - HORAS_EXPIRACION_PEDIDO * 60 * 60 * 1000;
  return new Date(createdAt).getTime() < limite;
}

export interface ItemPedido {
  partNumber: string;
  maker?: string;
  nombre?: string;
  precioRepuestoClp: number;
  /** 0 = sin dato. */
  pesoKg?: number;
  cantidad: number;
}

export interface CrearPedidoInput {
  items: ItemPedido[];
  subtotalRepuestosClp: number;
  /** Sobrecargo por envío calculado sobre el peso acumulado del pedido. */
  sobrecargoPesoClp: number;
  pesoTotalKg: number;
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
 * y la tabla tiene RLS activado sin ninguna policy a propósito: con la
 * anon key no se puede leer NI insertar nada en pedidos — la única puerta
 * de entrada es esta API, que ya validó los datos antes de llegar acá.
 */
export async function crearPedido(input: CrearPedidoInput): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("pedidos")
    .insert({
      items: input.items,
      subtotal_repuestos_clp: input.subtotalRepuestosClp,
      sobrecargo_peso_clp: input.sobrecargoPesoClp,
      peso_total_kg: input.pesoTotalKg,
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
 * Marca un pedido pendiente y vencido como expirado. Idempotente por el
 * filtro de estado, igual que el resto de las transiciones.
 */
export async function marcarPedidoExpirado(pedidoId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("pedidos")
    .update({ estado: "expirado" })
    .eq("id", pedidoId)
    .eq("estado", "pendiente");

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
    .select("estado, created_at")
    .eq("id", pedidoId)
    .single();

  if (error || !data) return null;

  if (data.estado === "pendiente" && haExpirado(data.created_at)) {
    await marcarPedidoExpirado(pedidoId);
    return "expirado";
  }

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

  if (data.estado === "pendiente" && haExpirado(data.created_at)) {
    await marcarPedidoExpirado(pedidoId);
    data.estado = "expirado";
  }

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
  const { data, error } = await supabase
    .from("pedidos")
    .update({
      estado: "pagado",
      paid_at: new Date().toISOString(),
      raw_provider_payload: rawProviderPayload,
    })
    .eq("id", pedidoId)
    .eq("estado", "pendiente")
    .select("id");

  // Si esto falla (ej. Supabase caído un instante) no puede quedar en
  // silencio: el pedido seguiría "pendiente" con la plata ya cobrada. El
  // caller debe enterarse para que el webhook responda con error y el
  // proveedor reintente la notificación más tarde.
  if (error) throw new Error(error.message);

  // 0 filas afectadas = el pedido ya no estaba "pendiente" (pagado,
  // fallido, expirado...). Un cobro aprobado por el proveedor que no se
  // puede registrar es plata real que no quedó reflejada en ningún lado
  // — ej. el cliente pagó en dos pasarelas a la vez. No hay dónde
  // alertar automáticamente todavía, así que queda como warning visible
  // en los logs para revisión manual en vez de perderse en silencio.
  if (!data || data.length === 0) {
    console.warn(
      "marcarPedidoPagado: el pedido ya no estaba pendiente — posible doble pago o notificación tardía",
      { pedidoId },
    );
  }
}

export async function marcarPedidoFallido(
  pedidoId: string,
  rawProviderPayload: unknown,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("pedidos")
    .update({ estado: "fallido", raw_provider_payload: rawProviderPayload })
    .eq("id", pedidoId)
    .eq("estado", "pendiente");

  if (error) throw new Error(error.message);
}

/**
 * Marca un pedido ya pagado como reembolsado o contracargado. A
 * diferencia de marcarPedidoFallido, el filtro exige que el pedido esté
 * en "pagado" — un reembolso solo tiene sentido después de un cobro
 * exitoso, y así se evita pisar un pedido que nunca llegó a pagarse.
 */
export async function marcarPedidoReembolsado(
  pedidoId: string,
  rawProviderPayload: unknown,
): Promise<void> {
  const supabase = createAdminClient();

  // El payload del reembolso se guarda junto al del pago original, no
  // pisándolo — perder el payload del pago original hace más difícil
  // reconciliar manualmente si el proveedor y nuestros datos no calzan.
  const { data: actual } = await supabase
    .from("pedidos")
    .select("raw_provider_payload")
    .eq("id", pedidoId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("pedidos")
    .update({
      estado: "reembolsado",
      raw_provider_payload: {
        pago_original: actual?.raw_provider_payload ?? null,
        reembolso: rawProviderPayload,
      },
    })
    .eq("id", pedidoId)
    .eq("estado", "pagado")
    .select("id");

  if (error) throw new Error(error.message);

  if (!data || data.length === 0) {
    console.warn(
      "marcarPedidoReembolsado: el pedido ya no estaba pagado — no se pudo registrar el reembolso",
      { pedidoId },
    );
  }
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
