// Sin dependencias de servidor a propósito — lo importan tanto las
// páginas del panel admin (cliente) como las rutas /api/admin (servidor).

/**
 * Seguimiento manual de un pedido, aparte del `estado` de pago que mueven
 * las pasarelas: un pedido "pagado" puede estar recién encargado al
 * proveedor o ya entregado. Solo lo escribe el admin desde el panel.
 */
export type EstadoGestion =
  | "sin_gestionar"
  | "pedido_al_proveedor"
  | "en_transito"
  | "en_bodega"
  | "despachado"
  | "entregado"
  | "cancelado";

export const ESTADO_GESTION_LABELS: Record<EstadoGestion, string> = {
  sin_gestionar: "Sin gestionar",
  pedido_al_proveedor: "Pedido al proveedor",
  en_transito: "En tránsito",
  en_bodega: "En bodega",
  despachado: "Despachado al cliente",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const ESTADOS_GESTION = Object.keys(ESTADO_GESTION_LABELS) as EstadoGestion[];

export function esEstadoGestion(valor: unknown): valor is EstadoGestion {
  return typeof valor === "string" && valor in ESTADO_GESTION_LABELS;
}

/** Seguimiento de una solicitud de "no sé mi número de parte". */
export type EstadoSolicitud =
  | "pendiente"
  | "en_busqueda"
  | "cotizada"
  | "respondida"
  | "cerrada"
  | "descartada";

export const ESTADO_SOLICITUD_LABELS: Record<EstadoSolicitud, string> = {
  pendiente: "Pendiente",
  en_busqueda: "Buscando el N° de parte",
  cotizada: "Cotizada",
  respondida: "Respondida al cliente",
  cerrada: "Cerrada",
  descartada: "Descartada",
};

export const ESTADOS_SOLICITUD = Object.keys(ESTADO_SOLICITUD_LABELS) as EstadoSolicitud[];

export function esEstadoSolicitud(valor: unknown): valor is EstadoSolicitud {
  return typeof valor === "string" && valor in ESTADO_SOLICITUD_LABELS;
}
