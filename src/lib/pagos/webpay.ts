import { WebpayPlus } from "transbank-sdk";

export interface CrearPagoWebpayResultado {
  url: string;
  token: string;
}

function getTransaction() {
  const commerceCode = process.env.WEBPAY_COMMERCE_CODE!;
  const apiKey = process.env.WEBPAY_API_KEY!;
  const esProduccion = process.env.WEBPAY_ENV === "production";

  return esProduccion
    ? WebpayPlus.Transaction.buildForProduction(commerceCode, apiKey)
    : WebpayPlus.Transaction.buildForIntegration(commerceCode, apiKey);
}

/**
 * Crea una transacción Webpay Plus. A diferencia de Mercado Pago/Flow no
 * hay una única URL de redirección: el frontend debe hacer un POST
 * autosubmit de `token` hacia `url` (formulario, no un simple redirect).
 */
export async function crearPago(
  pedidoId: string,
  totalClp: number,
  returnBaseUrl: string,
): Promise<CrearPagoWebpayResultado> {
  // buyOrder de Transbank acepta máximo 26 caracteres alfanuméricos.
  const buyOrder = pedidoId.replace(/-/g, "").slice(0, 26);
  const sessionId = pedidoId;
  const returnUrl = `${returnBaseUrl}/api/pagos/webpay/return?pedido=${pedidoId}`;

  const transaction = getTransaction();
  const result = await transaction.create(buyOrder, sessionId, totalClp, returnUrl);

  return { url: result.url, token: result.token };
}

/**
 * Confirma la transacción — es el propio paso de verificación (no hay
 * webhook separado en Webpay). Nunca se marca un pedido como pagado sin
 * pasar por acá.
 */
export async function commitPago(token: string) {
  const transaction = getTransaction();
  return transaction.commit(token);
}
