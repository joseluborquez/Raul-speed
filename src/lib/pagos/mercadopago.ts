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
