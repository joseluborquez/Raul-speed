import { NextResponse } from "next/server";
import { esEmailAdmin } from "@/lib/adminAuth";
import { agregarTermino, eliminarTermino, esCategoriaValida } from "@/lib/filtroEnvioConfig";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return esEmailAdmin(user?.email);
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const categoria = body.categoria;
  const termino = typeof body.termino === "string" ? body.termino : "";

  if (!esCategoriaValida(categoria)) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }
  if (!termino.trim()) {
    return NextResponse.json({ error: "Falta el término" }, { status: 400 });
  }

  try {
    await agregarTermino(categoria, termino);
    return NextResponse.json({ ok: true });
  } catch (exc) {
    const mensaje = exc instanceof Error ? exc.message : "No se pudo agregar el término";
    const status = mensaje.includes("ya existe") ? 409 : 400;
    return NextResponse.json({ error: mensaje }, { status });
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "Falta el id del término" }, { status: 400 });
  }

  try {
    await eliminarTermino(id);
    return NextResponse.json({ ok: true });
  } catch (exc) {
    console.error("Error eliminando término del filtro de envío:", exc);
    return NextResponse.json(
      { error: exc instanceof Error ? exc.message : "No se pudo eliminar el término" },
      { status: 400 },
    );
  }
}
