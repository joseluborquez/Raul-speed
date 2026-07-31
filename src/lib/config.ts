// Configuración principal — leer valores sensibles desde variables de entorno.
// Ver .env.example para las claves requeridas.

// Impex Japan — única fuente de precios en vivo. La key se obtiene en el
// perfil web (https://en.impex-jp.com/user/profile/api-keys.html); el
// correo y la contraseña de esa cuenta no los usa el código, solo sirven
// para entrar al panel a ver el consumo o regenerar la key.
export const IMPEX_API_KEY = process.env.IMPEX_API_KEY ?? "";

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
