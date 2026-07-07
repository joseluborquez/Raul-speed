import { NextResponse } from "next/server";
import { asignarMetodoPago, getPedido } from "@/lib/pedidos";
import { crearPago } from "@/lib/pagos/mercadopago";

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

    const { redirectUrl, proveedorRef } = await crearPago({
      pedidoId,
      totalClp: Number(pedido.total_clp),
      returnBaseUrl,
    });

    await asignarMetodoPago(pedidoId, "mercadopago", proveedorRef);

    return NextResponse.json({ redirectUrl });
  } catch (exc) {
    console.error("Error creando pago Mercado Pago:", exc);
    return NextResponse.json({ error: "No se pudo iniciar el pago" }, { status: 500 });
  }
}
