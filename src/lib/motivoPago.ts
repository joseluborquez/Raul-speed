// Traduce el payload crudo que cada proveedor de pago guarda en
// raw_provider_payload a un motivo legible para el panel admin. Cada
// proveedor tiene su propia forma de explicar un rechazo/reembolso, así
// que el mapeo es específico por metodo_pago.

import type { MetodoPago } from "./pedidos";

// https://www.mercadopago.cl/developers/es/docs/checkout-api/response-handling/collection-results
const MOTIVOS_MERCADOPAGO: Record<string, string> = {
  cc_rejected_bad_filled_card_number: "Número de tarjeta inválido",
  cc_rejected_bad_filled_date: "Fecha de vencimiento inválida",
  cc_rejected_bad_filled_other: "Datos de la tarjeta inválidos",
  cc_rejected_bad_filled_security_code: "Código de seguridad (CVV) inválido",
  cc_rejected_blacklist: "Tarjeta en lista negra del emisor",
  cc_rejected_call_for_authorize: "El banco requiere autorización telefónica",
  cc_rejected_card_disabled: "Tarjeta deshabilitada",
  cc_rejected_card_type_not_allowed: "Tipo de tarjeta no permitido",
  cc_rejected_duplicated_payment: "Pago duplicado",
  cc_rejected_high_risk: "Rechazado por riesgo de fraude",
  cc_rejected_insufficient_amount: "Fondos insuficientes",
  cc_rejected_invalid_installments: "Cuotas no válidas",
  cc_rejected_max_attempts: "Máximo de intentos excedido",
  cc_rejected_other_reason: "Rechazado por el banco emisor",
  cc_rejected_unsupported_operation: "Operación no soportada por la tarjeta",
  rejected_insufficient_data: "Datos insuficientes",
  rejected_by_bank: "Rechazado por el banco",
};

// https://www.transbankdevelopers.cl/documentacion/webpay-plus#codigos-de-respuesta
const MOTIVOS_WEBPAY: Record<number, string> = {
  [-1]: "Rechazo de la transacción",
  [-2]: "Debe reintentarse la transacción",
  [-3]: "Error en la transacción",
  [-4]: "Rechazo por posible fraude",
  [-5]: "Rechazo por sospecha de fraude",
  [-6]: "Excede el cupo máximo mensual",
  [-7]: "Excede el límite de monto diario",
  [-8]: "Rubro no autorizado",
};

function comoRegistro(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
}

/**
 * Describe en español el motivo de un pedido fallido o reembolsado, a
 * partir del payload crudo guardado del proveedor. Devuelve null cuando
 * no hay información suficiente para explicarlo (para no inventar un
 * motivo genérico donde no corresponde).
 */
export function describirMotivoPago(
  metodoPago: MetodoPago | null,
  raw: unknown,
): string | null {
  const data = comoRegistro(raw);
  if (!data) return null;

  if (metodoPago === "mercadopago") {
    if (data.status === "refunded") return "Reembolsado al comprador";
    if (data.status === "charged_back") return "Contracargo (chargeback) del comprador";
    const detalle = typeof data.status_detail === "string" ? data.status_detail : null;
    if (!detalle) return null;
    return MOTIVOS_MERCADOPAGO[detalle] ?? `Rechazado por Mercado Pago (${detalle})`;
  }

  if (metodoPago === "webpay") {
    if (data.abandonado) return "El cliente abandonó el pago antes de confirmar";
    const responseCode = typeof data.response_code === "number" ? data.response_code : null;
    if (responseCode !== null && responseCode !== 0) {
      return MOTIVOS_WEBPAY[responseCode] ?? `Rechazado por Transbank (código ${responseCode})`;
    }
    if (typeof data.error === "string") return data.error;
    return null;
  }

  if (metodoPago === "flow") {
    const status = typeof data.status === "number" ? data.status : null;
    if (status === 3) return "Rechazada por el medio de pago";
    if (status === 4) return "Anulada";
    return null;
  }

  return null;
}
