import { NextResponse } from "next/server";
import { esEmailAdmin } from "@/lib/adminAuth";
import { actualizarConfigFiltroEnvio, listarFiltroEnvioAdmin } from "@/lib/filtroEnvioConfig";
import type { ConfigFiltroEnvio } from "@/lib/sobrecargoEnvio";
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
    const data = await listarFiltroEnvioAdmin();
    return NextResponse.json(data);
  } catch (exc) {
    console.error("Error listando el filtro de envío:", exc);
    return NextResponse.json({ error: "No se pudo obtener el filtro de envío" }, { status: 500 });
  }
}

const CAMPOS_VALIDOS: (keyof ConfigFiltroEnvio)[] = [
  "pesoIncluidoKg",
  "cobroKiloExtraClp",
  "pesoMaximoKg",
  "precioSeguroSinPesoClp",
  "exencionVoluminosasKg",
  "precioMinimoVoluminosaClp",
];

export async function PUT(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const cambios: Partial<ConfigFiltroEnvio> = {};

  for (const campo of CAMPOS_VALIDOS) {
    if (!(campo in body)) continue;
    const valor = Number(body[campo]);
    if (!Number.isFinite(valor) || valor < 0) {
      return NextResponse.json({ error: `Valor inválido para ${campo}` }, { status: 400 });
    }
    cambios[campo] = valor;
  }

  try {
    // Validación cruzada sobre la config RESULTANTE (actual + cambios,
    // por si el PUT viene parcial): un tope de peso en 0 mandaría todo el
    // catálogo a WhatsApp, y un tramo incluido mayor que el tope invierte
    // la lógica del sobrecargo.
    const actual = (await listarFiltroEnvioAdmin()).config;
    const resultante = { ...actual, ...cambios };
    if (resultante.pesoMaximoKg <= 0) {
      return NextResponse.json(
        { error: "El peso máximo debe ser mayor que 0" },
        { status: 400 },
      );
    }
    if (resultante.pesoIncluidoKg > resultante.pesoMaximoKg) {
      return NextResponse.json(
        { error: "El peso incluido no puede superar el peso máximo" },
        { status: 400 },
      );
    }

    await actualizarConfigFiltroEnvio(cambios);
    const data = await listarFiltroEnvioAdmin();
    return NextResponse.json(data);
  } catch (exc) {
    console.error("Error actualizando el filtro de envío:", exc);
    return NextResponse.json(
      { error: exc instanceof Error ? exc.message : "No se pudo guardar" },
      { status: 400 },
    );
  }
}
