"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CARRITO_STORAGE_KEY, type ItemCotizacion } from "@/lib/carrito";
import type { ResultadoCotizacion } from "@/lib/cotizar";
import { calcularSobrecargoCarrito } from "@/lib/sobrecargoEnvio";
import styles from "./page.module.css";

function fmt(n: number): string {
  return new Intl.NumberFormat("es-CL").format(n);
}

/**
 * Precio aproximado a la decena para la ficha de cotización: el costo de
 * logística y el sobrecargo por peso recién se muestran y se suman al
 * agregar el ítem al carrito, no antes.
 */
function redondearAproximado(n: number): number {
  return Math.round(n / 10) * 10;
}

// Copy informativa, no ligada 1:1 a LISTA_A_PALABRAS (sobrecargoEnvio.ts):
// son categorías en español para el cliente, no los términos en inglés que
// se buscan en el nombre del repuesto que devuelve el proveedor.
const CATEGORIAS_VOLUMINOSAS = [
  "Carenados",
  "Quillas",
  "Tapas de carenado",
  "Guardabarros",
  "Estanque",
  "Foco delantero",
  "Escape",
  "Radiador",
  "Basculante",
  "Llantas",
  "Neumáticos",
  "Chasis",
  "Manubrio",
  "Parabrisas",
  "Asiento",
  "Ductos de aire",
  "Tapas laterales",
];

function EnvioEstandarCard({ precioFinal = false }: { precioFinal?: boolean }) {
  return (
    <div className={styles.envioEstandarCard}>
      <div className={styles.envioCardTitle}>
        <span className={styles.envioCardIcon}>✓</span> Envío internacional incluido
      </div>
      <p className={styles.envioCardText}>
        {precioFinal
          ? "El precio mostrado es el valor final e incluye IVA y despacho internacional. No pagas nada adicional por piezas de tamaño normal."
          : "Esta pieza no tiene sobrecargo por tamaño o peso. El costo de despacho internacional se suma una sola vez al agregar tus repuestos al carrito."}
      </p>
      <p className={styles.envioCardBullet}>
        Envío internacional: piezas de hasta 500 g — retenes, empaquetaduras, filtros, tensores,
        pastillas, bujías y rodamientos, entre muchos otros — la gran mayoría de los repuestos.
      </p>
    </div>
  );
}

function EnvioAlertaCard({ whatsappHref }: { whatsappHref: string }) {
  return (
    <div className={styles.envioAlertaCard}>
      <div className={styles.envioCardTitle}>
        <span className={styles.envioCardIcon}>📦</span> Piezas voluminosas: te confirmamos el
        envío
      </div>
      <p className={styles.envioCardText}>
        Algunas piezas grandes o de más de 500 g pueden llevar un pequeño ajuste en el despacho.
        En la mayoría de los casos es un monto menor — escríbenos por WhatsApp y en minutos te
        confirmamos el valor exacto para tu repuesto.
      </p>
      <p className={styles.envioAlertaAplica}>Aplica solo para:</p>
      <ul className={styles.envioAlertaCriterios}>
        <li>Piezas de más de 500 g de peso</li>
        <li>Piezas voluminosas:</li>
      </ul>
      <div className={styles.envioTagList}>
        {CATEGORIAS_VOLUMINOSAS.map((categoria) => (
          <span key={categoria} className={styles.envioTag}>
            {categoria}
          </span>
        ))}
      </div>
      <p className={styles.envioAlertaNota}>
        La consulta toma solo un minuto — compras con el valor total confirmado, sin sorpresas.
      </p>
      <a
        className={styles.envioAlertaBtn}
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        💬 Confirmar mi envío por WhatsApp
      </a>
    </div>
  );
}

const PASOS_COMPRA = [
  {
    titulo: "1️⃣ Pago + Datos 💳",
    texto: "Confirmas con el 100% del pago.",
  },
  {
    titulo: "2️⃣ Importación ⚙️",
    texto: "Tu repuesto viaja a Chile en 10 a 20 días hábiles.",
  },
  {
    titulo: "3️⃣ Verificación 📸",
    texto: "Llega a nuestro centro y te enviamos foto real de tu pieza.",
  },
  {
    titulo: "4️⃣ Despacho 🚀",
    texto: "Lo enviamos por el courier que elegiste.",
  },
  {
    titulo: "5️⃣ Seguimiento ✅",
    texto: "Recibes el código para rastrear tu paquete hasta tus manos.",
  },
];

function ComoComprarBox() {
  const [verMas, setVerMas] = useState(false);
  const [primerPaso, ...restoPasos] = PASOS_COMPRA;

  return (
    <div className={styles.comoComprarCard}>
      <div className={styles.comoComprarTitle}>¿Cómo comprar tu repuesto importado?</div>
      <div className={styles.comoComprarSteps}>
        <div className={styles.comoComprarStep}>
          <span className={styles.comoComprarStepTitle}>{primerPaso.titulo}</span>
          <span className={styles.comoComprarStepText}>{primerPaso.texto}</span>
        </div>
        {verMas &&
          restoPasos.map((paso) => (
            <div className={styles.comoComprarStep} key={paso.titulo}>
              <span className={styles.comoComprarStepTitle}>{paso.titulo}</span>
              <span className={styles.comoComprarStepText}>{paso.texto}</span>
            </div>
          ))}
      </div>
      {verMas && (
        <p className={styles.comoComprarFooter}>¡Repuesto 100% original garantizado! 🏍️</p>
      )}
      <button
        type="button"
        className={styles.noticeToggle}
        onClick={() => setVerMas((v) => !v)}
      >
        {verMas ? "Ver menos ▲" : "Ver más ▼"}
      </button>
    </div>
  );
}

function HelpBox({ onAbrirSolicitud }: { onAbrirSolicitud: () => void }) {
  return (
    <div className={styles.helpBox}>
      <div className={`${styles.envioCardTitle} ${styles.helpBoxTitle}`}>
        ¿No sabes tu número de parte?
      </div>
      <p className={styles.envioCardText}>
        <button type="button" className={styles.helpBoxLink} onClick={onAbrirSolicitud}>
          Déjanos los datos de tu moto aquí
        </button>{" "}
        y lo buscamos por ti.
      </p>
      <p className={styles.helpBoxSub}>Te respondemos por WhatsApp</p>
    </div>
  );
}

function NoticeSobrecargo({ verMas, onToggle }: { verMas: boolean; onToggle: () => void }) {
  return (
    <div className={styles.noticeCard}>
      <div className={styles.noticeTitle}>⚠️ Importante: sobrecargo por volumen</div>
      <p className={styles.noticeText}>
        El precio cotizado corresponde a repuestos OEM 100% originales de tamaño y peso
        estándar.
      </p>

      {verMas && (
        <>
          <p className={styles.noticeText}>
            Repuestos de alto volumen (carenados, estanques, basculantes, llantas,
            cigüeñales, entre otros) tienen un sobrecargo por envío internacional.
          </p>
          <div className={styles.noticeList}>
            <div className={styles.noticeListItem}>✅ Pieza estándar: compra directo aquí.</div>
            <div className={styles.noticeListItem}>
              📦 Pieza grande o pesada: consulta el sobrecargo extra por envío internacional.
            </div>
            <div className={styles.noticeListItem}>
              📞 Atención especializada: WhatsApp{" "}
              <a href="https://wa.me/56954156358" target="_blank" rel="noopener noreferrer">
                +56 9 5415 6358
              </a>
            </div>
          </div>
        </>
      )}

      <button type="button" className={styles.noticeToggle} onClick={onToggle}>
        {verMas ? "Ver menos ▲" : "Ver más ▼"}
      </button>
    </div>
  );
}

function InfoBoxes({
  onAbrirSolicitud,
  verMasSobrecargo,
  onToggleVerMasSobrecargo,
}: {
  onAbrirSolicitud: () => void;
  verMasSobrecargo: boolean;
  onToggleVerMasSobrecargo: () => void;
}) {
  return (
    <>
      <ComoComprarBox />
      <HelpBox onAbrirSolicitud={onAbrirSolicitud} />
      <NoticeSobrecargo verMas={verMasSobrecargo} onToggle={onToggleVerMasSobrecargo} />
    </>
  );
}

export default function Home() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCotizacion | null>(null);
  const [error, setError] = useState<{ title: string; msg: string } | null>(null);

  const [items, setItems] = useState<ItemCotizacion[]>([]);
  const [costoLogisticaClp, setCostoLogisticaClp] = useState(0);
  const [cantidad, setCantidad] = useState(1);

  const [mostrarSolicitud, setMostrarSolicitud] = useState(false);
  const [solForm, setSolForm] = useState({
    nombreApellido: "",
    contacto: "",
    moto: "",
    chasisVinPatente: "",
    descripcionRepuesto: "",
  });
  const [solEnviando, setSolEnviando] = useState(false);
  const [solEnviada, setSolEnviada] = useState(false);
  const [solError, setSolError] = useState<string | null>(null);

  const [verMasSobrecargo, setVerMasSobrecargo] = useState(false);

  async function buscar() {
    const part = inputRef.current?.value.trim().toUpperCase() ?? "";
    if (!part) {
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    setResultado(null);
    setError(null);
    setCantidad(1);

    let data: ResultadoCotizacion;
    try {
      const res = await fetch("/api/cotizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partNumber: part }),
      });
      data = await res.json();
    } catch {
      setLoading(false);
      setError({
        title: "Error de conexión",
        msg: "Verifica que el servidor esté corriendo.",
      });
      return;
    }

    setLoading(false);
    if (data.estado === "ok") {
      setResultado(data);
      setCostoLogisticaClp(data.costoLogisticaClp ?? 0);
    } else if (data.estado === "no_encontrado") {
      setError({ title: "Repuesto no encontrado", msg: data.mensaje ?? "" });
    } else {
      // No se muestra data.mensaje: puede traer el error técnico crudo del
      // proveedor de precios (ej. "Impex: contact with manager"), que no
      // tiene sentido para el cliente. El mensaje real queda igual visible
      // en el panel admin para diagnosticar.
      setError({
        title: "No pudimos cotizar en este momento",
        msg: "Tuvimos un problema técnico al consultar el precio. Intenta nuevamente en unos minutos o escríbenos por WhatsApp al +56 9 5415 6358 si el problema persiste.",
      });
    }
  }

  function agregarAlCarrito() {
    if (!resultado || resultado.estado !== "ok") return;
    if (resultado.envioResultado === "alerta_whatsapp") return;

    setItems((prev) => [
      ...prev,
      {
        id: `${resultado.partNumber}-${Date.now()}`,
        partNumber: resultado.partNumber,
        maker: resultado.maker,
        nombre: resultado.nombre,
        precioRepuestoClp: resultado.precioRepuestoClp ?? 0,
        pesoKg: resultado.pesoKg ?? 0,
        cantidad,
      },
    ]);

    setResultado(null);
    setCantidad(1);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }

  function quitarItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function cambiarCantidadItem(id: string, delta: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, cantidad: Math.max(1, item.cantidad + delta) } : item,
      ),
    );
  }

  function actualizarSolCampo(campo: keyof typeof solForm, valor: string) {
    setSolForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function abrirSolicitud() {
    setMostrarSolicitud(true);
    setSolEnviada(false);
    setSolError(null);
  }

  async function enviarSolicitud() {
    if (
      !solForm.nombreApellido.trim() ||
      !solForm.contacto.trim() ||
      !solForm.moto.trim() ||
      !solForm.chasisVinPatente.trim() ||
      !solForm.descripcionRepuesto.trim()
    ) {
      setSolError("Completa los campos obligatorios");
      return;
    }

    setSolEnviando(true);
    setSolError(null);
    try {
      const res = await fetch("/api/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(solForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setSolError(data.error || "No se pudo enviar la solicitud");
        setSolEnviando(false);
        return;
      }
      setSolEnviada(true);
      setSolForm({
        nombreApellido: "",
        contacto: "",
        moto: "",
        chasisVinPatente: "",
        descripcionRepuesto: "",
      });
    } catch {
      setSolError("Error de conexión");
    }
    setSolEnviando(false);
  }

  function procederAlPago() {
    if (calcularSobrecargoCarrito(items).resultado === "alerta_whatsapp") return;
    sessionStorage.setItem(CARRITO_STORAGE_KEY, JSON.stringify({ items, costoLogisticaClp }));
    router.push("/checkout");
  }

  const subtotalRepuestos = items.reduce(
    (sum, item) => sum + item.precioRepuestoClp * item.cantidad,
    0,
  );
  const pesoTotalCarritoKg = items.reduce((sum, item) => sum + item.pesoKg * item.cantidad, 0);
  const clasificacionCarrito = calcularSobrecargoCarrito(items);
  const sobrecargoCarritoClp = clasificacionCarrito.extraClp;
  const bloqueadoPorPeso = clasificacionCarrito.resultado === "alerta_whatsapp";
  const totalCotizacion =
    subtotalRepuestos + sobrecargoCarritoClp + (items.length > 0 ? costoLogisticaClp : 0);

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarBrand}>
          Raul<span>Speed</span>
        </div>
        <div className={styles.topbarDivider} />
        <div className={styles.topbarSub}>Cotizador de Repuestos</div>
      </header>

      <div className={styles.main}>
        <div className={styles.heading}>
          <div className={styles.headingTag}>Repuestos OEM</div>
          <h1>
            Cotizador de
            <br />
            <em>Repuestos Japoneses</em>
          </h1>
          <p>Importación directa · Precio en Peso Chileno</p>
        </div>

        <p className={styles.tagline}>
          Tu repuesto en <span className={styles.taglineHighlight}>semanas</span>, no en meses
        </p>
        <div className={styles.taglineDivider} />

        <div className={styles.trustRow}>
          <span className={styles.trustItem}>
            <span className={styles.trustCheck}>✓</span> Repuestos 100% originales garantizados
          </span>
          <span className={styles.trustItem}>
            <span className={styles.trustCheck}>✓</span> Entrega en 10-20 días hábiles
          </span>
          <span className={styles.trustItem}>
            <span className={styles.trustCheck}>✓</span> Envío con seguimiento
          </span>
        </div>

        <div className={styles.searchCard}>
          <div className={styles.inputRow}>
            <input
              ref={inputRef}
              className={styles.partInput}
              type="text"
              placeholder="Ej: 13568-19145"
              autoComplete="off"
              autoCapitalize="characters"
              onKeyDown={(e) => e.key === "Enter" && buscar()}
            />
            <button className={styles.searchBtn} disabled={loading} onClick={buscar}>
              Cotizar
            </button>
          </div>
          <p className={styles.hint}>
            Ingresa el número de parte OEM · <span>Solo piezas genuinas</span>
          </p>
        </div>

        {!(resultado && resultado.estado === "ok") && (
          <InfoBoxes
            onAbrirSolicitud={abrirSolicitud}
            verMasSobrecargo={verMasSobrecargo}
            onToggleVerMasSobrecargo={() => setVerMasSobrecargo((v) => !v)}
          />
        )}

        <div className={`${styles.loader} ${loading ? styles.visible : ""}`}>
          <div className={styles.spinner} />
          <span>Consultando…</span>
        </div>

        {error && (
          <div className={`${styles.errorBox} ${styles.visible}`}>
            <strong>{error.title}</strong>
            <span>{error.msg}</span>
          </div>
        )}

        {resultado && resultado.estado === "ok" && (
          <div className={`${styles.resultCard} ${styles.visible}`}>
            <div className={styles.priceHero}>
              <div className={styles.priceLabel}>Precio en Peso Chileno</div>
              <div>
                <span className={styles.priceAmount}>
                  {fmt(redondearAproximado(resultado.precioRepuestoClp ?? 0))}
                </span>
                <span className={styles.priceCurrency}>CLP aprox. · IVA incluido</span>
              </div>
            </div>
            <div className={styles.infoRows}>
              <div className={styles.infoRow}>
                <span className={styles.key}>Fabricante</span>
                <span className={styles.value}>{resultado.maker || "—"}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.key}>Repuesto</span>
                <span className={styles.value}>{resultado.nombre || "—"}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.key}>Peso</span>
                <span className={styles.value}>
                  {resultado.pesoKg ? `${resultado.pesoKg} kg` : "Sin dato"}
                </span>
              </div>
            </div>

            {resultado.envioResultado === "estandar" && <EnvioEstandarCard />}

            {resultado.envioResultado === "extra_automatico" && (
              <div className={styles.envioExtraBox}>{resultado.envioMensaje}</div>
            )}

            {resultado.envioResultado === "alerta_whatsapp" && (
              <EnvioAlertaCard
                whatsappHref={`https://wa.me/56954156358?text=${encodeURIComponent(
                  `Hola, quiero cotizar el envío de la pieza ${resultado.partNumber}` +
                    `${resultado.nombre ? ` (${resultado.nombre})` : ""}.`,
                )}`}
              />
            )}

            {resultado.envioResultado !== "alerta_whatsapp" && (
              <div className={styles.addRow}>
                <div className={styles.qtyRow}>
                  <span className={styles.qtyLabel}>Cantidad</span>
                  <div className={styles.qtyControls}>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                      aria-label="Disminuir cantidad"
                    >
                      −
                    </button>
                    <span className={styles.qtyValue}>{cantidad}</span>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      onClick={() => setCantidad((c) => c + 1)}
                      aria-label="Aumentar cantidad"
                    >
                      +
                    </button>
                  </div>
                </div>
                <button className={styles.addBtn} onClick={agregarAlCarrito}>
                  + Agregar al carrito de compras
                </button>
              </div>
            )}
          </div>
        )}

        {resultado && resultado.estado === "ok" && (
          <InfoBoxes
            onAbrirSolicitud={abrirSolicitud}
            verMasSobrecargo={verMasSobrecargo}
            onToggleVerMasSobrecargo={() => setVerMasSobrecargo((v) => !v)}
          />
        )}

        {items.length > 0 && (
          <div className={`${styles.cartCard} ${styles.visible}`}>
            <div className={styles.cartHeader}>Repuestos agregados ({items.length})</div>
            {items.map((item) => (
              <div className={styles.cartItem} key={item.id}>
                <div className={styles.cartItemInfo}>
                  <span className={styles.cartItemPart}>{item.partNumber}</span>
                  <span className={styles.cartItemName}>
                    {[item.maker, item.nombre].filter(Boolean).join(" · ") || "—"}
                  </span>
                </div>
                <div className={styles.cartItemRight}>
                  <div className={styles.qtyControlsSmall}>
                    <button
                      type="button"
                      className={styles.qtyBtnSmall}
                      onClick={() => cambiarCantidadItem(item.id, -1)}
                      aria-label={`Disminuir cantidad de ${item.partNumber}`}
                    >
                      −
                    </button>
                    <span className={styles.qtyValueSmall}>{item.cantidad}</span>
                    <button
                      type="button"
                      className={styles.qtyBtnSmall}
                      onClick={() => cambiarCantidadItem(item.id, 1)}
                      aria-label={`Aumentar cantidad de ${item.partNumber}`}
                    >
                      +
                    </button>
                  </div>
                  <span className={styles.cartItemPrice}>
                    ${fmt(item.precioRepuestoClp * item.cantidad)}
                  </span>
                  <button
                    className={styles.cartRemoveBtn}
                    onClick={() => quitarItem(item.id)}
                    aria-label={`Quitar ${item.partNumber}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <div className={styles.cartTotals}>
              <div className={styles.cartTotalRow}>
                <span>Peso total</span>
                <span>{pesoTotalCarritoKg ? `${pesoTotalCarritoKg} kg` : "Sin dato"}</span>
              </div>
              <div className={styles.cartTotalRow}>
                <span>Subtotal repuestos</span>
                <span>${fmt(subtotalRepuestos)} CLP</span>
              </div>
              {sobrecargoCarritoClp > 0 && (
                <div className={styles.cartTotalRow}>
                  <span>Sobrecargo por peso</span>
                  <span>${fmt(sobrecargoCarritoClp)} CLP</span>
                </div>
              )}
              <div className={styles.cartTotalRow}>
                <span>Costo de logística (único)</span>
                <span>${fmt(costoLogisticaClp)} CLP</span>
              </div>
              <div className={`${styles.cartTotalRow} ${styles.cartTotalFinal}`}>
                <span>Total</span>
                <span>${fmt(totalCotizacion)} CLP · IVA incluido</span>
              </div>
            </div>

            {bloqueadoPorPeso ? (
              <EnvioAlertaCard
                whatsappHref={`https://wa.me/56954156358?text=${encodeURIComponent(
                  `Hola, quiero cotizar el envío de mi pedido (peso total ~${pesoTotalCarritoKg} kg): ` +
                    items.map((item) => `${item.partNumber} ×${item.cantidad}`).join(", "),
                )}`}
              />
            ) : (
              <>
                {clasificacionCarrito.resultado === "estandar" && <EnvioEstandarCard precioFinal />}
                <div className={styles.addRow}>
                  <button className={styles.addBtn} onClick={procederAlPago}>
                    Proceder al pago →
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <footer className={styles.footer}>
        <span>Raulspeed</span> · Importación directa de repuestos originales
      </footer>

      {mostrarSolicitud && (
        <div className={styles.modalOverlay} onClick={() => setMostrarSolicitud(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setMostrarSolicitud(false)}
              aria-label="Cerrar"
            >
              ✕
            </button>
            <h2 className={styles.modalTitle}>Déjanos los datos de tu moto</h2>
            <p className={styles.modalSub}>Te contactamos por WhatsApp.</p>

            {solEnviada ? (
              <p className={styles.modalSuccess}>
                ✅ ¡Listo! Recibimos tus datos, te contactaremos pronto.
              </p>
            ) : (
              <div className={styles.modalForm}>
                <div className={styles.modalField}>
                  <label htmlFor="solNombre">Nombre completo *</label>
                  <input
                    id="solNombre"
                    value={solForm.nombreApellido}
                    onChange={(e) => actualizarSolCampo("nombreApellido", e.target.value)}
                  />
                </div>
                <div className={styles.modalField}>
                  <label htmlFor="solContacto">
                    Número de WhatsApp (con código de área) o correo electrónico *
                  </label>
                  <input
                    id="solContacto"
                    value={solForm.contacto}
                    onChange={(e) => actualizarSolCampo("contacto", e.target.value)}
                  />
                </div>
                <div className={styles.modalField}>
                  <label htmlFor="solMoto">Marca, Modelo y Año de la motocicleta *</label>
                  <input
                    id="solMoto"
                    value={solForm.moto}
                    onChange={(e) => actualizarSolCampo("moto", e.target.value)}
                  />
                </div>
                <div className={styles.modalField}>
                  <label htmlFor="solChasis">Número de Chasis / VIN / Patente *</label>
                  <input
                    id="solChasis"
                    value={solForm.chasisVinPatente}
                    onChange={(e) => actualizarSolCampo("chasisVinPatente", e.target.value)}
                  />
                </div>
                <div className={styles.modalField}>
                  <label htmlFor="solDescripcion">Descripción detallada del repuesto *</label>
                  <textarea
                    id="solDescripcion"
                    rows={3}
                    value={solForm.descripcionRepuesto}
                    onChange={(e) => actualizarSolCampo("descripcionRepuesto", e.target.value)}
                  />
                </div>

                {solError && <p className={styles.modalError}>{solError}</p>}

                <button className={styles.addBtn} disabled={solEnviando} onClick={enviarSolicitud}>
                  {solEnviando ? "Enviando…" : "Enviar"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
