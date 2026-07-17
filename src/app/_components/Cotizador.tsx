"use client";

import { useRef, useState } from "react";
import type { ItemCotizacion } from "@/lib/carrito";
import type { ResultadoCotizacion } from "@/lib/cotizar";
import { EnvioAlertaCard, EnvioEstandarCard } from "./EnvioCards";
import { fmt, redondearAproximado } from "./format";
import { InfoBoxes } from "./InfoBoxes";
import styles from "../page.module.css";

export function Cotizador({
  onCotizado,
  onAgregarAlCarrito,
  onAbrirSolicitud,
}: {
  /** Se llama con el costo de logística cada vez que llega una cotización exitosa. */
  onCotizado: (costoLogisticaClp: number) => void;
  onAgregarAlCarrito: (item: ItemCotizacion) => void;
  onAbrirSolicitud: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCotizacion | null>(null);
  const [error, setError] = useState<{ title: string; msg: string } | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [verMasSobrecargo, setVerMasSobrecargo] = useState(false);

  async function buscar() {
    // El botón se deshabilita con loading, pero el Enter del input no pasa
    // por el botón: sin este guard, Enter repetido dispara varios fetch en
    // paralelo y "gana" la respuesta que llegue última, sea cual sea.
    if (loading) return;

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
    let status = 0;
    try {
      const res = await fetch("/api/cotizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partNumber: part }),
      });
      status = res.status;
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
      onCotizado(data.costoLogisticaClp ?? 0);
    } else if (data.estado === "no_encontrado") {
      setError({ title: "Repuesto no encontrado", msg: data.mensaje ?? "" });
    } else if (status === 429) {
      // Rate limit propio: el mensaje del servidor ("espera un minuto") es
      // más útil que el genérico de problema técnico.
      setError({
        title: "Demasiadas consultas seguidas",
        msg: data.mensaje ?? "Espera un minuto e intenta de nuevo.",
      });
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

    onAgregarAlCarrito({
      id: `${resultado.partNumber}-${Date.now()}`,
      partNumber: resultado.partNumber,
      maker: resultado.maker,
      nombre: resultado.nombre,
      precioRepuestoClp: resultado.precioRepuestoClp ?? 0,
      pesoKg: resultado.pesoKg ?? 0,
      cantidad,
    });

    setResultado(null);
    setCantidad(1);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }

  return (
    <>
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
          onAbrirSolicitud={onAbrirSolicitud}
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
          onAbrirSolicitud={onAbrirSolicitud}
          verMasSobrecargo={verMasSobrecargo}
          onToggleVerMasSobrecargo={() => setVerMasSobrecargo((v) => !v)}
        />
      )}
    </>
  );
}
