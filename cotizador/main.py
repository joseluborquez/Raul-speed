"""
Punto de entrada del cotizador de repuestos OEM.

Uso desde Python:
    from main import cotizar
    resultado = cotizar("90915-YZZD4")

Uso desde consola:
    python main.py 90915-YZZD4
"""

import logging
import sys
from datetime import date

from calculator import get_jpy_to_clp, calcular_precio_clp
from scraper import obtener_precio_oem

# Configurar logging (nivel INFO por defecto; cambiar a DEBUG para más detalle)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Función principal
# ---------------------------------------------------------------------------

def cotizar(part_number: str, tipo_cambio_override: float = None) -> dict:
    """
    Cotiza una pieza OEM dado su número de parte.

    Args:
        part_number: Número de parte OEM (ej. "90915-YZZD4")

    Returns:
        dict con el resultado de la cotización.
    """
    part_number = part_number.strip().upper()
    logger.info(f"=== Iniciando cotización para: {part_number} ===")

    # ------------------------------------------------------------------
    # 1. Obtener precio JPY desde el proveedor
    # ------------------------------------------------------------------
    resultado_scraper = obtener_precio_oem(part_number)

    if resultado_scraper is None:
        logger.warning(f"Pieza no encontrada: {part_number}")
        return {
            "part_number":      part_number,
            "estado":           "no_encontrado",
            "mensaje":          "Repuesto no encontrado o sin stock",
            "fecha":            date.today().isoformat(),
        }

    precio_jpy = resultado_scraper["precio_jpy"]
    fuente      = resultado_scraper["fuente"]
    logger.info(f"Precio OEM obtenido: ¥{precio_jpy} JPY (fuente: {fuente})")

    # ------------------------------------------------------------------
    # 2. Obtener tipo de cambio JPY → CLP
    # ------------------------------------------------------------------
    if tipo_cambio_override:
        tipo_cambio = float(tipo_cambio_override)
        fuente_tc   = "Manual (administrador)"
        logger.info(f"Usando tipo de cambio manual: {tipo_cambio} CLP/JPY")
    else:
        try:
            tipo_cambio, fuente_tc = get_jpy_to_clp()
        except RuntimeError as exc:
            logger.error(f"Error al obtener tipo de cambio: {exc}")
            return {
                "part_number": part_number,
                "estado":      "error_tipo_cambio",
                "mensaje":     str(exc),
                "precio_jpy":  precio_jpy,
                "fuente":      fuente,
                "fecha":       date.today().isoformat(),
            }

    # ------------------------------------------------------------------
    # 3. Aplicar fórmula de negocio
    # ------------------------------------------------------------------
    precio_clp_final = calcular_precio_clp(precio_jpy, tipo_cambio)

    resultado = {
        "part_number":        part_number,
        "estado":             "ok",
        "maker":              resultado_scraper.get("maker", ""),
        "nombre":             resultado_scraper.get("nombre", ""),
        "precio_jpy":         precio_jpy,
        "tipo_cambio_clp":    round(tipo_cambio, 6),
        "fuente_tipo_cambio": fuente_tc,
        "precio_clp_final":   precio_clp_final,
        "fuente":             fuente,
        "es_genuino":         resultado_scraper.get("es_genuino", True),
        "fecha":              date.today().isoformat(),
    }

    logger.info(
        f"=== Resultado final: {part_number} → "
        f"${precio_clp_final:,} CLP ==="
    )
    return resultado


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _print_resultado(r: dict) -> None:
    print("\n" + "=" * 50)
    print(f"  Número de parte : {r['part_number']}")
    print(f"  Estado          : {r['estado']}")
    if r["estado"] == "ok":
        print(f"  Precio JPY      : ¥{r['precio_jpy']:,}")
        print(f"  Tipo cambio CLP : {r['tipo_cambio_clp']} CLP/JPY")
        print(f"  Fuente TC       : {r['fuente_tipo_cambio']}")
        print(f"  Precio final CLP: ${r['precio_clp_final']:,}")
        print(f"  Fuente          : {r['fuente']}")
    else:
        print(f"  Mensaje         : {r.get('mensaje', '')}")
    print(f"  Fecha           : {r['fecha']}")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python main.py <número-de-parte>")
        print("Ejemplo: python main.py 90915-YZZD4")
        sys.exit(1)

    part = sys.argv[1]
    resultado = cotizar(part)
    _print_resultado(resultado)
