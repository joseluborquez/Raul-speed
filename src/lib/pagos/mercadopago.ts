import { createHmac } from "crypto";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import type { CrearPagoInput, CrearPagoResultado } from "./types";

function getClient(): MercadoPagoConfig {
  return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
}

/**
 * Crea una preferencia de Checkout Pro y devuelve la URL a la que hay
 * que redirigir al cliente.
 */
export async function crearPago({
  pedidoId,
  totalClp,
  returnBaseUrl,
}: CrearPagoInput): Promise<CrearPagoResultado> {
  const preference = new Preference(getClient());
  // Pasa por una ruta API (en vez de apuntar directo a la página de
  // confirmación) para no depender de que Mercado Pago vuelva siempre
  // con GET — mismo problema que ya vimos con Webpay y Flow.
  const confirmacionUrl = `${returnBaseUrl}/api/pagos/mercadopago/return?pedido=${pedidoId}`;

  const result = await preference.create({
    body: {
      items: [
        {
          id: pedidoId,
          title: `Pedido Raulspeed #${pedidoId.slice(0, 8)}`,
          quantity: 1,
          unit_price: totalClp,
          currency_id: "CLP",
        },
      ],
      external_reference: pedidoId,
      back_urls: {
        success: confirmacionUrl,
        pending: confirmacionUrl,
        failure: confirmacionUrl,
      },
      notification_url: `${returnBaseUrl}/api/pagos/mercadopago/webhook`,
    },
  });

  const redirectUrl = result.init_point ?? result.sandbox_init_point;
  if (!redirectUrl) throw new Error("Mercado Pago no devolvió una URL de pago");

  return { redirectUrl, proveedorRef: result.id ?? pedidoId };
}

/**
 * Vuelve a consultar el pago directamente en la API de Mercado Pago —
 * nunca se confía en el estado que trae el webhook.
 */
export async function verificarPago(paymentId: string) {
  const payment = new Payment(getClient());
  return payment.get({ id: paymentId });
}

/**
 * Valida la firma HMAC-SHA256 que Mercado Pago manda en el header
 * x-signature (docs: "Validar origen de las notificaciones webhook").
 * Manifest: `id:{dataId};request-id:{xRequestId};ts:{ts};` — dataId en
 * minúsculas si es alfanumérico (los payment id son numéricos, no afecta).
 * No es la única defensa (verificarPago() igual se vuelve a consultar
 * siempre contra la API real), pero evita gastar esa llamada en tokens
 * inventados.
 */
export function firmaWebhookValida(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret: string;
}): boolean {
  const { xSignature, xRequestId, dataId, secret } = params;
  if (!xSignature) return false;

  const partes = new Map(
    xSignature.split(",").map((par) => {
      const [clave, valor] = par.split("=");
      return [clave?.trim(), valor?.trim()];
    }),
  );
  const ts = partes.get("ts");
  const v1 = partes.get("v1");
  if (!ts || !v1) return false;

  const manifest =
    `id:${dataId.toLowerCase()};` +
    (xRequestId ? `request-id:${xRequestId};` : "") +
    `ts:${ts};`;
  const hash = createHmac("sha256", secret).update(manifest).digest("hex");
  return hash === v1;
}
