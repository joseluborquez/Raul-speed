// Sobrecargo por envío — tabla de reglas fija (peso + nombre + precio).
// Reemplaza al flujo anterior de cotización en vivo vía la API de flete DHL
// (src/lib/impexEnvio.ts, retirado): acá no se llama a ningún proveedor,
// todo se resuelve con los datos que ya trae el proveedor de precios.
//
// Por cada pieza se revisan los 5 pasos en orden; apenas uno se cumple, se
// aplica su resultado y no se siguen evaluando los siguientes.

export const PESO_INCLUIDO_KG = 0.5;
export const COBRO_KILO_EXTRA_CLP = 22_000;
export const PESO_MAXIMO_KG = 4;
export const PRECIO_SEGURO_SIN_PESO_CLP = 30_000;
export const PESO_MINIMO_IGNORAR_LISTA_A_KG = 0.2;

// Lista abierta: se agregan palabras/frases cuando aparezcan casos nuevos.
// Ojo: nunca "SEAT" o "FORK" solos (atrapan piezas de válvula / horquillas de
// cambio) — siempre acompañados de ASSY/COMP.
export const LISTA_A_PALABRAS: string[] = [
  "COWL",
  "COWLING",
  "FAIRING",
  "FENDER",
  "TANK",
  "HEADLIGHT",
  "HEADLAMP",
  "MUFFLER",
  "EXHAUST PIPE",
  "RADIATOR",
  "SWINGARM",
  "WHEEL",
  "TIRE",
  "FRAME",
  "SHELTER",
  "SEAT ASSY",
  "SEAT COMP",
  "FORK ASSY",
  "HANDLEBAR",
  "HANDLE BAR",
  "FAT BAR",
  "SCREEN",
  "WINDSCREEN",
  "DUCT",
  "SHROUD",
];

/**
 * Además de las palabras de LISTA_A_PALABRAS, cubre "SIDE COVER": en el
 * catálogo real aparece invertido ("COVER, R. SIDE"), así que se exige que
 * el nombre tenga SIDE y COVER presentes en cualquier orden, no la frase
 * exacta.
 */
export function coincideListaA(nombre: string): boolean {
  const n = (nombre || "").toUpperCase();
  if (LISTA_A_PALABRAS.some((palabra) => n.includes(palabra))) return true;
  return n.includes("SIDE") && n.includes("COVER");
}

export type ResultadoEnvio = "estandar" | "extra_automatico" | "alerta_whatsapp";

export interface ClasificacionEnvio {
  resultado: ResultadoEnvio;
  /** Monto en CLP a sumar al precio del repuesto. 0 salvo en "extra_automatico". */
  extraClp: number;
  mensaje: string;
}

const MENSAJE_ESTANDAR = "✓ Envío estándar incluido";

const MENSAJE_ALERTA =
  "Envío a cotizar — Por su tamaño o peso, esta pieza requiere cotización de envío " +
  "personalizada. Escríbenos y te confirmamos el total antes de tu compra.";

function mensajeExtra(pesoKg: number, montoClp: number): string {
  return `Esta pieza pesa ${pesoKg} kg y supera el tamaño estándar. Se suman $${montoClp.toLocaleString("es-CL")} al precio final.`;
}

function estandar(): ClasificacionEnvio {
  return { resultado: "estandar", extraClp: 0, mensaje: MENSAJE_ESTANDAR };
}

function alerta(): ClasificacionEnvio {
  return { resultado: "alerta_whatsapp", extraClp: 0, mensaje: MENSAJE_ALERTA };
}

function extraAutomatico(pesoKg: number): ClasificacionEnvio {
  const monto = Math.ceil(((pesoKg - PESO_INCLUIDO_KG) * COBRO_KILO_EXTRA_CLP) / 1000) * 1000;
  return { resultado: "extra_automatico", extraClp: monto, mensaje: mensajeExtra(pesoKg, monto) };
}

export interface DatosClasificacion {
  nombre: string;
  /** 0 = sin peso registrado por el proveedor. */
  pesoKg: number;
  precioRepuestoClp: number;
}

/**
 * Clasifica el envío de una pieza según los 5 pasos del PDF
 * "Sobrecargo por envío — Raul Speed". Ver src/lib/sobrecargoEnvio.ts
 * para las constantes y la Lista A.
 */
export function clasificarEnvio(datos: DatosClasificacion): ClasificacionEnvio {
  const { nombre, pesoKg, precioRepuestoClp } = datos;

  // Paso 1 / 1b
  if (coincideListaA(nombre)) {
    const excepcionPesoBajo = pesoKg > 0 && pesoKg <= PESO_MINIMO_IGNORAR_LISTA_A_KG;
    if (!excepcionPesoBajo) {
      return alerta();
    }
    // 1b: cae al paso 2 igual, no se retorna acá.
  }

  // Paso 2 / 2b — solo aplica si no hay peso registrado.
  if (pesoKg === 0) {
    return precioRepuestoClp <= PRECIO_SEGURO_SIN_PESO_CLP ? estandar() : alerta();
  }

  // Paso 3
  if (pesoKg <= PESO_INCLUIDO_KG) {
    return estandar();
  }

  // Paso 4
  if (pesoKg > PESO_MAXIMO_KG) {
    return alerta();
  }

  // Paso 5 — peso entre 0,5 y 4 kg.
  return extraAutomatico(pesoKg);
}
