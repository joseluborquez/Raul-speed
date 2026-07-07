import { NextResponse } from "next/server";
import { esEmailAdmin } from "@/lib/adminAuth";
import { listarPedidos } from "@/lib/pedidos";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!esEmailAdmin(user?.email)) {
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
