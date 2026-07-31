// Estado del proveedor de precios para el panel /admin: cuánto queda de
// la cuota diaria y si el circuit breaker lo tiene pausado.
//
// Sin esto, "se agotó la cuota" es invisible: el cotizador degrada en
// silencio a los precios de repuestos_catalogo y todo se ve normal, solo
// que los precios dejan de actualizarse.

import { NextResponse } from "next/server";
import { esEmailAdmin } from "@/lib/adminAuth";
import { estadoProveedor } from "@/lib/priceCircuitBreaker";
import { consumoDelDia, LIMITE_DIARIO_IMPEX } from "@/lib/priceQuota";
import { createClient } from "@/lib/supabase/server";

const PROVIDER = "impex";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!esEmailAdmin(user?.email)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const [cuota, circuito] = await Promise.all([
      consumoDelDia(PROVIDER, LIMITE_DIARIO_IMPEX),
      estadoProveedor(PROVIDER),
    ]);

    return NextResponse.json({
      proveedor: PROVIDER,
      cuota,
      circuito: {
        pausado: circuito.pausado,
        pausadoHasta: circuito.pausadoHasta?.toISOString() ?? null,
        fallosConsecutivos: circuito.fallosConsecutivos,
        ultimoEstado: circuito.ultimoEstado,
        ultimoMensaje: circuito.ultimoMensaje,
      },
    });
  } catch (exc) {
    console.error("Error consultando el estado del proveedor de precios:", exc);
    return NextResponse.json({ error: "No se pudo obtener el estado" }, { status: 500 });
  }
}
