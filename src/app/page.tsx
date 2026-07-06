"use client";

import { useRef, useState } from "react";
import type { ResultadoCotizacion } from "@/lib/cotizar";
import styles from "./page.module.css";

interface ItemCotizacion {
  id: string;
  partNumber: string;
  maker?: string;
  nombre?: string;
  precioRepuestoClp: number;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("es-CL").format(n);
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCotizacion | null>(null);
  const [error, setError] = useState<{ title: string; msg: string } | null>(null);

  const [items, setItems] = useState<ItemCotizacion[]>([]);
  const [costoLogisticaClp, setCostoLogisticaClp] = useState(0);

  async function buscar() {
    const part = inputRef.current?.value.trim().toUpperCase() ?? "";
    if (!part) {
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    setResultado(null);
    setError(null);

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

  function agregarALaCotizacion() {
    if (!resultado || resultado.estado !== "ok") return;

    setItems((prev) => [
      ...prev,
      {
        id: `${resultado.partNumber}-${Date.now()}`,
        partNumber: resultado.partNumber,
        maker: resultado.maker,
        nombre: resultado.nombre,
        precioRepuestoClp: resultado.precioRepuestoClp ?? 0,
      },
    ]);

    setResultado(null);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }

  function quitarItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  const subtotalRepuestos = items.reduce((sum, item) => sum + item.precioRepuestoClp, 0);
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
                  {fmt(resultado.precioClpFinal ?? 0)}
                </span>
                <span className={styles.priceCurrency}>CLP · IVA incluido</span>
              </div>
            </div>
            <div className={styles.infoRows}>
              <div className={styles.infoRow}>
                <span className={styles.key}>Fabricante</span>
                <span className={styles.value}>{resultado.maker || "—"}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.key}>Fecha consulta</span>
                <span className={styles.value}>{resultado.fecha}</span>
              </div>
            </div>
            <div className={styles.addRow}>
              <button className={styles.addBtn} onClick={agregarALaCotizacion}>
                + Agregar a la cotización
              </button>
            </div>
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
                  <span className={styles.cartItemPrice}>
                    ${fmt(item.precioRepuestoClp)}
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
          </div>
        )}

        <div className={styles.noticeCard}>
          <div className={styles.noticeTitle}>⚠️ Importante: sobrecargo por volumen</div>
          <p className={styles.noticeText}>
            El precio cotizado corresponde a repuestos OEM 100% originales de tamaño y peso
            estándar.
          </p>
          <p className={styles.noticeText}>
            Repuestos de alto volumen (carenados, estanques, basculantes, llantas, cigüeñales,
            entre otros) tienen un sobrecargo por envío internacional.
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
        </div>
      </div>

      <footer className={styles.footer}>
        <span>Raulspeed</span> · Importación directa de repuestos originales
      </footer>
    </>
  );
}
