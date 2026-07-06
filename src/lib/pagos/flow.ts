import { firmarParametrosFlow } from "./flowSign";

// 1 = pendiente de pago, 2 = pagada, 3 = rechazada, 4 = anulada.
export const FLOW_STATUS = { PENDIENTE: 1, PAGADA: 2, RECHAZADA: 3, ANULADA: 4 } as const;

function getConfig() {
  const apiKey = process.env.FLOW_API_KEY!;
  const secretKey = process.env.FLOW_SECRET_KEY!;
  const baseUrl =
    process.env.FLOW_ENV === "production"
      ? "https://www.flow.cl/api"
      : "https://sandbox.flow.cl/api";
  return { apiKey, secretKey, baseUrl };
}

export interface CrearPagoFlowResultado {
  redirectUrl: string;
  token: string;
}

/**
 * Crea una orden de pago en Flow (payment/create). Redirige con un GET
 * simple a la url que devuelve, a diferencia de Webpay.
 */
export async function crearPago(
  pedidoId: string,
  totalClp: number,
  email: string,
  returnBaseUrl: string,
): Promise<CrearPagoFlowResultado> {
  const { apiKey, secretKey, baseUrl } = getConfig();

  const params: Record<string, string> = {
    apiKey,
    commerceOrder: pedidoId,
    subject: `Pedido Raulspeed #${pedidoId.slice(0, 8)}`,
    currency: "CLP",
    amount: String(Math.round(totalClp)),
    email,
    urlConfirmation: `${returnBaseUrl}/api/pagos/flow/webhook`,
    urlReturn: `${returnBaseUrl}/checkout/confirmacion?pedido=${pedidoId}`,
  };
  const s = firmarParametrosFlow(params, secretKey);

  const resp = await fetch(`${baseUrl}/payment/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, s }),
  });

  const data = await resp.json();
  if (!resp.ok || !data?.url || !data?.token) {
    throw new Error(data?.message || "Flow no devolvió una URL de pago");
  }

  return { redirectUrl: `${data.url}?token=${data.token}`, token: data.token };
}

/**
 * Vuelve a consultar el estado directamente en Flow (payment/getStatus)
 * — nunca se confía en el payload del webhook por sí solo.
 */
export async function verificarPago(token: string) {
  const { apiKey, secretKey, baseUrl } = getConfig();

  const params = { apiKey, token };
  const s = firmarParametrosFlow(params, secretKey);

  const url = new URL(`${baseUrl}/payment/getStatus`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("token", token);
  url.searchParams.set("s", s);

  const resp = await fetch(url.toString());
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.message || "No se pudo verificar el pago en Flow");
  return data;
}
