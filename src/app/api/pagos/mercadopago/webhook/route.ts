import { NextResponse } from "next/server";
import { verificarPago } from "@/lib/pagos/mercadopago";
import {
  getPedido,
  marcarPedidoFallido,
  marcarPedidoPagado,
  marcarPedidoReembolsado,
} from "@/lib/pedidos";

async function extraerPaymentId(request: Request): Promise<string | null> {
  const url = new URL(request.url);
  const queryId = url.searchParams.get("data.id") || url.searchParams.get("id");
  if (queryId) return queryId;

  try {
    const body = await request.json();
    return body?.data?.id ? String(body.data.id) : null;
  } catch {
    return null;
  }
}

/**
 * Webhook de Mercado Pago. Nunca se confía en el payload de la
 * notificación: solo se usa para saber qué payment id consultar, y el
 * estado real sale siempre de verificarPago() (Payment API).
 */
export async function POST(request: Request) {
  const paymentId = await extraerPaymentId(request);
  if (!paymentId) {
    return NextResponse.json({ ok: true });
  }

  try {
    const pago = await verificarPago(paymentId);
    const pedidoId = pago.external_reference;

    if (pedidoId) {
      if (pago.status === "approved") {
        // El monto aprobado por Mercado Pago debe coincidir con el total
        // del pedido antes de marcarlo como pagado.
        const pedido = await getPedido(pedidoId);
        const montoOk = !!pedido && Number(pago.transaction_amount) === Number(pedido.total_clp);

        if (montoOk) {
          await marcarPedidoPagado(pedidoId, pago);
        } else {
          console.error("Mercado Pago: monto aprobado no coincide con el pedido", {
            pedidoId,
            montoAprobado: pago.transaction_amount,
            totalPedido: pedido?.total_clp,
          });
          await marcarPedidoFallido(pedidoId, { ...pago, motivoInterno: "monto_no_coincide" });
        }
      } else if (pago.status === "rejected" || pago.status === "cancelled") {
        await marcarPedidoFallido(pedidoId, pago);
      } else if (pago.status === "refunded" || pago.status === "charged_back") {
        // Llega en un webhook posterior, cuando el pedido ya estaba "pagado".
        await marcarPedidoReembolsado(pedidoId, pago);
      }
      // "in_process" / "pending" / "authorized": se deja el pedido
      // pendiente; Mercado Pago reenvía el webhook cuando el estado cambie.
    }
  } catch (exc) {
    // Se responde 200 igual para que Mercado Pago no reintente en loop
    // por una falla nuestra transitoria.
    console.error("Error procesando webhook de Mercado Pago:", exc);
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  return POST(request);
}
