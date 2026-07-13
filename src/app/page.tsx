"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CARRITO_STORAGE_KEY, type ItemCotizacion } from "@/lib/carrito";
import type { ResultadoCotizacion } from "@/lib/cotizar";
import styles from "./page.module.css";

function fmt(n: number): string {
  return new Intl.NumberFormat("es-CL").format(n);
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
      setError({ title: "Error en la búsqueda", msg: data.mensaje ?? "Intenta nuevamente." });
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
        precioRepuestoClp: (resultado.precioRepuestoClp ?? 0) + (resultado.envioExtraClp ?? 0),
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
    sessionStorage.setItem(CARRITO_STORAGE_KEY, JSON.stringify({ items, costoLogisticaClp }));
    router.push("/checkout");
  }

  const subtotalRepuestos = items.reduce(
    (sum, item) => sum + item.precioRepuestoClp * item.cantidad,
    0,
  );
  const totalCotizacion = subtotalRepuestos + (items.length > 0 ? costoLogisticaClp : 0);

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

        <p className={styles.tagline}>
          Tu repuesto en <span className={styles.taglineHighlight}>semanas</span>, no en meses
        </p>
        <div className={styles.taglineDivider} />

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

        <div className={styles.helpBox}>
          <p className={styles.helpBoxTitle}>¿No sabes tu número de parte?</p>
          <p className={styles.helpBoxText}>
            <button type="button" className={styles.helpBoxLink} onClick={abrirSolicitud}>
              Déjanos los datos de tu moto aquí
            </button>{" "}
            y lo buscamos por ti.
          </p>
          <p className={styles.helpBoxSub}>Te respondemos por WhatsApp</p>
        </div>

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
                <span className={styles.priceAmount}>{fmt(resultado.precioClpFinal ?? 0)}</span>
                <span className={styles.priceCurrency}>CLP · IVA incluido</span>
              </div>
            </div>
            <div className={styles.infoRows}>
              <div className={styles.infoRow}>
                <span className={styles.key}>Fabricante</span>
                <span className={styles.value}>{resultado.maker || "—"}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.key}>Peso</span>
                <span className={styles.value}>
                  {resultado.pesoKg ? `${resultado.pesoKg} kg` : "Sin dato"}
                </span>
              </div>
              {resultado.envioResultado === "extra_automatico" && (
                <div className={styles.infoRow}>
                  <span className={styles.key}>Extra por peso</span>
                  <span className={styles.value}>${fmt(resultado.envioExtraClp ?? 0)} CLP</span>
                </div>
              )}
              <div className={styles.infoRow}>
                <span className={styles.key}>Fecha consulta</span>
                <span className={styles.value}>{resultado.fecha}</span>
              </div>
            </div>

            {resultado.envioResultado === "estandar" && (
              <p className={styles.envioEstandar}>{resultado.envioMensaje}</p>
            )}

            {resultado.envioResultado === "extra_automatico" && (
              <div className={styles.envioExtraBox}>{resultado.envioMensaje}</div>
            )}

            {resultado.envioResultado === "alerta_whatsapp" && (
              <div className={styles.envioAlertaBox}>
                <p className={styles.envioAlertaTitle}>⚠️ Envío a cotizar</p>
                <p className={styles.envioAlertaText}>{resultado.envioMensaje}</p>
                <a
                  className={styles.envioAlertaBtn}
                  href={`https://wa.me/56954156358?text=${encodeURIComponent(
                    `Hola, quiero cotizar el envío de la pieza ${resultado.partNumber}` +
                      `${resultado.nombre ? ` (${resultado.nombre})` : ""}.`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Confirmar por WhatsApp
                </a>
              </div>
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
                <span>Subtotal repuestos</span>
                <span>${fmt(subtotalRepuestos)} CLP</span>
              </div>
              <div className={styles.cartTotalRow}>
                <span>Costo de logística (único)</span>
                <span>${fmt(costoLogisticaClp)} CLP</span>
              </div>
              <div className={`${styles.cartTotalRow} ${styles.cartTotalFinal}`}>
                <span>Total</span>
                <span>${fmt(totalCotizacion)} CLP · IVA incluido</span>
              </div>
            </div>
            <div className={styles.addRow}>
              <button className={styles.addBtn} onClick={procederAlPago}>
                Proceder al pago →
              </button>
            </div>
          </div>
        )}

        <div className={styles.noticeCard}>
          <div className={styles.noticeTitle}>⚠️ Importante: sobrecargo por volumen</div>
          <p className={styles.noticeText}>
            El precio cotizado corresponde a repuestos OEM 100% originales de tamaño y peso
            estándar.
          </p>

          {verMasSobrecargo && (
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

          <button
            type="button"
            className={styles.noticeToggle}
            onClick={() => setVerMasSobrecargo((v) => !v)}
          >
            {verMasSobrecargo ? "Ver menos ▲" : "Ver más ▼"}
          </button>
        </div>
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
