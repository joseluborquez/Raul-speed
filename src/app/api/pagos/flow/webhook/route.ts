import { NextResponse } from "next/server";
import { FLOW_STATUS, verificarPago } from "@/lib/pagos/flow";
import { getPedido, marcarPedidoFallido, marcarPedidoPagado } from "@/lib/pedidos";
import { obtenerIp, rateLimitExcedido } from "@/lib/rateLimit";

/**
 * urlConfirmation de Flow: llega un token (por POST habitualmente, pero
 * se acepta también por query string en GET para no repetir la sorpresa
 * que tuvimos con Webpay). Nunca se confía en el payload — siempre se
 * vuelve a consultar payment/getStatus.
 */
async function manejarWebhook(request: Request): Promise<Response> {
  // Cada llamada golpea payment/getStatus de Flow — sin tope, un flood de
  // tokens falsos agota la cuota igual que ya pasó con el proveedor de
  // precios (ver rateLimit.ts). El límite es generoso porque acá también
  // caen los reintentos legítimos de Flow.
  const ip = obtenerIp(request);
  if (rateLimitExcedido(`flow-webhook:${ip}`, 60, 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const url = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const token = form?.get("token")?.toString() ?? url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ ok: true });
  }

  try {
    const data = await verificarPago(token);
    const pedidoId = data?.commerceOrder;

    if (pedidoId) {
      if (data.status === FLOW_STATUS.PAGADA) {
        // El monto pagado en Flow debe coincidir con el total del pedido
        // antes de marcarlo como pagado.
        const pedido = await getPedido(pedidoId);
        const montoOk = !!pedido && Number(data.amount) === Number(pedido.total_clp);

        if (montoOk) {
          await marcarPedidoPagado(pedidoId, data);
        } else {
          console.error("Flow: monto pagado no coincide con el pedido", {
            pedidoId,
            montoPagado: data.amount,
            totalPedido: pedido?.total_clp,
          });
          await marcarPedidoFallido(pedidoId, { ...data, motivoInterno: "monto_no_coincide" });
        }
      } else if (data.status === FLOW_STATUS.RECHAZADA || data.status === FLOW_STATUS.ANULADA) {
        await marcarPedidoFallido(pedidoId, data);
      }
      // PENDIENTE: se deja el pedido pendiente, Flow reintentará la
      // confirmación cuando el estado cambie.
    }
  } catch (exc) {
    // Se responde con error (no 200) para que Flow SÍ reintente la
    // notificación: si la falla fue nuestra (ej. Supabase caído un
    // instante), dar el webhook por procesado dejaría el pedido pendiente
    // para siempre pese a que el cobro ya se hizo.
    console.error("Error procesando webhook de Flow:", exc);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export const GET = manejarWebhook;
export const POST = manejarWebhook;
