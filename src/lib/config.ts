// Configuración principal — leer valores sensibles desde variables de entorno.
// Ver .env.example para las claves requeridas.

export const YUMBO_API_KEY = process.env.YUMBO_API_KEY ?? "";

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
