import { NextResponse } from "next/server";

/**
 * back_urls de Mercado Pago: por precaución se acepta GET y POST antes
 * de redirigir (303) a la página de confirmación real, que solo maneja
 * GET — mismo ajuste ya necesario con Webpay y Flow.
 */
async function manejarRetorno(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pedidoId = url.searchParams.get("pedido");
  const destino = pedidoId
    ? new URL(`/checkout/confirmacion?pedido=${pedidoId}`, url)
    : new URL("/", url);

  return NextResponse.redirect(destino, 303);
}

export const GET = manejarRetorno;
export const POST = manejarRetorno;
