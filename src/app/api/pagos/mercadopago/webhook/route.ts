import { NextResponse } from "next/server";
import { firmaWebhookValida, verificarPago } from "@/lib/pagos/mercadopago";
import {
  getPedido,
  marcarPedidoFallido,
  marcarPedidoPagado,
  marcarPedidoReembolsado,
} from "@/lib/pedidos";
import { obtenerIp, rateLimitExcedido } from "@/lib/rateLimit";

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

let avisoSecretoFaltante = false;

/**
 * MERCADOPAGO_WEBHOOK_SECRET es opcional: si no está configurado (no
 * existe todavía en .env.example, hay que generarlo en el panel de
 * Mercado Pago → Webhooks → Firma secreta), se deja pasar sin validar
 * — igual es seguro porque el estado real siempre se re-consulta contra
 * la API de Mercado Pago más abajo, esto es solo defensa en profundidad
 * contra spam que gaste esa llamada.
 */
function firmaOk(request: Request, paymentId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    if (!avisoSecretoFaltante) {
      console.warn(
        "MERCADOPAGO_WEBHOOK_SECRET no configurado: el webhook de Mercado Pago no valida firma.",
      );
      avisoSecretoFaltante = true;
    }
    return true;
  }

  return firmaWebhookValida({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId: paymentId,
    secret,
  });
}

/**
 * Webhook de Mercado Pago. Nunca se confía en el payload de la
 * notificación: solo se usa para saber qué payment id consultar, y el
 * estado real sale siempre de verificarPago() (Payment API).
 */
export async function POST(request: Request) {
  // Cada llamada golpea la Payment API de Mercado Pago — sin tope, un
  // flood de payment ids falsos agota la cuota igual que ya pasó con el
  // proveedor de precios (ver rateLimit.ts). El límite es generoso porque
  // acá también caen los reintentos legítimos de Mercado Pago.
  const ip = obtenerIp(request);
  if (rateLimitExcedido(`mp-webhook:${ip}`, 60, 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const paymentId = await extraerPaymentId(request);
  if (!paymentId) {
    return NextResponse.json({ ok: true });
  }

  if (!firmaOk(request, paymentId)) {
    console.error("Mercado Pago: firma de webhook inválida", { paymentId });
    return NextResponse.json({ ok: false }, { status: 401 });
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
    // Se responde con error (no 200) para que Mercado Pago SÍ reintente la
    // notificación: si la falla fue nuestra (ej. Supabase caído un
    // instante), dar el webhook por procesado dejaría el pedido pendiente
    // para siempre pese a que el cobro ya se hizo.
    console.error("Error procesando webhook de Mercado Pago:", exc);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  return POST(request);
}
