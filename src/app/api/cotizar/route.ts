import { NextResponse } from "next/server";
import { cotizar } from "@/lib/cotizar";
import { obtenerIp, rateLimitExcedido } from "@/lib/rateLimit";

export async function POST(request: Request) {
  // Cada consulta golpea la API de Impex con nuestra key — sin límite,
  // un script puede agotar la cuota (ya pasó una vez).
  const ip = obtenerIp(request);
  if (rateLimitExcedido(`cotizar:${ip}`, 20, 60_000)) {
    return NextResponse.json(
      { estado: "error", mensaje: "Demasiadas consultas seguidas. Espera un minuto e intenta de nuevo." },
      { status: 429 },
    );
  }

  const data = await request.json().catch(() => ({}));
  const partNumber = String(data?.partNumber ?? "").trim();

  if (!partNumber) {
    return NextResponse.json(
      { estado: "error", mensaje: "Ingresa un número de parte" },
      { status: 400 },
    );
  }

  const resultado = await cotizar(partNumber);
  return NextResponse.json(resultado);
}
