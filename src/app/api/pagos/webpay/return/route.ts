import { NextResponse } from "next/server";
import { commitPago } from "@/lib/pagos/webpay";
import { getPedido, getPedidoEstado, marcarPedidoFallido, marcarPedidoPagado } from "@/lib/pedidos";
import { obtenerIp, rateLimitExcedido } from "@/lib/rateLimit";

/**
 * Transbank redirige al navegador a esta URL después del pago (o del
 * abandono) — en la práctica lo hace con GET y token_ws como parámetro
 * de la URL, aunque la documentación clásica describe un POST con
 * form data; se acepta cualquiera de los dos. No hay webhook separado:
 * commit() ES la verificación. Si en vez de token_ws llega TBK_TOKEN,
 * el usuario abandonó el flujo antes de confirmar y no hay que llamar
 * a commit().
 */
async function manejarRetorno(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pedidoId = url.searchParams.get("pedido");
  const destino = pedidoId
    ? new URL(`/checkout/confirmacion?pedido=${pedidoId}`, url)
    : new URL("/", url);

  if (!pedidoId) {
    return NextResponse.redirect(destino, 303);
  }

  // Cada llamada golpea commit() de Transbank — sin tope, un flood de
  // tokens falsos agota la cuota igual que ya pasó con el proveedor de
  // precios (ver rateLimit.ts). Se redirige en vez de responder un error
  // crudo porque esto lo pega el navegador del cliente, no el proveedor.
  const ip = obtenerIp(request);
  if (rateLimitExcedido(`webpay-return:${ip}`, 60, 60_000)) {
    return NextResponse.redirect(destino, 303);
  }

  const estadoActual = await getPedidoEstado(pedidoId);
  if (estadoActual && estadoActual !== "pendiente") {
    // Ya se resolvió antes (ej. el usuario recargó la página de retorno).
    return NextResponse.redirect(destino, 303);
  }

  const form = await request.formData().catch(() => null);
  const tokenWs = form?.get("token_ws")?.toString() ?? url.searchParams.get("token_ws");
  const tbkToken = form?.get("TBK_TOKEN")?.toString() ?? url.searchParams.get("TBK_TOKEN");

  if (!tokenWs) {
    // Solo Transbank manda TBK_TOKEN como señal real de abandono. Si no
    // viene ninguno de los dos, esta URL se visitó sin pasar por
    // Transbank (el pedidoId viaja en la query string y cualquiera puede
    // adivinarla o reusarla) — no hay que mutar el pedido solo por eso,
    // simplemente se redirige y se deja como estaba.
    if (!tbkToken) {
      return NextResponse.redirect(destino, 303);
    }

    // A diferencia de un webhook, acá no hay reintento del proveedor que
    // aproveche un error: si esto falla, se loguea y se redirige igual
    // (el pedido queda en el estado que ya tenía, ej. "pendiente").
    try {
      await marcarPedidoFallido(pedidoId, { abandonado: true, tbkToken });
    } catch (exc) {
      console.error("Error marcando pedido Webpay como abandonado:", exc);
    }
    return NextResponse.redirect(destino, 303);
  }

  try {
    const resultado = await commitPago(tokenWs);
    const aprobado = resultado?.status === "AUTHORIZED" && resultado?.response_code === 0;

    if (aprobado) {
      // El monto autorizado por Transbank debe coincidir con el total del
      // pedido — si no, alguien manipuló el pedido antes de llegar acá
      // (o hay una inconsistencia) y no se marca como pagado.
      const pedido = await getPedido(pedidoId);
      const montoOk = !!pedido && Number(resultado.amount) === Number(pedido.total_clp);

      if (montoOk) {
        await marcarPedidoPagado(pedidoId, resultado);
      } else {
        console.error("Webpay: monto autorizado no coincide con el pedido", {
          pedidoId,
          montoAutorizado: resultado.amount,
          totalPedido: pedido?.total_clp,
        });
        await marcarPedidoFallido(pedidoId, { ...resultado, motivoInterno: "monto_no_coincide" });
      }
    } else {
      await marcarPedidoFallido(pedidoId, resultado);
    }
  } catch (exc) {
    console.error("Error confirmando pago Webpay:", exc);
    // marcarPedidoFallido también puede fallar acá (ej. mismo incidente de
    // Supabase que causó el error original) — no puede tumbar el redirect.
    try {
      await marcarPedidoFallido(pedidoId, {
        error: exc instanceof Error ? exc.message : String(exc),
      });
    } catch (excInterno) {
      console.error("Error marcando pedido Webpay como fallido:", excInterno);
    }
  }

  return NextResponse.redirect(destino, 303);
}

export const GET = manejarRetorno;
export const POST = manejarRetorno;
