// Sobrecargo por envío — tabla de reglas fija (peso + nombre + precio +
// calidad del dato). Versión v10 (ver Filtros_Cotizador_FINAL_v10.PDF):
// calibrada contra los 63.542 pesos reales de la Base Madre y verificada
// dos veces en vivo contra 49 códigos reales en Yumbo (el documento la
// llama "Jumbo" por un typo — es el mismo proveedor de src/lib/yumbo.ts).
//
// Tres cosas que la verificación real confirmó:
// - Yumbo casi nunca trae peso (0 de 49 códigos en la verificación) — el
//   peso que realmente decide es el de repuestos_catalogo (peso_kg_manual),
//   no el que reporta el proveedor.
// - El catálogo real habla inglés (+ katakana japonés en Suzuki), nunca
//   español — la capa en español de las listas es un seguro barato para
//   si algún día cambia la fuente de datos, no aporta valor hoy.
// - La capa en japonés/katakana (Fase 2, no incluida acá) solo hacía
//   falta en 3 de 49 códigos verificados — el inglés resuelve el resto.
//
// No se llama a ningún proveedor de flete: todo se resuelve con los datos
// que ya trae el proveedor de precios + el catálogo (peso_kg_manual,
// oem_valido, nombre_confiable, fuente_peso — ver repuestosCatalogo.ts).

export const PESO_INCLUIDO_KG = 0.5;
export const COBRO_KILO_EXTRA_CLP = 22_000;
export const PESO_MAXIMO_KG = 4;
export const PRECIO_SEGURO_SIN_PESO_CLP = 30_000;
/**
 * Bajo este peso, ni siquiera una pieza VOLUMINOSA por nombre alarma.
 * v10 unifica este umbral con PESO_INCLUIDO_KG (antes eran 200g/500g
 * distintos) — "ninguna pieza con peso ≤500g va a WhatsApp, nunca".
 * Queda como constante aparte (no reusando PESO_INCLUIDO_KG directo) para
 * que el panel editable futuro pueda desacoplarlas si hace falta.
 */
export const EXENCION_VOLUMINOSAS_KG = 0.5;
/**
 * Nuevo en v10: piso de precio para voluminosas SIN peso. Un trim/tapa
 * barata con nombre de pieza grande (ej. "COVER, SIDE COWLING" a ~$4.600
 * CLP) no es la pieza grande — se deja pasar al resto de las reglas en
 * vez de mandarlo a WhatsApp solo por el nombre. En 0 desactiva la
 * excepción.
 */
export const PRECIO_MINIMO_VOLUMINOSA_CLP = 10_000;

// Listas abiertas: se agregan o corrigen términos cuando aparezcan casos
// nuevos. Nunca "SEAT" o "FORK" solos (atrapan piezas de válvula / horquillas
// de cambio) — siempre acompañados de ASSY/COMP.

/** El nombre manda sobre el peso: sin medidas en la base, es la única
 * defensa contra piezas grandes que pesan poco. Alarman solo con peso
 * > 500g o sin peso (salvo que también sean PRECISION o nombre seguro). */
export const VOLUMINOSAS: string[] = [
  "COWL",
  "COWLING",
  "FAIRING",
  "FENDER",
  "TANK",
  "HEADLIGHT",
  "HEADLAMP",
  "HEAD LAMP",
  "MUFFLER",
  "EXHAUST PIPE",
  "RADIATOR",
  "SWINGARM",
  "SWINGING ARM",
  "REAR ARM",
  "WHEEL",
  "TIRE",
  "FRAME",
  "SHELTER",
  "SEAT ASSY",
  "SEAT COMP",
  "FORK ASSY",
  "HANDLEBAR",
  "HANDLE BAR",
  "FAT BAR",
  "SCREEN",
  "WINDSCREEN",
  "DUCT",
  "SHROUD",
  "SIDE COVER",
  // español — seguro barato, el catálogo real nunca viene traducido.
  "CARROCERIA",
  "CARENADO",
  "GUARDABARROS",
  "TANQUE",
  "DEPOSITO COMBUSTIBLE",
  "FARO",
  "SILENCIADOR",
  "TUBO ESCAPE",
  "RADIADOR",
  "BASCULANTE",
  "HORQUILLA TRASERA",
  "RUEDA",
  "NEUMATICO",
  "CHASIS",
  "MANILLAR",
  "PARABRISAS",
  // japonés/katakana — el catálogo real de Suzuki viene así, sin inglés.
  "カウル",
  "フェアリング",
  "フェンダ",
  "タンク",
  "ヘッドライト",
  "ヘッドランプ",
  "マフラ",
  "エキゾースト",
  "エキパイ",
  "ラジエータ",
  "スイングアーム",
  "リヤアーム",
  "ホイール",
  "タイヤ",
  "フレーム",
  "シェルタ",
  "シートアッシ",
  "シートコンプ",
  "フロントフォーク",
  "ハンドルバー",
  "スクリーン",
  "ダクト",
  "シュラウド",
  "サイドカバー",
];

/** El nombre solo decide cuando NO hay peso utilizable — con peso, el
 * sobrecargo automático o el tope de 4 kg ya las cubren. */
export const PESADAS: string[] = [
  "CRANKSHAFT",
  "CYLINDER HEAD",
  "CRANKCASE",
  "CYLINDER",
  "FLYWHEEL",
  "STARTER MOTOR",
  "STARTING MOTOR",
  "ALTERNATOR",
  "GENERATOR",
  "STATOR",
  "CAMSHAFT",
  "TRANSMISSION",
  "GEARBOX",
  "SHOCK ABSORBER",
  "TRIPLE CLAMP",
  "STEERING STEM",
  "BRAKE DISC",
  "DISC ROTOR",
  "CALIPER",
  "DRIVE CHAIN",
  "SPROCKET",
  "BATTERY",
  "SIDE STAND",
  "CENTER STAND",
  "PROP STAND",
  "AIR CLEANER ASSY",
  // español. "AMORTIGUADOR" y "SOPORTE" se dejan fuera a propósito: son
  // ambiguos (DAMPER liviano vs SHOCK ABSORBER pesado; BRACKET liviano vs
  // PROP STAND pesado según el catálogo traducido) — sin peso, decide el
  // precio en vez de arriesgar un falso positivo/negativo sistemático.
  "CIGUENAL",
  "CABEZA CILINDRO",
  "CARTER",
  "VOLANTE MOTOR",
  "MOTOR ARRANQUE",
  "ALTERNADOR",
  "GENERADOR",
  "ESTATOR",
  "ARBOL LEVAS",
  "TRANSMISION",
  "CAJA CAMBIOS",
  "MORDAZA",
  "CADENA TRANSMISION",
  "PINON",
  "BATERIA",
  "CABALLETE LATERAL",
  "CABALLETE CENTRAL",
  "LIMPIADOR AIRE",
  // japonés/katakana
  "クランクシャフト",
  "シリンダ",
  "クランクケース",
  "フライホイール",
  "セルモータ",
  "スターターモータ",
  "スタータ",
  "オルタネータ",
  "ジェネレータ",
  "ステータ",
  "カムシャフト",
  "ミッション",
  "ギヤボックス",
  "ギアボックス",
  "ショックアブソーバ",
  "トップブリッジ",
  "ステアリングステム",
  "ブレーキディスク",
  "ディスクロータ",
  "キャリパ",
  "ドライブチェーン",
  "スプロケット",
  "バッテリ",
  "サイドスタンド",
  "センタースタンド",
  "エアクリーナ",
];

/** Electrónica e inyección: caras por tecnología, no por tamaño. Nunca
 * alarman por nombre, y sin peso ignoran el precio (a diferencia de una
 * subpieza normal). Nuevo en v10 — antes una ECU cara se iba a WhatsApp
 * por precio siendo justo el tipo de pieza que esta lista existe para
 * salvar. */
export const PRECISION: string[] = [
  "INJECTOR",
  "IGNITER",
  "IGNITION COIL",
  "CDI",
  "ECU",
  "ECM",
  "RELAY",
  "REGULATOR",
  "RECTIFIER",
  "SOLENOID",
  "SPARK PLUG",
  "FUSE",
  "MODULE",
  "SWITCH",
  "CONTROL UNIT",
  "SENSOR",
  // español
  "INYECTOR",
  "BUJIA ENCENDIDO",
  "RELE",
  "REGULADOR",
  "RECTIFICADOR",
  "SOLENOIDE",
  "BUJIA",
  "FUSIBLE",
  "UNIDAD CONTROL",
  // japonés/katakana — la ECU de Suzuki viene SOLO en katakana, sin inglés.
  "インジェクタ",
  "イグナイタ",
  "イグニッションコイル",
  "リレー",
  "レギュレータ",
  "レクチファイヤ",
  "ソレノイド",
  "スパークプラグ",
  "プラグ",
  "ヒューズ",
  "スイッチ",
  "センサ",
  "コントロールユニット",
];

/** Contienen una palabra de alarma pero son livianas — no alarman por
 * nombre, pero el precio SÍ les sigue aplicando (a diferencia de
 * PRECISION). */
export const EXCLUSIONES: string[] = [
  "MASTER CYLINDER",
  "KEY CYLINDER",
  "CYLINDER LOCK",
  "CYLINDER STUD",
  "CYLINDER BOLT",
  "CYLINDER GASKET",
  "CYLINDER HEAD GASKET",
  "CYLINDER HEAD BOLT",
  "CYLINDER HEAD COVER",
  "CRANKCASE GASKET",
  "CRANKCASE BOLT",
  "TANK CAP",
  "TANK BADGE",
  "TANK EMBLEM",
  "TANK RUBBER",
  "TANK PAD",
  "RESERVE TANK",
  "RESERVOIR TANK",
  "RECOVERY TANK",
  "WHEEL BEARING",
  "WHEEL VALVE",
  "WHEEL BOLT",
  "WHEEL NUT",
  "SPROCKET BOLT",
  "SPROCKET NUT",
  "SPROCKET COVER",
  "CAM SPROCKET",
  "HUB SHOCK",
  "HANDLEBAR BALANCER",
  "CALIPER BOLT",
  "CALIPER SEAL",
  "CALIPER PISTON",
  "BATTERY CABLE",
  "BATTERY HOLDER",
  "BATTERY BAND",
  "RADIATOR CAP",
  "RADIATOR HOSE",
  "RADIATOR BOLT",
  "STATOR BOLT",
  "STATOR COVER GASKET",
  "CAMSHAFT SPROCKET",
  "CAMSHAFT CHAIN",
  // español
  "CILINDRO MAESTRO",
  "TAPA TANQUE",
  "TAPON TANQUE",
  "EMBLEMA TANQUE",
  "VALVULA RUEDA",
  "TUERCA RUEDA",
  "TAPA RADIADOR",
  "MANGUERA RADIADOR",
  // japonés/katakana
  "マスターシリンダ",
  "キーシリンダ",
  "シリンダヘッドカバー",
  "エミッション",
  // Nota v10: se sacó "CYLINDER SET" de esta lista — en la base real
  // tapaba "HEAD SET, CYLINDER" (culatas de 4,2 kg) y "CYLINDER SET,
  // FORK" (cilindros de horquilla de 3,5 kg), dejándolos pasar como
  // envío incluido. Los cilindros de cerradura quedan cubiertos por
  // KEY CYLINDER y CYLINDER LOCK.
];

/** Si el nombre contiene alguna de estas como palabra, la pieza es un
 * accesorio menor y no alarma por nombre (desactiva VOLUMINOSAS y
 * PESADAS para esa pieza) — pero el precio SÍ le sigue aplicando sin
 * peso (v10: antes un ramal de cables de 7 kg pasaba como envío incluido
 * por contener WIRE; ahora el precio lo atrapa). */
export const SUBPIEZAS: string[] = [
  "BOLT",
  "GASKET",
  "SCREW",
  "WASHER",
  "NUT",
  "CLIP",
  "SEAL",
  "BRACKET",
  "STUD",
  "PIN",
  "HOSE",
  "CAP",
  "RUBBER",
  "SPRING",
  "COLLAR",
  "GROMMET",
  "BUSHING",
  "SLEEVE",
  "MARK",
  "DAMPER",
  "SPACER",
  "BEARING",
  "CABLE",
  "WIRE",
  "LEVER",
  "HOLDER",
  "ELEMENT",
  "LABEL",
  "BAND",
  "SHIM",
  "CORD",
  "EMBLEM",
  "BADGE",
  "TAPE",
  "LENS",
  "MOLDING",
  "PROTECTOR",
  "FASTENER",
  "CUSHION",
  "GRIP",
  "MIRROR",
  "REFLECTOR",
  "SOCKET",
  "BULB",
  // español. "SOPORTE" se deja fuera a propósito (ver PESADAS).
  "TORNILLO",
  "JUNTA",
  "EMPAQUETADURA",
  "TUERCA",
  "ARANDELA",
  "SELLO",
  "PERNO",
  "MANGUERA",
  "TAPA",
  "GOMA",
  "CAUCHO",
  "RESORTE",
  "MUELLE",
  "COLLARIN",
  "FUNDA",
  "CASQUILLO",
  "ESPACIADOR",
  "RODAMIENTO",
  "COJINETE",
  "PALANCA",
  "ETIQUETA",
  "CINTA",
  "EMBLEMA",
  "PROTECTOR",
  "SUJETADOR",
  "COJIN",
  // Sin Ñ a propósito: los NOMBRES pasan por normalizar() (Ñ→N) pero los
  // términos de las listas no — "EMPUÑADURA" con Ñ jamás calzaría.
  "EMPUNADURA",
  "PUNO",
  "ESPEJO RETROVISOR",
  "REFLECTOR",
  "ENCHUFE",
  "BOMBILLA",
  "FOCO",
  // Nota v10: "SENSOR" se sacó de acá — se movió a PRECISION (es
  // electrónica, y ahora tiene su propio pase libre de precio).
  // japonés/katakana
  "ボルト",
  "ガスケット",
  "パッキン",
  "スクリュ",
  "ビス",
  "ネジ",
  "ワッシャ",
  "ナット",
  "クリップ",
  "シール",
  "ブラケット",
  "スタッド",
  "ピン",
  "ホース",
  "キャップ",
  "ラバー",
  "スプリング",
  "カラー",
  "グロメット",
  "ブッシュ",
  "スリーブ",
  "ダンパ",
  "スペーサ",
  "ベアリング",
  "オーリング",
  "ケーブル",
  "ワイヤ",
  "レバー",
  "ホルダ",
  "エレメント",
  "ラベル",
  "バンド",
  "シム",
  "コード",
  "エンブレム",
  "テープ",
  "レンズ",
  "モール",
  "プロテクタ",
  "クッション",
  "グリップ",
  "ミラー",
  "リフレクタ",
  "ソケット",
];

/**
 * Panel editable (/admin/filtro-envio): las listas y umbrales de arriba
 * son el default/fallback fail-open — lo que se usa si Supabase falla o
 * si el caller no pasa nada. `cargarFiltroEnvio()` (filtroEnvioConfig.ts)
 * lee la versión vigente desde las tablas `filtro_envio_terminos` /
 * `filtro_envio_config` y se la pasa a `clasificarEnvio()` /
 * `calcularSobrecargoCarrito()` como parámetro — estas funciones nunca
 * leen Supabase directo, siguen siendo puras y sync.
 */
export interface ConfigFiltroEnvio {
  pesoIncluidoKg: number;
  cobroKiloExtraClp: number;
  pesoMaximoKg: number;
  precioSeguroSinPesoClp: number;
  exencionVoluminosasKg: number;
  precioMinimoVoluminosaClp: number;
}

export interface ListasFiltroEnvio {
  voluminosas: string[];
  pesadas: string[];
  precision: string[];
  exclusiones: string[];
  subpiezas: string[];
}

/** Derivada de ListasFiltroEnvio para que no puedan divergir. Vive acá
 * (módulo puro, sin imports de servidor) y no en filtroEnvioConfig.ts a
 * propósito: la página cliente del panel necesita estos tipos, y si los
 * importara desde filtroEnvioConfig.ts bastaría que alguien convirtiera
 * ese `import type` en un import de valor para arrastrar supabase/admin
 * y next/headers al bundle del cliente y romper el build. */
export type CategoriaFiltro = keyof ListasFiltroEnvio;

export const CATEGORIAS_FILTRO: CategoriaFiltro[] = [
  "voluminosas",
  "pesadas",
  "precision",
  "exclusiones",
  "subpiezas",
];

export function esCategoriaValida(v: unknown): v is CategoriaFiltro {
  return typeof v === "string" && (CATEGORIAS_FILTRO as string[]).includes(v);
}

/** Fila de término como la ve el panel admin (con id para poder borrarla). */
export interface TerminoFiltro {
  id: string;
  termino: string;
}

export const CONFIG_DEFAULT: ConfigFiltroEnvio = {
  pesoIncluidoKg: PESO_INCLUIDO_KG,
  cobroKiloExtraClp: COBRO_KILO_EXTRA_CLP,
  pesoMaximoKg: PESO_MAXIMO_KG,
  precioSeguroSinPesoClp: PRECIO_SEGURO_SIN_PESO_CLP,
  exencionVoluminosasKg: EXENCION_VOLUMINOSAS_KG,
  precioMinimoVoluminosaClp: PRECIO_MINIMO_VOLUMINOSA_CLP,
};

export const LISTAS_DEFAULT: ListasFiltroEnvio = {
  voluminosas: VOLUMINOSAS,
  pesadas: PESADAS,
  precision: PRECISION,
  exclusiones: EXCLUSIONES,
  subpiezas: SUBPIEZAS,
};

const MAPA_ACENTOS: Record<string, string> = {
  Á: "A",
  É: "E",
  Í: "I",
  Ó: "O",
  Ú: "U",
  Ü: "U",
  Ñ: "N",
};

/** Kana chica → grande (Suzuki escribe katakana en el estilo antiguo, todo
 * en kana grande): ッ→ツ, ォ→オ, etc. Mismo índice en ambas cadenas. */
const KANA_CHICA = "ァィゥェォャュョッヮ";
const KANA_GRANDE = "アイウエオヤユヨツワ";

/** Cualquier carácter japonés — hiragana, katakana o kanji. Si un término
 * de las listas matchea esto, se compara distinto (ver contieneTermino). */
export const RE_JAPONES = /[぀-ヿ一-鿿]/;

/**
 * Normalización obligatoria antes de comparar: los catálogos OEM escriben
 * los nombres invertidos y con signos ("DISC,FR BRAKE", "PIPE-EXHAUST",
 * "COVER, R. SIDE"). Sin esto, las alarmas nunca coincidirían. NFKC +
 * mapa explícito de tildes (no NFD + strip de marcas combinantes: eso
 * rompe el dakuten japonés ボ→ホ).
 *
 * v10 agrega la capa japonesa: el guion `-` y el alargamiento `ー` se
 * ELIMINAN (no se convierten en espacio) porque Yumbo los usa dentro de
 * una misma palabra katakana ("スタンド-プロツプ") — convertirlos en
 * espacio partiría la palabra y dejaría de calzar con la lista. La kana
 * chica se sube a grande (ver KANA_CHICA/KANA_GRANDE) porque el catálogo
 * las escribe indistintamente.
 */
export function normalizar(s: string): string {
  let t = (s || "").normalize("NFKC").toUpperCase();
  t = t.replace(/[ÁÉÍÓÚÜÑ]/g, (c) => MAPA_ACENTOS[c] ?? c);
  t = t.replace(/[ァィゥェォャュョッヮ]/g, (c) => KANA_GRANDE[KANA_CHICA.indexOf(c)]);
  t = t
    .replace(/DISK/g, "DISC")
    .replace(/[\-ー]/g, "")
    .replace(/[,·、，．./]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}

/** Misma limpieza de guion/kana chica que normalizar(), aplicada a un
 * término de las listas (no lleva mayúsculas/tildes latinas, así que no
 * hace falta repetir esos pasos). */
function normalizarTermino(termino: string): string {
  return termino
    .replace(/[ァィゥェォャュョッヮ]/g, (c) => KANA_GRANDE[KANA_CHICA.indexOf(c)])
    .replace(/[\-ー]/g, "");
}

/**
 * Coincidencia por PALABRAS, no por frase exacta: un término de dos o más
 * palabras se activa si TODAS sus palabras están presentes en el nombre,
 * en cualquier orden. Ej: "DISC,FR BRAKE" activa "BRAKE DISC"; "COVER, R.
 * SIDE" activa "SIDE COVER".
 *
 * El japonés no separa palabras con espacios, así que un término japonés
 * se compara por substring (tras limpiar guion/kana chica) en vez de por
 * palabra.
 */
export function contieneTermino(nombreNorm: string, termino: string): boolean {
  if (RE_JAPONES.test(termino)) {
    return nombreNorm.includes(normalizarTermino(termino));
  }
  // filter(Boolean): un doble espacio en el término generaría una palabra
  // vacía cuyo \b\b calza con cualquier cosa. Y sin palabra alguna, el
  // término no calza con nada (every([]) daría true — todo alarmaría).
  const palabras = termino.split(" ").filter(Boolean);
  if (palabras.length === 0) return false;
  return palabras.every((palabra) => {
    // Con las listas editables desde /admin, un término puede traer
    // caracteres especiales de regex ("NO.1+", paréntesis) — sin escapar,
    // el RegExp inválido reventaría TODAS las cotizaciones del sitio.
    const escapada = palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escapada}\\b`);
    return re.test(nombreNorm);
  });
}

function algunoCoincide(nombreNorm: string, lista: string[]): boolean {
  return lista.some((termino) => contieneTermino(nombreNorm, termino));
}

/** Evalúa una lista contra TODAS las variantes de nombre disponibles
 * (inglés + nativo) — si CUALQUIERA matchea, aplica. Es el patrón
 * multi-nombre de la Fase 2: un código puede venir SOLO en katakana, sin
 * inglés, y evaluar únicamente `nombre` perdería esa señal. */
function algunoCoincideMultiple(nombresNorm: string[], lista: string[]): boolean {
  return nombresNorm.some((n) => algunoCoincide(n, lista));
}

/** "(BLACK)" u otro sufijo de color, sin ninguna palabra descriptiva —
 * nuevo en v10: en la verificación real, 3 códigos así eran justo un
 * basculante, una rueda y un amortiguador (piezas grandes disfrazadas de
 * nombre vacío). */
function esSoloColor(nombreNorm: string): boolean {
  return nombreNorm.replace(/\([^)]*\)/g, "").trim() === "";
}

/** "Solo color" exige que TODAS las variantes de nombre disponibles
 * queden vacías tras sacar el paréntesis — si el inglés está vacío pero
 * el nombre nativo trae contenido real (o viceversa), no es un nombre
 * vacío, es una pieza real con una sola variante traducida. */
function esSoloColorMultiple(nombresNorm: string[]): boolean {
  return nombresNorm.every(esSoloColor);
}

export type ResultadoEnvio = "estandar" | "extra_automatico" | "alerta_whatsapp";

export interface ClasificacionEnvio {
  resultado: ResultadoEnvio;
  /** Monto en CLP a sumar al precio del repuesto. 0 salvo en "extra_automatico". */
  extraClp: number;
  mensaje: string;
}

const MENSAJE_ESTANDAR = "✓ Envío estándar incluido";

const MENSAJE_ALERTA =
  "Envío a cotizar — Por su tamaño o peso, esta pieza requiere cotización de envío " +
  "personalizada. Escríbenos y te confirmamos el total antes de tu compra.";

/** Se agrega al mensaje cuando el peso viene de una fuente no confirmada
 * ("aproximado" o "inferido" — el 94% del catálogo). */
const LEYENDA_PESO_ESTIMADO = " (envío estimado — se confirma al momento del pago)";

function mensajeExtra(pesoKg: number, montoClp: number): string {
  return `Esta pieza pesa ${pesoKg} kg y supera el tamaño estándar. Se suman $${montoClp.toLocaleString("es-CL")} al precio final.`;
}

function estandar(mensaje: string = MENSAJE_ESTANDAR): ClasificacionEnvio {
  return { resultado: "estandar", extraClp: 0, mensaje };
}

function alerta(mensaje: string = MENSAJE_ALERTA): ClasificacionEnvio {
  return { resultado: "alerta_whatsapp", extraClp: 0, mensaje };
}

/** (peso − pesoIncluidoKg) × cobroKiloExtraClp, redondeado hacia arriba al múltiplo de $1.000. */
function calcularExtraClp(pesoKg: number, config: ConfigFiltroEnvio): number {
  return Math.ceil(((pesoKg - config.pesoIncluidoKg) * config.cobroKiloExtraClp) / 1000) * 1000;
}

function extraAutomatico(pesoKg: number, leyenda: string, config: ConfigFiltroEnvio): ClasificacionEnvio {
  const monto = calcularExtraClp(pesoKg, config);
  return { resultado: "extra_automatico", extraClp: monto, mensaje: mensajeExtra(pesoKg, monto) + leyenda };
}

export interface DatosClasificacion {
  nombre: string;
  /** Nombre nativo del proveedor (japonés/katakana), cuando viene distinto
   * del inglés en `nombre` — ver buscarYumbo() en yumbo.ts. Se evalúa junto
   * a `nombre` y se toma el resultado más restrictivo: un código puede
   * venir SOLO en katakana sin versión en inglés. */
  nombreNativo?: string | null;
  /** 0 = sin peso registrado (ni del proveedor ni del catálogo manual). */
  pesoKg: number;
  precioRepuestoClp: number;
  /** false = código marcado inválido en el catálogo (no debería llegar a
   * cotizar, pero si ocurre, se deriva a WhatsApp). Default true. */
  oemValido?: boolean;
  /** false = el nombre está en un idioma/formato no evaluable (español,
   * ruso, japonés) — el peso igual sirve, pero no se evalúan las listas de
   * alarma (están en inglés) y no se muestra el nombre real al cliente. */
  nombreConfiable?: boolean;
  /** Texto de la columna Fuente_Peso del catálogo, si existe. */
  fuentePeso?: string | null;
}

/**
 * Clasifica el envío de una pieza según el orden de decisión del v10
 * (parar en el primer resultado que aplique): código inválido → PRECISIÓN
 * nunca alarma → subpieza/exclusión desactiva alarmas de nombre (el
 * precio sigue aplicando) → VOLUMINOSAS manda sobre el peso (salvo
 * exención de 500 g, o precio bajo el piso sin peso) → con peso, el peso
 * manda (≤500g nunca WhatsApp) → sin peso, nombre no confiable/sin nombre
 * → sin peso, nombre "solo color" → sin peso, PRECISIÓN ignora el precio
 * → sin peso, PESADAS → sin peso, precio > $30.000 → estándar.
 */
export function clasificarEnvio(
  datos: DatosClasificacion,
  config: ConfigFiltroEnvio = CONFIG_DEFAULT,
  listas: ListasFiltroEnvio = LISTAS_DEFAULT,
): ClasificacionEnvio {
  const {
    nombre,
    nombreNativo,
    pesoKg,
    precioRepuestoClp,
    oemValido = true,
    nombreConfiable = true,
    fuentePeso,
  } = datos;

  // Paso 0
  if (oemValido === false) return alerta("código OEM inválido — requiere revisión manual");

  const sinPeso = pesoKg === 0;
  const nombreEvaluable = nombreConfiable !== false;
  // Multi-nombre: se evalúan TODAS las variantes disponibles (inglés +
  // nativo) y se toma el resultado más restrictivo — un código puede
  // venir SOLO en katakana, sin versión en inglés.
  const nombresRaw = [nombre, nombreNativo].filter((v): v is string => !!v && v.trim() !== "");
  const normalizados = nombreEvaluable ? nombresRaw.map(normalizar) : [];

  // "estimado"/"nivel 3"/"nivel 4": formato de Fuente_peso en
  // Base_Cotizador_RaulSpeed_COMPLETA.csv ("NIVEL 3 · estimado por
  // familia de código...", "NIVEL 4 · sin dato de peso") — no calzaba
  // con el regex original, que solo cubría el formato de imports previos.
  const leyenda =
    !sinPeso && (fuentePeso || "").match(/aproximado|inferido|estimado|nivel 3|nivel 4/i)
      ? LEYENDA_PESO_ESTIMADO
      : "";

  // Paso 1: PRECISIÓN nunca alarma por nombre.
  const esPrecision = nombreEvaluable && algunoCoincideMultiple(normalizados, listas.precision);

  // Paso 2: subpieza o exclusión desactiva las alarmas de nombre (el
  // precio SÍ sigue aplicando sin peso — a diferencia de PRECISIÓN).
  const nombreSeguro =
    nombreEvaluable &&
    (algunoCoincideMultiple(normalizados, listas.subpiezas) ||
      algunoCoincideMultiple(normalizados, listas.exclusiones));

  // Paso 3: VOLUMINOSAS manda sobre el peso, salvo la exención de 500 g,
  // marca de precisión, nombre seguro, o (sin peso) precio bajo el piso
  // de voluminosa — un trim barato con nombre de pieza grande no es la
  // pieza grande.
  if (
    nombreEvaluable &&
    !nombreSeguro &&
    !esPrecision &&
    algunoCoincideMultiple(normalizados, listas.voluminosas) &&
    (sinPeso || pesoKg > config.exencionVoluminosasKg)
  ) {
    const esTrimBarato =
      sinPeso &&
      precioRepuestoClp > 0 &&
      precioRepuestoClp < config.precioMinimoVoluminosaClp;
    if (!esTrimBarato) {
      return alerta();
    }
  }

  // Pasos 4-6: con peso utilizable, el peso manda (incluye PESADAS: si ya
  // hay peso, el sobrecargo automático o el tope de 4 kg las cubren).
  // ≤500 g nunca va a WhatsApp, sin excepción.
  if (!sinPeso) {
    if (pesoKg > config.pesoMaximoKg) return alerta();
    if (pesoKg <= config.pesoIncluidoKg) return estandar(MENSAJE_ESTANDAR + leyenda);
    return extraAutomatico(pesoKg, leyenda, config);
  }

  // Pasos 7-11: sin peso.
  if (!nombreEvaluable || normalizados.length === 0) return alerta();
  if (esSoloColorMultiple(normalizados)) return alerta();
  if (esPrecision) return estandar(); // ignora el precio, cuenta 0 kg
  if (!nombreSeguro && algunoCoincideMultiple(normalizados, listas.pesadas)) return alerta();
  if (precioRepuestoClp > config.precioSeguroSinPesoClp) return alerta();
  return estandar(); // aprobada: cuenta 0 kg en el carrito
}

export interface ItemParaSobrecargo {
  /** 0 = sin peso registrado (ya aceptado individualmente por precio bajo). */
  pesoKg: number;
  cantidad: number;
}

function mensajeExtraCarrito(pesoKg: number, montoClp: number): string {
  return (
    `Tu pedido pesa ${pesoKg} kg en total y supera el tramo gratuito de envío. ` +
    `Se suman $${montoClp.toLocaleString("es-CL")} al total por envío.`
  );
}

function mensajeAlertaCarrito(pesoKg: number): string {
  return (
    `El peso total de tu pedido (${pesoKg} kg) supera el máximo para el cálculo ` +
    `automático de envío. Escríbenos por WhatsApp y te confirmamos el total antes de pagar.`
  );
}

/**
 * Sobrecargo por envío del PEDIDO completo, calculado sobre el peso
 * ACUMULADO del carrito (no la suma de los sobrecargos individuales de
 * cada pieza, que duplicaría el tramo gratuito de 0,5 kg una vez por
 * pieza). Solo evalúa peso: si alguna pieza del carrito ya dio
 * "alerta_whatsapp" en clasificarEnvio(), eso se resuelve aparte (ver
 * /api/pedidos, que rechaza el pedido completo si algún ítem viene así).
 */
export function calcularSobrecargoCarrito(
  items: ItemParaSobrecargo[],
  config: ConfigFiltroEnvio = CONFIG_DEFAULT,
): ClasificacionEnvio {
  const pesoTotalKg = Number(
    items.reduce((sum, item) => sum + (item.pesoKg || 0) * item.cantidad, 0).toFixed(2),
  );

  if (pesoTotalKg <= config.pesoIncluidoKg) {
    return estandar();
  }
  if (pesoTotalKg > config.pesoMaximoKg) {
    return alerta(mensajeAlertaCarrito(pesoTotalKg));
  }

  const monto = calcularExtraClp(pesoTotalKg, config);
  return { resultado: "extra_automatico", extraClp: monto, mensaje: mensajeExtraCarrito(pesoTotalKg, monto) };
}
