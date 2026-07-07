import { NextResponse } from "next/server";
import { FLOW_STATUS, verificarPago } from "@/lib/pagos/flow";
import { getPedido, marcarPedidoFallido, marcarPedidoPagado } from "@/lib/pedidos";

/**
 * urlConfirmation de Flow: llega un token (por POST habitualmente, pero
 * se acepta también por query string en GET para no repetir la sorpresa
 * que tuvimos con Webpay). Nunca se confía en el payload — siempre se
 * vuelve a consultar payment/getStatus.
 */
async function manejarWebhook(request: Request): Promise<Response> {
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
    // Se responde 200 igual para que Flow no reintente en loop por una
    // falla nuestra transitoria.
    console.error("Error procesando webhook de Flow:", exc);
  }

  return NextResponse.json({ ok: true });
}

export const GET = manejarWebhook;
export const POST = manejarWebhook;
