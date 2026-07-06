import { NextResponse } from "next/server";
import { commitPago } from "@/lib/pagos/webpay";
import { getPedidoEstado, marcarPedidoFallido, marcarPedidoPagado } from "@/lib/pedidos";

/**
 * Transbank redirige al navegador con un POST a esta URL después del
 * pago (o del abandono). No hay webhook separado: commit() ES la
 * verificación. Si en vez de token_ws llega TBK_TOKEN, el usuario
 * abandonó el flujo antes de confirmar y no hay que llamar a commit().
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const pedidoId = url.searchParams.get("pedido");
  const destino = pedidoId
    ? new URL(`/checkout/confirmacion?pedido=${pedidoId}`, url)
    : new URL("/", url);

  if (!pedidoId) {
    return NextResponse.redirect(destino, 303);
  }

  const estadoActual = await getPedidoEstado(pedidoId);
  if (estadoActual && estadoActual !== "pendiente") {
    // Ya se resolvió antes (ej. el usuario recargó la página de retorno).
    return NextResponse.redirect(destino, 303);
  }

  const form = await request.formData().catch(() => null);
  const tokenWs = form?.get("token_ws")?.toString();
  const tbkToken = form?.get("TBK_TOKEN")?.toString();

  if (!tokenWs) {
    await marcarPedidoFallido(pedidoId, { abandonado: true, tbkToken: tbkToken ?? null });
    return NextResponse.redirect(destino, 303);
  }

  try {
    const resultado = await commitPago(tokenWs);
    const aprobado = resultado?.status === "AUTHORIZED" && resultado?.response_code === 0;

    if (aprobado) {
      await marcarPedidoPagado(pedidoId, resultado);
    } else {
      await marcarPedidoFallido(pedidoId, resultado);
    }
  } catch (exc) {
    await marcarPedidoFallido(pedidoId, {
      error: exc instanceof Error ? exc.message : String(exc),
    });
  }

  return NextResponse.redirect(destino, 303);
}
