"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ResultadoCotizacion } from "@/lib/cotizar";
import styles from "./admin.module.css";

function fmt(n: number): string {
  return new Intl.NumberFormat("es-CL").format(n);
}

export default function AdminPage() {
  const partInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const [tcValor, setTcValor] = useState("Cargando…");
  const [tcFuente, setTcFuente] = useState("—");
  const [manualActivo, setManualActivo] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCotizacion | null>(null);
  const [error, setError] = useState<{ title: string; msg: string } | null>(null);

  async function cargarTasa() {
    setTcValor("Cargando…");
    setTcFuente("—");
    try {
      const r = await fetch("/api/tipo-cambio");
      const d = await r.json();
      if (d.tasa) {
        setTcValor(`${d.tasa} CLP/JPY`);
        setTcFuente(d.fuente);
      } else {
        setTcValor("Error");
        setTcFuente(d.error || "");
      }
    } catch {
      setTcValor("Sin conexión");
    }
  }

  useEffect(() => {
    cargarTasa();
  }, []);

  function onTcManualChange() {
    const val = manualInputRef.current?.value.trim() ?? "";
    setManualActivo(Boolean(val) && parseFloat(val) > 0);
  }

  function limpiarManual() {
    if (manualInputRef.current) manualInputRef.current.value = "";
    setManualActivo(false);
  }

  function getOverride(): number | null {
    const val = manualInputRef.current?.value.trim() ?? "";
    const n = parseFloat(val);
    return val && n > 0 ? n : null;
  }

  async function buscar() {
    const part = partInputRef.current?.value.trim().toUpperCase() ?? "";
    if (!part) {
      partInputRef.current?.focus();
      return;
    }

    setLoading(true);
    setResultado(null);
    setError(null);

    let data: ResultadoCotizacion;
    try {
      const override = getOverride();
      const res = await fetch("/api/cotizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partNumber: part,
          ...(override ? { tipoCambioOverride: override } : {}),
        }),
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
    } else if (data.estado === "no_encontrado") {
      setError({ title: "Repuesto no encontrado", msg: data.mensaje ?? "" });
    } else {
      setError({ title: "Error en la búsqueda", msg: data.mensaje ?? "Intenta nuevamente." });
    }
  }

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarBrand}>
          Raul<span>Speed</span>
        </div>
        <div className={styles.topbarDivider} />
        <div className={styles.topbarSub}>Cotizador Interno</div>
        <div className={styles.topbarBadge}>Administrador</div>
      </header>

      <div className={styles.main}>
        {/* Tipo de cambio */}
        <div className={styles.sectionLabel}>Tipo de Cambio</div>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>JPY → CLP</span>
            <span
              className={`${styles.tcModeIndicator} ${
                manualActivo ? styles.manual : styles.auto
              }`}
            >
              {manualActivo ? "Manual" : "Automático"}
            </span>
          </div>
          <div className={styles.tcBody}>
            <div className={styles.tcAutoRow}>
              <div className={styles.tcAutoInfo}>
                <span className={styles.tcAutoLabel}>Tasa actual</span>
                <span className={styles.tcAutoValue}>{tcValor}</span>
                <span className={styles.tcAutoFuente}>{tcFuente}</span>
              </div>
              <button className={styles.btnRefreshTasa} onClick={cargarTasa}>
                Actualizar
              </button>
            </div>
            <hr className={styles.tcSeparator} />
            <div className={styles.tcManualRow}>
              <label htmlFor="tcManualInput">Tasa manual</label>
              <input
                id="tcManualInput"
                ref={manualInputRef}
                className={styles.tcManualInput}
                type="number"
                step="0.000001"
                min="0"
                placeholder="Ej: 5.85"
                onInput={onTcManualChange}
              />
              <span className={styles.tcUnit}>CLP / JPY</span>
              <button className={styles.btnLimpiarManual} onClick={limpiarManual}>
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* Buscador */}
        <div className={`${styles.sectionLabel} ${styles.sectionLabelSpaced}`}>Búsqueda</div>
        <div className={styles.panel}>
          <div className={styles.inputRow}>
            <input
              ref={partInputRef}
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
            Número de parte OEM exacto · <span>Solo piezas genuinas</span>
          </p>
        </div>

        <div className={`${styles.loader} ${loading ? styles.visible : ""}`}>
          <div className={styles.spinner} />
          <span>Consultando Impex Japan…</span>
        </div>

        {error && (
          <div className={`${styles.errorBox} ${styles.visible}`}>
            <strong>{error.title}</strong>
            <span>{error.msg}</span>
          </div>
        )}

        {resultado && resultado.estado === "ok" && (
          <div className={`${styles.resultCard} ${styles.visible}`}>
            <div className={styles.resultTop}>
              <div>
                <h2>{resultado.partNumber}</h2>
                <p>
                  {[resultado.maker, resultado.nombre].filter(Boolean).join(" · ") ||
                    "Pieza OEM genuina"}
                </p>
              </div>
              <span className={`${styles.badge} ${styles.ok}`}>OEM Genuine</span>
            </div>

            <div className={styles.priceHero}>
              <div className={styles.priceLabel}>Precio Final en Peso Chileno</div>
              <div>
                <span className={styles.priceAmount}>
                  {fmt(resultado.precioClpFinal ?? 0)}
                </span>
                <span className={styles.priceCurrency}>CLP</span>
              </div>
            </div>

            <div className={styles.details}>
              <div className={styles.detailRow}>
                <span className={styles.key}>Fabricante</span>
                <span className={styles.value}>{resultado.maker || "—"}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.key}>Precio JPY (origen)</span>
                <span className={`${styles.value} ${styles.highlight}`}>
                  ¥{fmt(resultado.precioJpy ?? 0)}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.key}>Tipo de cambio usado</span>
                <span className={styles.value}>{resultado.tipoCambioClp} CLP/JPY</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.key}>Fuente tipo de cambio</span>
                <span className={styles.value}>{resultado.fuenteTipoCambio}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.key}>Fuente precio</span>
                <span className={styles.value}>{resultado.fuente}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.key}>Fecha consulta</span>
                <span className={styles.value}>{resultado.fecha}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className={styles.footer}>
        <span>Raulspeed</span> · Panel Administrador ·{" "}
        <Link href="/">Ver vista cliente</Link>
      </footer>
    </>
  );
}
