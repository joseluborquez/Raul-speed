import { NextResponse } from "next/server";
import { cargarFiltroEnvio } from "@/lib/filtroEnvioConfig";

// Pública, sin auth — mismo criterio que /api/tipo-cambio: el carrito y
// el checkout (client-side) necesitan los umbrales de peso vigentes para
// el pre-chequeo de "¿este carrito se va a WhatsApp?" antes de proceder
// al pago. No devuelve las listas de términos (el cliente no las usa;
// clasificarEnvio() con las listas solo corre server-side en cotizar.ts).
export async function GET() {
  const { config } = await cargarFiltroEnvio();
  return NextResponse.json(config);
}
