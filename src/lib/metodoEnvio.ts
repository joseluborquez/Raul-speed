// Sin dependencias de servidor a propósito — lo importan tanto el
// checkout (cliente) como src/lib/pedidos.ts (servidor).

export type MetodoEnvio =
  | "starken_domicilio"
  | "starken_retiro"
  | "chilexpress_domicilio"
  | "chilexpress_retiro"
  | "correoschile_domicilio"
  | "correoschile_retiro"
  | "bluexpress_domicilio"
  | "bluexpress_retiro"
  | "retiro_tome"
  | "otro";

export const METODO_ENVIO_LABELS: Record<MetodoEnvio, string> = {
  starken_domicilio: "Starken — Despacho a domicilio",
  starken_retiro: "Retiro en sucursal — Starken",
  chilexpress_domicilio: "Chilexpress — Despacho a domicilio",
  chilexpress_retiro: "Retiro en sucursal — Chilexpress",
  correoschile_domicilio: "Correos de Chile — Despacho a domicilio",
  correoschile_retiro: "Retiro en sucursal — Correos de Chile",
  bluexpress_domicilio: "Bluexpress — Despacho a domicilio",
  bluexpress_retiro: "Retiro en sucursal — Bluexpress",
  retiro_tome: "Retiro en tienda en Tomé",
  otro: "Otro",
};

// Dónde termina el paquete. La dirección que hay que pedir depende de esto:
// la del cliente si va a domicilio, la de la sucursal si la retira él.
export type TipoEntrega = "domicilio" | "sucursal" | "tienda" | "indefinido";

export function tipoEntrega(metodo: string): TipoEntrega {
  if (metodo.endsWith("_domicilio")) return "domicilio";
  if (metodo.endsWith("_retiro")) return "sucursal";
  if (metodo === "retiro_tome") return "tienda";
  return "indefinido";
}

// "Retiro en sucursal — Starken" → "Starken". Sirve para nombrar la empresa
// en el campo de dirección sin duplicar la lista de couriers.
export function empresaEnvio(metodo: string): string | null {
  const label = METODO_ENVIO_LABELS[metodo as MetodoEnvio];
  if (!label) return null;
  const partes = label.split("—");
  if (partes.length < 2) return null;
  return (tipoEntrega(metodo) === "sucursal" ? partes[1] : partes[0]).trim();
}
