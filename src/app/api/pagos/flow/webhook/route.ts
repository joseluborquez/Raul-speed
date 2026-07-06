import { NextResponse } from "next/server";
import { FLOW_STATUS, verificarPago } from "@/lib/pagos/flow";
import { marcarPedidoFallido, marcarPedidoPagado } from "@/lib/pedidos";

/**
 * urlConfirmation de Flow: llega un POST con solo el token. Nunca se
 * confía en el payload — siempre se vuelve a consultar payment/getStatus.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const token = form?.get("token")?.toString();

  if (!token) {
    return NextResponse.json({ ok: true });
  }

  try {
    const data = await verificarPago(token);
    const pedidoId = data?.commerceOrder;

    if (pedidoId) {
      if (data.status === FLOW_STATUS.PAGADA) {
        await marcarPedidoPagado(pedidoId, data);
      } else if (data.status === FLOW_STATUS.RECHAZADA || data.status === FLOW_STATUS.ANULADA) {
        await marcarPedidoFallido(pedidoId, data);
      }
      // PENDIENTE: se deja el pedido pendiente, Flow reintentará la
      // confirmación cuando el estado cambie.
    }
  } catch {
    // Se responde 200 igual para que Flow no reintente en loop por una
    // falla nuestra transitoria.
  }

  return NextResponse.json({ ok: true });
}
