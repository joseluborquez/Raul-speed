import { NextResponse } from "next/server";
import { getSettings, updateCostoLogisticaClp, updateTipoCambioManual } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
