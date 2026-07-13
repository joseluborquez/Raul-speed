// Tipo compartido del carrito de cotización entre la página principal
// (donde se arma) y el checkout (donde se paga). El traspaso entre
// ambas páginas se hace vía sessionStorage bajo esta misma clave.

export interface ItemCotizacion {
  id: string;
  partNumber: string;
  maker?: string;
  nombre?: string;
  /** Precio del repuesto solo, sin sobrecargo por peso (se calcula a nivel de carrito). */
  precioRepuestoClp: number;
  /** 0 = sin dato. */
  pesoKg: number;
  cantidad: number;
}

export interface CarritoStorage {
  items: ItemCotizacion[];
  costoLogisticaClp: number;
}

export const CARRITO_STORAGE_KEY = "raulspeed_carrito";
