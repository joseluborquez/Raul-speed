import { createHmac } from "crypto";

/**
 * Firma de peticiones Flow: se ordenan las claves alfabéticamente, se
 * concatenan como clave+valor (sin separadores, sin incluir "s"), y se
 * calcula HMAC-SHA256 en hex con la secretKey.
 */
export function firmarParametrosFlow(
  params: Record<string, string>,
  secretKey: string,
): string {
  const claves = Object.keys(params)
    .filter((k) => k !== "s" && params[k] !== "")
    .sort();
  const concatenado = claves.map((k) => `${k}${params[k]}`).join("");
  return createHmac("sha256", secretKey).update(concatenado).digest("hex");
}
