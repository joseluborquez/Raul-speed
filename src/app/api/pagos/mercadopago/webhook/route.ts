import { NextResponse } from "next/server";
import { verificarPago } from "@/lib/pagos/mercadopago";
import { marcarPedidoFallido, marcarPedidoPagado } from "@/lib/pedidos";

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
        await marcarPedidoPagado(pedidoId, pago);
      } else if (pago.status === "rejected" || pago.status === "cancelled") {
        await marcarPedidoFallido(pedidoId, pago);
      }
      // "in_process" / "pending": se deja el pedido pendiente; Mercado
      // Pago reenvía el webhook cuando el estado cambie.
    }
  } catch {
    // Se responde 200 igual para que Mercado Pago no reintente en loop
    // por una falla nuestra transitoria.
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  return POST(request);
}
