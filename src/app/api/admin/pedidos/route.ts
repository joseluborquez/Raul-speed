import { NextResponse } from "next/server";
import { esEmailAdmin } from "@/lib/adminAuth";
import { esEstadoGestion } from "@/lib/estadoGestion";
import { actualizarEstadoGestion, eliminarPedido, getPedido, listarPedidos } from "@/lib/pedidos";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return esEmailAdmin(user?.email);
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const pedidos = await listarPedidos();
    return NextResponse.json({ pedidos });
  } catch (exc) {
    console.error("Error listando pedidos:", exc);
    return NextResponse.json({ error: "No se pudo obtener los pedidos" }, { status: 500 });
  }
}

/** Cambia solo el seguimiento manual — el estado de pago no se toca acá. */
export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "Falta el id del pedido" }, { status: 400 });
  }
  if (!esEstadoGestion(body?.estadoGestion)) {
    return NextResponse.json({ error: "Estado de gestión inválido" }, { status: 400 });
  }

  try {
    await actualizarEstadoGestion(id, body.estadoGestion);
    return NextResponse.json({ ok: true });
  } catch (exc) {
    console.error("Error actualizando el estado de gestión:", exc);
    return NextResponse.json({ error: "No se pudo guardar el estado" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "Falta el id del pedido" }, { status: 400 });
  }

  try {
    // Un pedido pagado o reembolsado es el único registro propio de un
    // movimiento de plata real (incluye el payload del proveedor). Se
    // puede borrar, pero nunca por un clic suelto: el panel tiene que
    // mandar confirmar:true después de avisarle al admin qué pierde.
    const pedido = await getPedido(id);
    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (
      (pedido.estado === "pagado" || pedido.estado === "reembolsado") &&
      body?.confirmar !== true
    ) {
      return NextResponse.json(
        {
          error:
            "Este pedido tiene un pago registrado. Confirma el borrado para eliminarlo igualmente.",
          requiereConfirmacion: true,
        },
        { status: 409 },
      );
    }

    await eliminarPedido(id);
    return NextResponse.json({ ok: true });
  } catch (exc) {
    console.error("Error eliminando pedido:", exc);
    return NextResponse.json({ error: "No se pudo eliminar el pedido" }, { status: 500 });
  }
}
