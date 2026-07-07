import { NextResponse } from "next/server";
import { crearSolicitud } from "@/lib/solicitudes";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const nombreApellido = String(body?.nombreApellido ?? "").trim();
  const contacto = String(body?.contacto ?? "").trim();
  const moto = String(body?.moto ?? "").trim();
  const chasisVinPatente = String(body?.chasisVinPatente ?? "").trim();
  const descripcionRepuesto = String(body?.descripcionRepuesto ?? "").trim();

  if (!nombreApellido) {
    return NextResponse.json({ error: "Falta el nombre completo" }, { status: 400 });
  }
  if (!contacto) {
    return NextResponse.json(
      { error: "Falta el WhatsApp o correo electrónico" },
      { status: 400 },
    );
  }
  if (!moto) {
    return NextResponse.json(
      { error: "Falta la marca, modelo y año de la motocicleta" },
      { status: 400 },
    );
  }
  if (!chasisVinPatente) {
    return NextResponse.json(
      { error: "Falta el número de chasis, VIN o patente" },
      { status: 400 },
    );
  }
  if (!descripcionRepuesto) {
    return NextResponse.json(
      { error: "Falta la descripción del repuesto" },
      { status: 400 },
    );
  }

  try {
    const id = await crearSolicitud({
      nombreApellido,
      contacto,
      moto,
      chasisVinPatente,
      descripcionRepuesto,
    });
    return NextResponse.json({ id });
  } catch (exc) {
    return NextResponse.json(
      { error: exc instanceof Error ? exc.message : "No se pudo enviar la solicitud" },
      { status: 500 },
    );
  }
}
