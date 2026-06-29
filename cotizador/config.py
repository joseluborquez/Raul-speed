# ============================================================
#  CONFIGURACIÓN PRINCIPAL — editar aquí sin tocar otra lógica
# ============================================================

# Impex Japan API Key
# Obtener en: https://en.impex-jp.com/user/profile/api-keys.html
IMPEX_API_KEY = "SeWnTG_f_XwY5Q9Mazwy"

# Motors Head Japan
PARTS_SALE_URL = "https://www.parts-sale.jp"

# Yumbo Japan (fallback, acceso público — sin login)
PROVEEDOR_ALTERNATIVO = "https://yumbo-jp.com/en"

# Orden de cascada: se prueba en secuencia hasta encontrar precio
FUENTES_HABILITADAS = ["impex_api", "yumbo"]

# Fórmula de negocio: precio_JPY × tipo_cambio_CLP × mult_1 × mult_2
FORMULA = {
    "multiplicador_1": 1.1,
    "multiplicador_2": 2,
}

# Banco Central de Chile — API de tipo de cambio
# Registro gratuito: https://si3.bcentral.cl/estadisticas/Principal1/Web/BancoCentralAboutNosotros/registroUsuariosBCCH/index.php
BCENTRAL = {
    "user":       "BCENTRAL_USER_EMAIL",    # e-mail registrado en el Banco Central
    "pass":       "BCENTRAL_PASSWORD",      # contraseña del Banco Central
    "series_jpy": "F073.TCO.JPY.N.O.D",    # serie JPY → CLP (tipo de cambio observado)
}

# Comportamiento del scraper Playwright (Yumbo)
SCRAPER = {
    "delay_min":  1,       # segundos mínimos entre requests
    "delay_max":  2,       # segundos máximos entre requests
    "timeout_ms": 30_000,  # timeout de navegación en ms
    "headless":   True,    # False para ver el browser mientras trabaja
}
