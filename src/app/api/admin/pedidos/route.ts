import { NextResponse } from "next/server";
import { listarPedidos } from "@/lib/pedidos";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const pedidos = await listarPedidos();
    return NextResponse.json({ pedidos });
  } catch (exc) {
    return NextResponse.json(
      { error: exc instanceof Error ? exc.message : "No se pudo obtener los pedidos" },
      { status: 500 },
    );
  }
}
