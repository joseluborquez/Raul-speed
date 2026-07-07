import { NextResponse } from "next/server";
import { crearPedido, type ItemPedido, type MetodoEnvio } from "@/lib/pedidos";
import { getSettings } from "@/lib/settings";
import { limpiarRut, validarRut } from "@/lib/rut";

const METODOS_ENVIO: MetodoEnvio[] = [
  "starken_domicilio",
  "starken_retiro",
  "chilexpress_domicilio",
  "chilexpress_retiro",
  "correoschile_domicilio",
  "correoschile_retiro",
  "bluexpress_domicilio",
  "bluexpress_retiro",
  "retiro_tome",
  "otro",
];

const CAMPOS_TEXTO_REQUERIDOS = [
  "nombreCompleto",
  "rut",
  "telefono",
  "email",
  "region",
  "ciudad",
  "comuna",
  "direccion",
] as const;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const itemsRaw: ItemPedido[] = Array.isArray(body?.items) ? body.items : [];
  if (itemsRaw.length === 0) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  }

  // La cantidad viene del navegador: se sanea a un entero >= 1 antes de
  // usarla para calcular el subtotal, nunca se confía en su valor crudo.
  const items: ItemPedido[] = itemsRaw.map((item) => ({
    ...item,
    cantidad: Math.max(1, Math.trunc(Number(item.cantidad)) || 1),
  }));

  for (const campo of CAMPOS_TEXTO_REQUERIDOS) {
    if (!String(body?.[campo] ?? "").trim()) {
      return NextResponse.json({ error: `Falta el campo ${campo}` }, { status: 400 });
    }
  }

  const rut = limpiarRut(String(body.rut));
  if (!validarRut(rut)) {
    return NextResponse.json({ error: "RUT inválido" }, { status: 400 });
  }

  const metodoEnvio = String(body?.metodoEnvio ?? "") as MetodoEnvio;
  if (!METODOS_ENVIO.includes(metodoEnvio)) {
    return NextResponse.json({ error: "Método de envío inválido" }, { status: 400 });
  }
  if (metodoEnvio === "otro" && !String(body?.envioDetalle ?? "").trim()) {
    return NextResponse.json({ error: "Describe el método de envío" }, { status: 400 });
  }

  // El subtotal se recalcula desde los ítems y el costo de logística se
  // vuelve a leer de settings — nunca se confía en el total que mande el navegador.
  const subtotalRepuestosClp = items.reduce(
    (sum, item) => sum + Number(item.precioRepuestoClp || 0) * item.cantidad,
    0,
  );
  const { costoLogisticaClp } = await getSettings();
  const totalClp = subtotalRepuestosClp + costoLogisticaClp;

  try {
    const pedidoId = await crearPedido({
      items,
      subtotalRepuestosClp,
      costoLogisticaClp,
      totalClp,
      nombreCompleto: String(body.nombreCompleto).trim(),
      rut,
      telefono: String(body.telefono).trim(),
      email: String(body.email).trim(),
      metodoEnvio,
      envioDetalle: body.envioDetalle ? String(body.envioDetalle).trim() : undefined,
      region: String(body.region).trim(),
      ciudad: String(body.ciudad).trim(),
      comuna: String(body.comuna).trim(),
      direccion: String(body.direccion).trim(),
    });

    return NextResponse.json({ pedidoId, totalClp });
  } catch (exc) {
    return NextResponse.json(
      { error: exc instanceof Error ? exc.message : "No se pudo crear el pedido" },
      { status: 500 },
    );
  }
}
