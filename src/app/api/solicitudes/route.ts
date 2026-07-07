import { NextResponse } from "next/server";
import { crearSolicitud } from "@/lib/solicitudes";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const nombreApellido = String(body?.nombreApellido ?? "").trim();
  const numeroParteCantidad = String(body?.numeroParteCantidad ?? "").trim();
  const contacto = String(body?.contacto ?? "").trim();
  const moto = String(body?.moto ?? "").trim();

  if (!nombreApellido) {
    return NextResponse.json({ error: "Falta el nombre y apellido" }, { status: 400 });
  }
  if (!numeroParteCantidad) {
    return NextResponse.json(
      { error: "Falta el número de parte y la cantidad" },
      { status: 400 },
    );
  }
  if (!contacto) {
    return NextResponse.json(
      { error: "Falta el WhatsApp o correo electrónico" },
      { status: 400 },
    );
  }

  try {
    const id = await crearSolicitud({
      nombreApellido,
      numeroParteCantidad,
      contacto,
      moto: moto || undefined,
    });
    return NextResponse.json({ id });
  } catch (exc) {
    return NextResponse.json(
      { error: exc instanceof Error ? exc.message : "No se pudo enviar la solicitud" },
      { status: 500 },
    );
  }
}
