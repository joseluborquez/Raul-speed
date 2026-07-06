import { NextResponse } from "next/server";
import { asignarMetodoPago, getPedido } from "@/lib/pedidos";
import { crearPago } from "@/lib/pagos/webpay";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pedidoId = String(body?.pedidoId ?? "");
    if (!pedidoId) {
      return NextResponse.json({ error: "Falta pedidoId" }, { status: 400 });
    }

    const pedido = await getPedido(pedidoId);
    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (pedido.estado !== "pendiente") {
      return NextResponse.json({ error: "El pedido ya no está pendiente" }, { status: 409 });
    }

    const returnBaseUrl = new URL(request.url).origin;
    const { url, token } = await crearPago(pedidoId, Number(pedido.total_clp), returnBaseUrl);

    await asignarMetodoPago(pedidoId, "webpay", token);

    // Webpay no es un redirect simple: el frontend debe hacer un POST
    // autosubmit de `token` hacia `url`.
    return NextResponse.json({ url, token });
  } catch (exc) {
    return NextResponse.json(
      { error: exc instanceof Error ? exc.message : "No se pudo iniciar el pago" },
      { status: 500 },
    );
  }
}
