import { NextResponse } from "next/server";
import { getCostoLogisticaClp, updateCostoLogisticaClp } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const costoLogisticaClp = await getCostoLogisticaClp();
  return NextResponse.json({ costoLogisticaClp });
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
  const valor = Number(body?.costoLogisticaClp);

  if (!Number.isFinite(valor) || valor < 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  }

  await updateCostoLogisticaClp(valor);
  return NextResponse.json({ costoLogisticaClp: valor });
}
