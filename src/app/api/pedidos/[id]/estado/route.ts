import { NextResponse } from "next/server";
import { getPedidoEstado } from "@/lib/pedidos";

// Ruta pública a propósito: solo expone {estado}, nunca datos personales
// del pedido (RUT, dirección, teléfono viven en la tabla pero no se leen
// aquí). Se usa para el polling de la página de confirmación de pago.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const estado = await getPedidoEstado(id);
    if (estado === null) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ estado });
  } catch (exc) {
    return NextResponse.json(
      { error: exc instanceof Error ? exc.message : "No se pudo consultar el pedido" },
      { status: 500 },
    );
  }
}
