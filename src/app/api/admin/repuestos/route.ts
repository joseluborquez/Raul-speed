import { NextResponse } from "next/server";
import { esEmailAdmin } from "@/lib/adminAuth";
import { actualizarPesoManual, listarRepuestosCatalogo } from "@/lib/repuestosCatalogo";
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
    const repuestos = await listarRepuestosCatalogo();
    return NextResponse.json({ repuestos });
  } catch (exc) {
    console.error("Error listando el catálogo de repuestos:", exc);
    return NextResponse.json({ error: "No se pudo obtener el catálogo" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const partNumber = typeof body.partNumber === "string" ? body.partNumber.trim() : "";
  if (!partNumber) {
    return NextResponse.json({ error: "Falta el N° de parte" }, { status: 400 });
  }

  let pesoKgManual: number | null;
  if (body.pesoKgManual === null) {
    pesoKgManual = null;
  } else {
    const valor = Number(body.pesoKgManual);
    if (!Number.isFinite(valor) || valor < 0) {
      return NextResponse.json({ error: "Peso inválido" }, { status: 400 });
    }
    pesoKgManual = valor;
  }

  try {
    await actualizarPesoManual(partNumber, pesoKgManual);
    return NextResponse.json({ ok: true });
  } catch (exc) {
    console.error("Error actualizando peso manual:", exc);
    return NextResponse.json(
      { error: exc instanceof Error ? exc.message : "No se pudo guardar el peso" },
      { status: 400 },
    );
  }
}
