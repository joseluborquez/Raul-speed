// Configuración principal — leer valores sensibles desde variables de entorno.
// Ver .env.example para las claves requeridas.

export const YUMBO_API_KEY = process.env.YUMBO_API_KEY ?? "";

/**
 * Un multiplicador mal configurado no puede pasar a la fórmula: la env var
 * vacía da Number("") = 0 (→ todos los precios del sitio en $0) y un typo
 * con coma decimal da NaN. En ambos casos se usa el default y se avisa por
 * log, en vez de cotizar mal en silencio.
 */
function multiplicadorDesdeEnv(nombre: string, porDefecto: number): number {
  const raw = process.env[nombre];
  if (raw === undefined || raw === "") return porDefecto;

  const valor = Number(raw);
  if (!Number.isFinite(valor) || valor <= 0) {
    console.error(
      `${nombre}="${raw}" no es un multiplicador válido — usando el default ${porDefecto}`,
    );
    return porDefecto;
  }
  return valor;
}

// Fórmula de negocio: precio_JPY × tipo_cambio_CLP × mult_1 × mult_2
export const FORMULA = {
  multiplicador1: multiplicadorDesdeEnv("FORMULA_MULTIPLICADOR_1", 1.1),
  multiplicador2: multiplicadorDesdeEnv("FORMULA_MULTIPLICADOR_2", 2),
};

// Banco Central de Chile — API de tipo de cambio.
// Registro gratuito: https://si3.bcentral.cl/estadisticas/Principal1/Web/BancoCentralAboutNosotros/registroUsuariosBCCH/index.php
export const BCENTRAL = {
  user: process.env.BCENTRAL_USER ?? "",
  pass: process.env.BCENTRAL_PASS ?? "",
  seriesJpy: process.env.BCENTRAL_SERIES_JPY ?? "F072.CLP.JPY.N.O.D",
  /** Dólar Observado — serie pública estándar del Banco Central, usada
   * para convertir a CLP el precio en USD de Base_Cotizador_RaulSpeed_COMPLETA.csv
   * (ver importarBaseCompleta.mjs / getUsdToClp() en calculator.ts). */
  seriesUsd: process.env.BCENTRAL_SERIES_USD ?? "F073.TCO.PRE.Z.D",
};
