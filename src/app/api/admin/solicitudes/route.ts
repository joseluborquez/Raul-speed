import { NextResponse } from "next/server";
import { esEmailAdmin } from "@/lib/adminAuth";
import { esEstadoSolicitud } from "@/lib/estadoGestion";
import {
  actualizarEstadoSolicitud,
  eliminarSolicitud,
  listarSolicitudes,
} from "@/lib/solicitudes";
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
    const solicitudes = await listarSolicitudes();
    return NextResponse.json({ solicitudes });
  } catch (exc) {
    console.error("Error listando solicitudes:", exc);
    return NextResponse.json({ error: "No se pudo obtener las solicitudes" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "Falta el id de la solicitud" }, { status: 400 });
  }
  if (!esEstadoSolicitud(body?.estado)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  try {
    await actualizarEstadoSolicitud(id, body.estado);
    return NextResponse.json({ ok: true });
  } catch (exc) {
    console.error("Error actualizando el estado de la solicitud:", exc);
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
    return NextResponse.json({ error: "Falta el id de la solicitud" }, { status: 400 });
  }

  try {
    await eliminarSolicitud(id);
    return NextResponse.json({ ok: true });
  } catch (exc) {
    console.error("Error eliminando solicitud:", exc);
    return NextResponse.json({ error: "No se pudo eliminar la solicitud" }, { status: 500 });
  }
}
