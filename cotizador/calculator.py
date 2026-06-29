"""
Conversión de moneda (JPY → CLP) y fórmula de negocio.
"""

import logging
import re
from datetime import date, timedelta
from typing import Optional

import requests

from config import BCENTRAL, FORMULA

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tipo de cambio JPY → CLP
# ---------------------------------------------------------------------------

def _fetch_rate_bcentral(fecha: date) -> Optional[float]:
    """
    Consulta el Banco Central de Chile para obtener JPY → CLP.
    El Banco Central publica el tipo de cambio en CLP por 100 JPY,
    por eso se divide el resultado entre 100.
    """
    url = "https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx"
    fecha_str = fecha.strftime("%Y-%m-%d")
    params = {
        "user":       BCENTRAL["user"],
        "pass":       BCENTRAL["pass"],
        "function":   "GetSeries",
        "timeseries": BCENTRAL["series_jpy"],
        "firstdate":  fecha_str,
        "lastdate":   fecha_str,
    }

    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        # Estructura: {"Series": {"Obs": [{"StatusCode": "OK", "value": "8.22"}]}}
        obs_list = data.get("Series", {}).get("Obs", [])
        for obs in obs_list:
            if obs.get("StatusCode") == "OK":
                raw_value = float(obs["value"].replace(",", "."))
                # El Banco Central publica JPY/CLP como CLP por 100 JPY
                rate_per_jpy = raw_value / 100.0
                logger.info(
                    f"Banco Central: 1 JPY = {rate_per_jpy:.6f} CLP "
                    f"(fuente: {fecha_str})"
                )
                return rate_per_jpy

        logger.warning(f"Sin datos del Banco Central para {fecha_str}.")
        return None

    except Exception as exc:
        logger.warning(f"Error al consultar Banco Central: {exc}")
        return None


def _fetch_rate_fallback() -> Optional[float]:
    """
    Fallback: obtiene JPY/CLP desde la API pública de exchangerate-api.
    No requiere credenciales. Se usa cuando el Banco Central falla.
    """
    try:
        # Convertir JPY a USD y luego USD a CLP
        resp = requests.get(
            "https://open.er-api.com/v6/latest/JPY",
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("result") != "success":
            logger.warning("Respuesta inesperada de exchangerate-api.")
            return None

        clp_per_jpy = data["rates"].get("CLP")
        if clp_per_jpy:
            logger.info(f"Fallback exchangerate-api: 1 JPY = {clp_per_jpy:.6f} CLP")
            return float(clp_per_jpy)

        return None

    except Exception as exc:
        logger.warning(f"Error en fallback de tipo de cambio: {exc}")
        return None


def get_jpy_to_clp() -> tuple[float, str]:
    """
    Retorna (tasa_JPY_a_CLP, fuente).
    Intenta primero el Banco Central; si falla, usa exchangerate-api.
    Busca hasta 5 días hábiles anteriores si el día actual no tiene datos.
    """
    today = date.today()

    # Intentar primero con fecha de hoy y retroceder hasta 5 días (fines de semana/feriados)
    for delta in range(5):
        fecha = today - timedelta(days=delta)
        rate = _fetch_rate_bcentral(fecha)
        if rate is not None:
            return rate, f"Banco Central Chile ({fecha})"

    # Fallback a API pública
    logger.warning("Banco Central no disponible — usando exchangerate-api como fallback.")
    rate = _fetch_rate_fallback()
    if rate is not None:
        return rate, f"exchangerate-api.com ({today})"

    raise RuntimeError(
        "No se pudo obtener el tipo de cambio JPY/CLP. "
        "Verifica credenciales del Banco Central en config.py."
    )


# ---------------------------------------------------------------------------
# Parser de precio JPY desde texto
# ---------------------------------------------------------------------------

def parse_jpy_price(texto: str) -> Optional[int]:
    """
    Extrae el valor numérico de una cadena de precio en JPY.
    Acepta formatos: "¥1,234", "JPY 1234", "1,234円", "1234"
    Retorna el entero en JPY o None si no se puede parsear.
    """
    if not texto:
        return None

    # Eliminar símbolos de moneda y espacios
    limpio = re.sub(r"[¥￥円JPY\s]", "", texto.upper())
    # Eliminar separadores de miles (coma)
    limpio = limpio.replace(",", "")

    try:
        return int(float(limpio))
    except ValueError:
        logger.warning(f"No se pudo parsear el precio: '{texto}'")
        return None


# ---------------------------------------------------------------------------
# Fórmula de negocio
# ---------------------------------------------------------------------------

def calcular_precio_clp(precio_jpy: int, tipo_cambio: float) -> int:
    """
    Aplica la fórmula de negocio:
        precio_base_JPY × tipo_cambio_CLP × multiplicador_1 × multiplicador_2

    Retorna el precio final redondeado al entero más cercano en CLP.
    """
    mult1 = FORMULA["multiplicador_1"]
    mult2 = FORMULA["multiplicador_2"]

    precio_clp = precio_jpy * tipo_cambio * mult1 * mult2

    logger.debug(
        f"Cálculo: {precio_jpy} JPY × {tipo_cambio:.6f} × {mult1} × {mult2} "
        f"= {precio_clp:.2f} CLP"
    )

    return round(precio_clp)
