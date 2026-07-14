// Configuración principal — leer valores sensibles desde variables de entorno.
// Ver .env.example para las claves requeridas.

export const YUMBO_API_KEY = process.env.YUMBO_API_KEY ?? "";

// Fórmula de negocio: precio_JPY × tipo_cambio_CLP × mult_1 × mult_2
export const FORMULA = {
  multiplicador1: Number(process.env.FORMULA_MULTIPLICADOR_1 ?? 1.1),
  multiplicador2: Number(process.env.FORMULA_MULTIPLICADOR_2 ?? 2),
};

// Banco Central de Chile — API de tipo de cambio.
// Registro gratuito: https://si3.bcentral.cl/estadisticas/Principal1/Web/BancoCentralAboutNosotros/registroUsuariosBCCH/index.php
export const BCENTRAL = {
  user: process.env.BCENTRAL_USER ?? "",
  pass: process.env.BCENTRAL_PASS ?? "",
  seriesJpy: process.env.BCENTRAL_SERIES_JPY ?? "F072.CLP.JPY.N.O.D",
};
