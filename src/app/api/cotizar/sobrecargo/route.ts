import { NextResponse } from "next/server";
import { obtenerTipoCambioActivo } from "@/lib/cotizar";
import { calcularEnvioDhlJpy } from "@/lib/impexEnvio";
import { obtenerIp, rateLimitExcedido } from "@/lib/rateLimit";
import { getSettings } from "@/lib/settings";

/**
 * Calcula el sobrecargo por volumen para repuestos donde Impex no
 * informa peso/tamaño (piezas grandes: carenados, estanques, etc).
 * El cliente ingresa el peso y tamaño reales del paquete; se consulta
 * el flete DHL para esos datos y se cobra un porcentaje de ese flete
 * (descuento fijado por el administrador).
 */
export async function POST(request: Request) {
  const ip = obtenerIp(request);
  if (rateLimitExcedido(`sobrecargo:${ip}`, 20, 60_000)) {
    return NextResponse.json(
      { error: "Demasiadas consultas seguidas. Espera un minuto e intenta de nuevo." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const pesoKg = Number(body?.pesoKg);
  const largoCm = body?.largoCm !== undefined ? Number(body.largoCm) : undefined;
  const anchoCm = body?.anchoCm !== undefined ? Number(body.anchoCm) : undefined;
  const altoCm = body?.altoCm !== undefined ? Number(body.altoCm) : undefined;

  if (!Number.isFinite(pesoKg) || pesoKg <= 0) {
    return NextResponse.json({ error: "Ingresa un peso válido en kg" }, { status: 400 });
  }

  let envioDhlJpy: number | null;
  try {
    envioDhlJpy = await calcularEnvioDhlJpy({ pesoKg, largoCm, anchoCm, altoCm });
  } catch (exc) {
    return NextResponse.json(
      { error: exc instanceof Error ? exc.message : "Error al consultar el costo de envío" },
      { status: 502 },
    );
  }

  if (envioDhlJpy === null) {
    return NextResponse.json(
      { error: "DHL no tiene una tarifa disponible para ese peso/tamaño" },
      { status: 422 },
    );
  }

  const { tipoCambioManual, descuentoSobrecargoDhlPct } = await getSettings();

  let tipoCambio: number;
  try {
    const tc = await obtenerTipoCambioActivo(tipoCambioManual);
    tipoCambio = tc.tasa;
  } catch (exc) {
    return NextResponse.json(
      { error: exc instanceof Error ? exc.message : "No se pudo obtener el tipo de cambio" },
      { status: 502 },
    );
  }

  const envioDhlClp = Math.round(envioDhlJpy * tipoCambio);
  const sobrecargoClp = Math.round(envioDhlClp * (1 - descuentoSobrecargoDhlPct / 100));

  return NextResponse.json({
    envioDhlJpy,
    envioDhlClp,
    descuentoSobrecargoDhlPct,
    sobrecargoClp,
  });
}
