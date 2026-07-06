import { NextResponse } from "next/server";
import { cotizar } from "@/lib/cotizar";

export async function POST(request: Request) {
  const data = await request.json().catch(() => ({}));
  const partNumber = String(data?.partNumber ?? "").trim();

  if (!partNumber) {
    return NextResponse.json(
      { estado: "error", mensaje: "Ingresa un número de parte" },
      { status: 400 },
    );
  }

  const rawOverride = data?.tipoCambioOverride;
  const override =
    rawOverride !== undefined && rawOverride !== null && !Number.isNaN(Number(rawOverride))
      ? Number(rawOverride)
      : null;

  const resultado = await cotizar(partNumber, override);
  return NextResponse.json(resultado);
}
