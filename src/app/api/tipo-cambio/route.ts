import { NextResponse } from "next/server";
import { getJpyToClp } from "@/lib/calculator";

export async function GET() {
  try {
    const { tasa, fuente } = await getJpyToClp();
    return NextResponse.json({ tasa: Number(tasa.toFixed(6)), fuente });
  } catch (exc) {
    const mensaje = exc instanceof Error ? exc.message : String(exc);
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
