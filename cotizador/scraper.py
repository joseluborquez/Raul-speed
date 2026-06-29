"""
Cotizador OEM — 3 fuentes en cascada:
  1. Impex Japan API  (requests + API key)       ← PENDIENTE: confirmar endpoint
  2. Motors Head Japan / parts-sale.jp           (requests + BeautifulSoup)
  3. Yumbo Japan                                 (Playwright, acceso público)
"""

import logging
import random
import re
import time
from typing import Optional

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from config import (
    FUENTES_HABILITADAS,
    IMPEX_API_KEY,
    PARTS_SALE_URL,
    PROVEEDOR_ALTERNATIVO,
    SCRAPER,
)

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


# ---------------------------------------------------------------------------
# Utilidades comunes
# ---------------------------------------------------------------------------

def _delay(min_s: float = None, max_s: float = None) -> None:
    lo = min_s if min_s is not None else SCRAPER["delay_min"]
    hi = max_s if max_s is not None else SCRAPER["delay_max"]
    time.sleep(random.uniform(lo, hi))


def _normalizar(part_number: str) -> list[str]:
    """
    Devuelve variantes del N/P: con y sin guión.
    "90915-YZZD4" → ["90915-YZZD4", "90915YZZD4"]
    "90915YZZD4"  → ["90915YZZD4", "90915-YZZD4"]
    """
    pn = part_number.strip().upper()
    variantes = [pn]
    if "-" in pn:
        variantes.append(pn.replace("-", ""))
    else:
        # Insertar guión después de los primeros 5 dígitos numéricos
        m = re.match(r'^(\d{5})([A-Z0-9]+)$', pn)
        if m:
            variantes.append(f"{m.group(1)}-{m.group(2)}")
    return variantes


# ---------------------------------------------------------------------------
# Fuente 1: Impex Japan API
# ---------------------------------------------------------------------------

_IMPEX_API_URL = "https://www.impex-jp.com/api/parts/search.html"


def buscar_impex_api(part_number: str) -> Optional[dict]:
    """
    Busca precio OEM en Impex Japan via API oficial.

    Endpoint: GET https://www.impex-jp.com/api/parts/search.html
    Auth:     query param key=API_KEY
    Búsqueda: query param part_no=NUMERO_PARTE
    Solo se toman original_parts con price_yen > 0 y is_discontinued == False.
    """
    if not IMPEX_API_KEY:
        logger.warning("IMPEX_API_KEY vacía — saltando fuente Impex API.")
        return None

    for variante in _normalizar(part_number):
        resultado = _impex_api_fetch(variante)
        if resultado:
            return resultado

    return None


def _impex_api_fetch(part_number: str) -> Optional[dict]:
    params = {
        "key":            IMPEX_API_KEY,
        "part_no":        part_number,
        "original_only":  0,
        "price_factor":   1,
        "price_increase": 0,
    }
    headers = {**_HEADERS, "accept": "application/json"}

    try:
        logger.info(f"[impex-api] GET {_IMPEX_API_URL}?part_no={part_number}")
        resp = requests.get(_IMPEX_API_URL, params=params, headers=headers, timeout=20)
        resp.raise_for_status()
        data = resp.json()

        for part in data.get("original_parts", []):
            if part.get("is_discontinued"):
                continue

            precio_jpy = part.get("price_yen", 0)
            if not precio_jpy or precio_jpy <= 0:
                continue

            maker   = part.get("mark", "")
            nombre  = part.get("name_eng") or part.get("name", "")
            part_no = part.get("part", part_number)

            logger.info(f"[impex-api] OEM: {maker} {part_no} → ¥{int(precio_jpy):,}")
            return {
                "precio_jpy": int(precio_jpy),
                "fuente":     "impex-jp.com",
                "maker":      maker,
                "nombre":     nombre,
                "es_genuino": True,
            }

        logger.info(f"[impex-api] Sin OEM disponible para '{part_number}'")
        return None

    except requests.HTTPError as exc:
        logger.warning(f"[impex-api] HTTP {exc.response.status_code}: {exc}")
        return None
    except Exception as exc:
        logger.warning(f"[impex-api] Error: {exc}")
        return None


# ---------------------------------------------------------------------------
# Fuente 2: Motors Head Japan — parts-sale.jp  (requests + BeautifulSoup)
# ---------------------------------------------------------------------------

def buscar_parts_sale(part_number: str) -> Optional[dict]:
    """Scraping limpio de parts-sale.jp. Solo acepta piezas 'Genuine'."""
    session = requests.Session()
    session.headers.update(_HEADERS)

    for variante in _normalizar(part_number):
        resultado = _parts_sale_fetch(session, variante)
        if resultado:
            return resultado
        _delay()

    return None


def _parts_sale_fetch(session: requests.Session, part_number: str) -> Optional[dict]:
    urls = [
        f"{PARTS_SALE_URL}/{part_number}",
        f"{PARTS_SALE_URL}/index.php?route=product/search&search={part_number}",
    ]

    for url in urls:
        try:
            logger.info(f"[parts-sale] GET {url}")
            resp = session.get(url, timeout=20)
            if resp.status_code != 200:
                logger.debug(f"[parts-sale] HTTP {resp.status_code} — {url}")
                continue

            soup = BeautifulSoup(resp.text, "lxml")
            resultado = _parse_parts_sale(soup, part_number)
            if resultado:
                return resultado

        except Exception as exc:
            logger.warning(f"[parts-sale] Error en {url}: {exc}")

    return None


def _parse_parts_sale(soup: BeautifulSoup, part_number: str) -> Optional[dict]:
    """
    Intenta extraer precio de página de listado o de producto directo.
    Solo acepta resultados con texto 'Genuine'.

    Nota: selectores CSS a ajustar según inspección real del sitio.
    """
    # Página de listado (varios productos)
    productos = soup.select(".product-thumb, .product-layout, article.product")
    if productos:
        for prod in productos:
            if "genuine" not in prod.get_text(" ", strip=True).lower():
                continue
            precio = _extraer_precio_jpy(prod)
            if precio:
                nombre = _extraer_nombre_producto(prod, part_number)
                logger.info(f"[parts-sale] Genuine: {nombre} → ¥{precio:,}")
                return {
                    "precio_jpy": precio,
                    "fuente":     "parts-sale.jp",
                    "nombre":     nombre,
                    "maker":      "",
                    "es_genuino": True,
                }
        return None

    # Página de producto directo
    text = soup.get_text(" ", strip=True).lower()
    if "genuine" not in text:
        return None

    precio = _extraer_precio_jpy(soup)
    if not precio:
        return None

    titulo = soup.find("title")
    nombre = titulo.get_text(strip=True) if titulo else part_number
    logger.info(f"[parts-sale] Producto directo Genuine: {nombre} → ¥{precio:,}")
    return {
        "precio_jpy": precio,
        "fuente":     "parts-sale.jp",
        "nombre":     nombre,
        "maker":      "",
        "es_genuino": True,
    }


def _extraer_precio_jpy(element) -> Optional[int]:
    """
    Extrae precio JPY de un elemento BeautifulSoup.
    Formatos esperados: "¥1,234 JPY", "1,234 JPY", "1234 Ex Tax: 1120JPY"
    """
    text = element.get_text(" ", strip=True)
    m = re.search(r'[¥¥]?\s*([\d,]+)\s*(?:JPY|jpy|円)', text)
    if m:
        try:
            return int(m.group(1).replace(",", ""))
        except ValueError:
            pass
    # Fallback: primer número en rango razonable de precio JPY
    for n in re.findall(r'[\d,]{3,}', text):
        val = int(n.replace(",", ""))
        if 100 <= val <= 10_000_000:
            return val
    return None


def _extraer_nombre_producto(element, fallback: str) -> str:
    el = element.select_one(".name a, h4 a, h3 a, .product-name")
    return el.get_text(strip=True) if el else fallback


# ---------------------------------------------------------------------------
# Fuente 3: Yumbo Japan — Playwright (público, sin login)
# ---------------------------------------------------------------------------

def buscar_yumbo(part_number: str) -> Optional[dict]:
    """Scraping de Yumbo Japan con Playwright. Acceso público, sin autenticación."""
    base_url = PROVEEDOR_ALTERNATIVO.rstrip("/")

    for variante in _normalizar(part_number):
        resultado = _yumbo_playwright(base_url, variante)
        if resultado:
            return resultado

    return None


def _yumbo_playwright(base_url: str, part_number: str) -> Optional[dict]:
    search_url = f"{base_url}/parts/new/search.html?partNo={part_number}"
    logger.info(f"[yumbo] Buscando: {search_url}")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=SCRAPER["headless"])
        context = browser.new_context(
            user_agent=_HEADERS["User-Agent"],
            locale="en-US",
        )
        resultado = None
        try:
            page = context.new_page()
            _delay()
            page.goto(search_url, timeout=SCRAPER["timeout_ms"])
            page.wait_for_load_state("networkidle", timeout=SCRAPER["timeout_ms"])
            resultado = _yumbo_extraer(page, part_number)
        except Exception as exc:
            logger.warning(f"[yumbo] Error Playwright: {exc}")
        finally:
            context.close()
            browser.close()

    return resultado


def _yumbo_extraer(page, part_number: str) -> Optional[dict]:
    headings = page.query_selector_all("h2")
    if not any("genuine oem" in h.inner_text().lower() for h in headings):
        logger.info(f"[yumbo] Sin sección OEM para '{part_number}'")
        return None

    tables = page.query_selector_all("table")
    if not tables:
        return None

    for row in tables[0].query_selector_all("tr")[1:]:  # saltar encabezado
        celdas = row.query_selector_all("td")
        if len(celdas) < 5:
            continue

        precio_texto = celdas[4].inner_text().strip()
        if "not available" in precio_texto.lower():
            return None

        precio_jpy = _parse_yumbo_precio(precio_texto)
        if precio_jpy and precio_jpy > 0:
            maker  = celdas[0].inner_text().strip()
            nombre = celdas[2].inner_text().strip().splitlines()[0]
            logger.info(f"[yumbo] OEM encontrado: {maker} → ¥{precio_jpy:,}")
            return {
                "precio_jpy": precio_jpy,
                "fuente":     "yumbo-jp.com",
                "maker":      maker,
                "nombre":     nombre,
                "es_genuino": True,
            }

    return None


def _parse_yumbo_precio(texto: str) -> Optional[int]:
    """Extrae JPY del formato 'JP¥4,970\nUS$30.89'."""
    primera_linea = texto.strip().splitlines()[0]
    limpio = re.sub(r"[JP¥\s,]", "", primera_linea)
    try:
        return int(float(limpio))
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Punto de entrada público
# ---------------------------------------------------------------------------

def obtener_precio_oem(part_number: str) -> Optional[dict]:
    """
    Recorre FUENTES_HABILITADAS en orden y retorna el primer resultado válido.
    Si ninguna fuente responde, retorna None.
    """
    pn = part_number.strip().upper()

    for fuente in FUENTES_HABILITADAS:
        try:
            if fuente == "impex_api":
                resultado = buscar_impex_api(pn)
            elif fuente == "parts_sale":
                resultado = buscar_parts_sale(pn)
            elif fuente == "yumbo":
                resultado = buscar_yumbo(pn)
            else:
                logger.warning(f"Fuente desconocida en config: '{fuente}' — ignorando.")
                continue

            if resultado:
                logger.info(
                    f"Precio OEM encontrado en '{fuente}': ¥{resultado['precio_jpy']:,}"
                )
                return resultado

        except NotImplementedError as exc:
            logger.warning(f"Fuente '{fuente}' pendiente de implementar: {exc}")
        except Exception as exc:
            logger.error(f"Error en fuente '{fuente}': {exc}")

    logger.warning(f"Sin resultado OEM para '{pn}' en ninguna fuente.")
    return None
