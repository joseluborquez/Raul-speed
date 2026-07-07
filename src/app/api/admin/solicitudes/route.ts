import { NextResponse } from "next/server";
import { esEmailAdmin } from "@/lib/adminAuth";
import { listarSolicitudes } from "@/lib/solicitudes";
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
    const solicitudes = await listarSolicitudes();
    return NextResponse.json({ solicitudes });
  } catch (exc) {
    console.error("Error listando solicitudes:", exc);
    return NextResponse.json({ error: "No se pudo obtener las solicitudes" }, { status: 500 });
  }
}
