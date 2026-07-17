export function fmt(n: number): string {
  return new Intl.NumberFormat("es-CL").format(n);
}

/**
 * Precio aproximado a la decena para la ficha de cotización: el costo de
 * logística y el sobrecargo por peso recién se muestran y se suman al
 * agregar el ítem al carrito, no antes.
 */
export function redondearAproximado(n: number): number {
  return Math.round(n / 10) * 10;
}
