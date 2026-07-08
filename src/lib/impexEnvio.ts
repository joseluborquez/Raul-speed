// Cálculo del costo de envío DHL vía la API de cálculo de fletes de
// Impex Japan (mismo proveedor que src/lib/impex.ts, pero un endpoint
// distinto: no requiere key, solo país + peso/tamaño del paquete).
//
// Endpoint: GET https://api.impex-jp.com/delivery/calc.html
// Spec: https://en.impex-jp.com/assets/5b9ee13/apiEn.yaml
//
// Nota: si se envía productsPriceJPY, el priceJPY que devuelve cada
// transportista pasa a ser el TOTAL (repuesto + flete), no el flete
// solo. Como acá solo queremos el costo de flete, ese parámetro no se
// envía nunca.

const IMPEX_DELIVERY_API_URL = "https://api.impex-jp.com/delivery/calc.html";

// id de "new spare part" en GET /delivery/product-types.html — coincide
// con el type_id que trae siempre parts/search.html para original_parts.
const PRODUCT_TYPE_ID_REPUESTO_NUEVO = 9;

// 1 = "To Vladivostok" — el resto de valores es para envíos por
// Vladivostok con transportistas terrestres; para Chile no cambia el
// resultado, pero el parámetro es obligatorio para la API.
const TRANSPORT_COMPANY_TYPE_ID_DEFAULT = 1;

const PAIS_ISO_CHILE = "CL";

export interface PaqueteEnvio {
  pesoKg: number;
  largoCm?: number;
  anchoCm?: number;
  altoCm?: number;
}

/**
 * Consulta el costo de envío DHL (en JPY) para un paquete hacia Chile.
 * Devuelve null si DHL no aparece entre los transportistas disponibles
 * para ese peso/tamaño (ej. excede el límite de DHL).
 */
export async function calcularEnvioDhlJpy(paquete: PaqueteEnvio): Promise<number | null> {
  const params = new URLSearchParams({
    countryIso: PAIS_ISO_CHILE,
    productTypeId: String(PRODUCT_TYPE_ID_REPUESTO_NUEVO),
    transportCompanyTypeId: String(TRANSPORT_COMPANY_TYPE_ID_DEFAULT),
    lang: "en",
    "package[weight]": String(paquete.pesoKg),
  });
  if (paquete.largoCm) params.set("package[length]", String(paquete.largoCm));
  if (paquete.anchoCm) params.set("package[width]", String(paquete.anchoCm));
  if (paquete.altoCm) params.set("package[height]", String(paquete.altoCm));

  const resp = await fetch(`${IMPEX_DELIVERY_API_URL}?${params.toString()}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`Impex (envío) respondió con estado ${resp.status}`);

  const data = await resp.json();
  if (!Array.isArray(data)) throw new Error("Impex (envío): respuesta inesperada");

  const dhl = data.find((metodo) => metodo?.name === "DHL");
  return dhl ? Math.trunc(dhl.priceJPY) : null;
}
