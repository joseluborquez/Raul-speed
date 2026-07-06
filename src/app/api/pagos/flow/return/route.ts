import { NextResponse } from "next/server";

/**
 * urlReturn de Flow: el navegador vuelve acá después del pago, y Flow
 * redirige con POST (no con GET), lo que rompería contra la página de
 * confirmación directamente (solo acepta GET). Esta ruta solo redirige
 * (303, cambia el método a GET) a la página real — la confirmación del
 * pago en sí ya se resolvió (o se está resolviendo) vía urlConfirmation.
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
