import { NextResponse } from "next/server";
import { esEmailAdmin } from "@/lib/adminAuth";
import { getSettings, updateCostoLogisticaClp, updateTipoCambioManual } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

// Solo admin: el único consumidor es el panel (/admin). El cotizador
// público nunca llama acá — recibe costoLogisticaClp dentro de la
// respuesta de /api/cotizar — y la tasa manual es un dato de negocio que
// no hay razón para exponer.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!esEmailAdmin(user?.email)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!esEmailAdmin(user?.email)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  if ("costoLogisticaClp" in body) {
    const valor = Number(body.costoLogisticaClp);
    if (!Number.isFinite(valor) || valor < 0) {
      return NextResponse.json({ error: "Costo de logística inválido" }, { status: 400 });
    }
    await updateCostoLogisticaClp(valor);
  }

  if ("tipoCambioManual" in body) {
    const raw = body.tipoCambioManual;
    if (raw === null) {
      await updateTipoCambioManual(null);
    } else {
      const valor = Number(raw);
      if (!Number.isFinite(valor) || valor <= 0) {
        return NextResponse.json({ error: "Tasa manual inválida" }, { status: 400 });
      }
      await updateTipoCambioManual(valor);
    }
  }

  const settings = await getSettings();
  return NextResponse.json(settings);
}
