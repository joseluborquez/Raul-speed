import { NextResponse } from "next/server";
import { cotizar } from "@/lib/cotizar";
import { crearPedido, type ItemPedido, type MetodoEnvio } from "@/lib/pedidos";
import { getSettings } from "@/lib/settings";
import { limpiarRut, validarRut } from "@/lib/rut";

const MAX_ITEMS_POR_PEDIDO = 30;

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
  if (itemsRaw.length > MAX_ITEMS_POR_PEDIDO) {
    return NextResponse.json({ error: "Demasiados ítems en el carrito" }, { status: 400 });
  }

  // El precio nunca se toma del navegador: cada partNumber se vuelve a
  // cotizar contra Impex acá mismo. De lo contrario, cualquiera podría
  // editar el precioRepuestoClp que manda el cliente y pagar menos de lo
  // real — el navegador solo puede decidir *qué* partNumber y *cuántas*
  // unidades, nunca el precio.
  const preciosCache = new Map<string, Awaited<ReturnType<typeof cotizar>>>();
  const items: ItemPedido[] = [];

  for (const raw of itemsRaw) {
    const partNumber = String(raw?.partNumber ?? "").trim().toUpperCase();
    if (!partNumber) {
      return NextResponse.json({ error: "Hay un ítem sin número de parte" }, { status: 400 });
    }
    const cantidad = Math.max(1, Math.trunc(Number(raw?.cantidad)) || 1);

    let resultado = preciosCache.get(partNumber);
    if (!resultado) {
      resultado = await cotizar(partNumber);
      preciosCache.set(partNumber, resultado);
    }
    if (resultado.estado !== "ok") {
      return NextResponse.json(
        { error: `No se pudo verificar el precio de ${partNumber}. Intenta cotizar de nuevo.` },
        { status: 409 },
      );
    }

    items.push({
      partNumber,
      maker: resultado.maker,
      nombre: resultado.nombre,
      precioRepuestoClp: resultado.precioRepuestoClp ?? 0,
      cantidad,
    });
  }

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
    console.error("Error creando pedido:", exc);
    return NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 500 });
  }
}
