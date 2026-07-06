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
