// Cotizador OEM — fuente: Impex Japan API.
//
// Tercera vuelta con este proveedor. Historial, porque explica cada
// resguardo de este archivo:
//   1. Se usó primero y se retiró cuando la cuenta empezó a devolver
//      {"error":"contact with manager"} para todo (commit 7212e05).
//   2. Se migró a Yumbo, que agotó su propia cuota.
//   3. Se volvió a Impex con caché/breaker/rate limit (commit 04fcc6d), y
//      se retiró de nuevo: bloqueaba el tráfico que sale de la red de
//      Vercel — mismo N/P y mismo minuto, fallaba desde Vercel y
//      funcionaba desde una IP normal (commit d830e72).
//
// Ahora vuelve con una cuenta nueva de 500 consultas/día, como ÚNICO
// proveedor en vivo (Yumbo se retiró). El respaldo ya no es otro
// proveedor sino repuestos_catalogo — ver cotizar.ts.
//
// Cuatro resguardos, cada uno para un modo de falla distinto:
//   - priceCache.ts        — no volver a preguntar lo ya preguntado.
//   - priceQuota.ts        — no pasarse de las 500/día (compartido).
//   - rateLimit.ts         — no ráfagas (best-effort, por instancia).
//   - priceCircuitBreaker.ts — dejar de insistir cuando ya está fallando.
//
// Endpoint: GET https://www.impex-jp.com/api/parts/search.html
// Auth:     query param key=API_KEY (la key se saca del perfil web, en
//           https://en.impex-jp.com/user/profile/api-keys.html; el
//           usuario/contraseña de esa cuenta NO los usa el código)
// Búsqueda: query param part_no=NUMERO_PARTE

import { IMPEX_API_KEY } from "./config";
import { getCache, setCache, type ResultadoPrecioProveedor } from "./priceCache";
import { isPaused, recordFailure, recordSuccess } from "./priceCircuitBreaker";
import { consumirCuota, LIMITE_DIARIO_IMPEX } from "./priceQuota";
import { rateLimitExcedido } from "./rateLimit";

const PROVIDER = "impex";
const IMPEX_API_URL = "https://www.impex-jp.com/api/parts/search.html";

// Límite propio de ráfaga, best-effort en memoria (ver rateLimit.ts). Más
// bajo que el 20 que tenía antes: ahora el cotizador llama a Impex en
// TODAS las cotizaciones (ya no solo la primera vez por código), y a 20
// por minuto las 500 diarias se queman en menos de media hora. El tope
// duro real es la cuota diaria; esto solo corta las ráfagas.
const LIMITE_LLAMADAS_POR_MINUTO = 10;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  accept: "application/json",
};

interface ImpexParte {
  /** N/P completo tal como lo lista Impex, con guiones (ej. "53170-MEL-305"). */
  part?: string;
  /** El mismo N/P sin guiones (ej. "53170MEL305"). */
  part_no_raw?: string;
  mark?: string;
  name?: string;
  name_eng?: string;
  weight?: number;
  price_yen: number;
  is_discontinued: boolean;
}

function sinGuiones(pn: string): string {
  return pn.replaceAll("-", "").trim().toUpperCase();
}

/**
 * Devuelve variantes del N/P probando los formatos de guión más comunes
 * en repuestos OEM japoneses:
 * - 2 segmentos (Toyota/Suzuki/Kawasaki): 5 caracteres + resto.
 *   "13089-1075" → ["13089-1075", "130891075"]
 *   "130891075"  → ["130891075", "13089-1075"]
 * - 3 segmentos (Yamaha): código de modelo (3) + básico (5) + diseño (2).
 *   "4XV-25384-00" → ["4XV-25384-00", "4XV2538400"]
 *   "4XV2538400"   → ["4XV2538400", "4XV25-38400" (2 seg.), "4XV-25384-00" (3 seg.)]
 *
 * Ojo con la cuota: cada variante que se prueba es una llamada que Impex
 * cobra. Un código que existe suele resolverse en la primera; uno que no
 * existe cuesta las tres. Por eso setCache() guarda también los no
 * encontrados (ver TTL_NO_ENCONTRADO_MS en priceCache.ts).
 */
function normalizar(partNumber: string): string[] {
  const pn = partNumber.trim().toUpperCase();
  const variantes = new Set<string>([pn]);

  if (pn.includes("-")) {
    variantes.add(pn.replaceAll("-", ""));
  } else {
    if (pn.length > 5) {
      variantes.add(`${pn.slice(0, 5)}-${pn.slice(5)}`);
    }
    if (pn.length === 10) {
      variantes.add(`${pn.slice(0, 3)}-${pn.slice(3, 8)}-${pn.slice(8)}`);
    }
  }

  return [...variantes];
}

/**
 * Busca precio OEM en Impex Japan vía API oficial.
 *
 * Devuelve null SOLO cuando el proveedor respondió limpio y la pieza no
 * existe (o está descontinuada). Cualquier otra cosa —sin key, cuota
 * agotada, circuito abierto, error de red— lanza: para cotizar.ts la
 * diferencia es crítica, porque "no existe" se le informa al cliente y
 * "no pude preguntar" cae al respaldo de la base de datos.
 */
export async function buscarImpex(partNumber: string): Promise<ResultadoPrecioProveedor | null> {
  if (!IMPEX_API_KEY) {
    throw new Error("IMPEX_API_KEY no está configurada");
  }

  const clave = partNumber.trim().toUpperCase();

  const cacheado = await getCache(PROVIDER, clave);
  if (cacheado) return cacheado.resultado;

  const circuito = await isPaused(PROVIDER);
  if (circuito.pausado) {
    const minutos = circuito.pausadoHasta
      ? Math.ceil((circuito.pausadoHasta.getTime() - Date.now()) / 60_000)
      : null;
    throw new Error(
      `Proveedor de precios pausado temporalmente por exceso de consultas.` +
        (minutos ? ` Reintenta en ~${minutos} min.` : ""),
    );
  }

  // Si una variante (ej. sin el guión que puso el cliente) devuelve un
  // error de Impex, no hay que rendirse ahí: puede que la otra variante
  // (con el guión en la posición correcta) sí encuentre la pieza. Solo se
  // propaga un error si TODAS las variantes fallaron con error — si
  // alguna respondió limpio (encontrada o no), esa respuesta manda.
  let resultado: ResultadoPrecioProveedor | null = null;
  let huboRespuestaLimpia = false;
  let ultimoError: Error | null = null;

  for (const variante of normalizar(clave)) {
    try {
      resultado = await impexApiFetch(variante);
      huboRespuestaLimpia = true;
      if (resultado) break;
    } catch (exc) {
      ultimoError = exc instanceof Error ? exc : new Error(String(exc));
    }
  }

  if (!resultado && !huboRespuestaLimpia && ultimoError) {
    throw ultimoError;
  }

  await setCache(PROVIDER, clave, resultado);
  return resultado;
}

async function impexApiFetch(partNumber: string): Promise<ResultadoPrecioProveedor | null> {
  if (rateLimitExcedido("impex-global", LIMITE_LLAMADAS_POR_MINUTO, 60_000)) {
    throw new Error("Límite propio de consultas a Impex alcanzado. Reintenta en un minuto.");
  }

  // Después del límite por minuto y antes del fetch: si la ráfaga ya se
  // cortó arriba, esa llamada no se cuenta contra la cuota del día.
  if (!(await consumirCuota(PROVIDER, LIMITE_DIARIO_IMPEX))) {
    throw new Error("Cuota diaria de consultas a Impex agotada.");
  }

  const params = new URLSearchParams({
    key: IMPEX_API_KEY,
    part_no: partNumber,
    original_only: "0",
    price_factor: "1",
    price_increase: "0",
  });

  let resp: Response;
  try {
    resp = await fetch(`${IMPEX_API_URL}?${params.toString()}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (exc) {
    const mensaje = exc instanceof Error ? exc.message : String(exc);
    await recordFailure(PROVIDER, null, mensaje);
    throw exc;
  }

  if (!resp.ok) {
    await recordFailure(PROVIDER, resp.status, `Impex respondió con estado ${resp.status}`);
    throw new Error(`Impex respondió con estado ${resp.status}`);
  }

  const data = await resp.json();

  // Impex puede responder 200 con un {"error": "..."} en vez de resultados
  // (ej. clave suspendida, cuenta marcada para revisión) — eso no es lo
  // mismo que "no encontrado" y no debe tratarse como tal. Es también la
  // firma exacta del bloqueo a IPs de datacenter que sacó a Impex la vez
  // pasada ("contact with manager"): si vuelve a aparecer, el circuit
  // breaker se abre y el cotizador pasa a servir desde la base de datos.
  if (data?.error) {
    await recordFailure(PROVIDER, resp.status, `Impex: ${data.error}`);
    throw new Error(`Impex: ${data.error}`);
  }

  await recordSuccess(PROVIDER);

  const partes: ImpexParte[] = data?.original_parts ?? [];

  // Impex hace coincidencia PARCIAL: preguntar por "53170-MEL" (un N/P al
  // que le falta el sufijo de diseño) devuelve 53170-MEL-305 Y
  // 53170-MEL-006 — piezas distintas, con precios distintos. Quedarse con
  // la primera es cotizar y cobrar un repuesto que después nadie puede
  // identificar: pasó con el pedido cfe3ea29, que quedó pagado con
  // "53170-MEL" como N/P y sin nombre.
  //
  // Por eso solo cuentan las filas cuyo número, sin guiones, es
  // exactamente el consultado. Si no queda ninguna, para el cotizador la
  // pieza no existe (null) y el cliente cae al flujo de solicitud manual,
  // que es lo correcto para un código incompleto: alguien tiene que
  // preguntarle cuál de las variantes quiere.
  //
  // Comparar contra `partNumber` sirve para cualquier variante de
  // normalizar(): todas son el mismo código y solo cambian de guiones.
  const objetivo = sinGuiones(partNumber);
  const candidatas = partes.filter(
    (parte) =>
      !parte.is_discontinued &&
      parte.price_yen > 0 &&
      sinGuiones(parte.part_no_raw || parte.part || "") === objetivo,
  );
  if (candidatas.length === 0) return null;

  // Un mismo N/P puede venir listado más de una vez (ej. bajo "HONDA" y
  // bajo "HONDA MOTO"), y esas filas no traen los mismos datos: la de
  // 53170-MEL-305 en "HONDA" viene sin nombre y con peso 0, la de "HONDA
  // MOTO" trae los dos. El precio y la marca salen de la primera —es la
  // que el proveedor lista de entrada, y tomar otra movería el precio de
  // venta—, pero el nombre y el peso que le falten se completan desde las
  // otras filas del MISMO número: es la misma pieza física, así que el
  // dato es válido. Sin esto el repuesto sale sin nombre y
  // clasificarEnvio() queda trabajando a ciegas con peso 0.
  const elegida = candidatas[0];
  const conNombre = candidatas.find((parte) => (parte.name_eng || parte.name || "").trim());
  const conPeso = candidatas.find((parte) => Number(parte.weight) > 0);

  const fuenteNombre = (elegida.name_eng || elegida.name || "").trim() ? elegida : conNombre;
  const nombre = fuenteNombre?.name_eng || fuenteNombre?.name || "";
  // nombreNativo solo se llena cuando hay una segunda variante genuina
  // que evaluar (si no hay name_eng, `nombre` ya es la nativa — no hay
  // nada que duplicar). Lo usa clasificarEnvio() (Filtros v10): un
  // código puede venir solo en japonés y evaluar ambos nombres evita
  // perder esa señal.
  const nombreNativo =
    fuenteNombre?.name_eng && fuenteNombre.name && fuenteNombre.name !== fuenteNombre.name_eng
      ? fuenteNombre.name
      : null;

  return {
    precioJpy: Math.trunc(elegida.price_yen),
    fuente: "impex-jp.com",
    maker: elegida.mark ?? "",
    nombre,
    nombreNativo,
    esGenuino: true,
    pesoKg: Number(elegida.weight) || Number(conPeso?.weight) || 0,
  };
}
