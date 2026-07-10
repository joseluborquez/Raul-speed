"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ResultadoCotizacion } from "@/lib/cotizar";
import { createClient } from "@/lib/supabase/client";
import styles from "./admin.module.css";

function fmt(n: number): string {
  return new Intl.NumberFormat("es-CL").format(n);
}

export default function AdminPage() {
  const router = useRouter();
  const partInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const logisticaInputRef = useRef<HTMLInputElement>(null);

  const [tcValor, setTcValor] = useState("Cargando…");
  const [tcFuente, setTcFuente] = useState("—");
  const [manualActivo, setManualActivo] = useState(false);
  const [manualGuardando, setManualGuardando] = useState(false);
  const [manualMsg, setManualMsg] = useState<string | null>(null);

  const [logisticaGuardando, setLogisticaGuardando] = useState(false);
  const [logisticaMsg, setLogisticaMsg] = useState<string | null>(null);

  const descuentoDhlInputRef = useRef<HTMLInputElement>(null);
  const [descuentoDhlGuardando, setDescuentoDhlGuardando] = useState(false);
  const [descuentoDhlMsg, setDescuentoDhlMsg] = useState<string | null>(null);

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

  async function cargarSettings() {
    try {
      const r = await fetch("/api/settings");
      const d = await r.json();
      if (logisticaInputRef.current) {
        logisticaInputRef.current.value = String(d.costoLogisticaClp ?? 0);
      }
      if (descuentoDhlInputRef.current) {
        descuentoDhlInputRef.current.value = String(d.descuentoSobrecargoDhlPct ?? 50);
      }
      if (d.tipoCambioManual !== null && d.tipoCambioManual !== undefined) {
        if (manualInputRef.current) manualInputRef.current.value = String(d.tipoCambioManual);
        setManualActivo(true);
      } else {
        if (manualInputRef.current) manualInputRef.current.value = "";
        setManualActivo(false);
      }
    } catch {
      // se dejan los campos vacíos; el admin puede reintentar guardando.
    }
  }

  async function guardarLogistica() {
    const val = Number(logisticaInputRef.current?.value ?? "");
    if (!Number.isFinite(val) || val < 0) {
      setLogisticaMsg("Ingresa un valor válido");
      return;
    }

    setLogisticaGuardando(true);
    setLogisticaMsg(null);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costoLogisticaClp: val }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setLogisticaMsg(d.error || "No se pudo guardar");
      } else {
        setLogisticaMsg("Guardado");
      }
    } catch {
      setLogisticaMsg("Error de conexión");
    }
    setLogisticaGuardando(false);
  }

  async function guardarDescuentoDhl() {
    const val = Number(descuentoDhlInputRef.current?.value ?? "");
    if (!Number.isFinite(val) || val < 0 || val > 100) {
      setDescuentoDhlMsg("Ingresa un valor entre 0 y 100");
      return;
    }

    setDescuentoDhlGuardando(true);
    setDescuentoDhlMsg(null);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descuentoSobrecargoDhlPct: val }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setDescuentoDhlMsg(d.error || "No se pudo guardar");
      } else {
        setDescuentoDhlMsg("Guardado");
      }
    } catch {
      setDescuentoDhlMsg("Error de conexión");
    }
    setDescuentoDhlGuardando(false);
  }

  async function guardarManual() {
    const val = Number(manualInputRef.current?.value ?? "");
    if (!Number.isFinite(val) || val <= 0) {
      setManualMsg("Ingresa una tasa válida");
      return;
    }

    setManualGuardando(true);
    setManualMsg(null);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoCambioManual: val }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setManualMsg(d.error || "No se pudo guardar");
      } else {
        setManualActivo(true);
        setManualMsg("Guardado — se aplica a todas las cotizaciones");
      }
    } catch {
      setManualMsg("Error de conexión");
    }
    setManualGuardando(false);
  }

  async function limpiarManual() {
    setManualGuardando(true);
    setManualMsg(null);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoCambioManual: null }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setManualMsg(d.error || "No se pudo desactivar");
      } else {
        if (manualInputRef.current) manualInputRef.current.value = "";
        setManualActivo(false);
        setManualMsg("Vuelto a automático");
      }
    } catch {
      setManualMsg("Error de conexión");
    }
    setManualGuardando(false);
  }

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  useEffect(() => {
    cargarTasa();
    cargarSettings();
  }, []);

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
        <nav className={styles.topbarNav}>
          <Link href="/admin" className={`${styles.topbarNavLink} ${styles.topbarNavLinkActive}`}>
            Cotizador
          </Link>
          <Link href="/admin/pedidos" className={styles.topbarNavLink}>
            Pedidos
          </Link>
          <Link href="/admin/solicitudes" className={styles.topbarNavLink}>
            Solicitudes N° parte
          </Link>
        </nav>
        <div className={styles.topbarBadge}>Administrador</div>
        <button className={styles.btnLimpiarManual} onClick={cerrarSesion}>
          Cerrar sesión
        </button>
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
                <span className={styles.tcAutoLabel}>Tasa actual (Banco Central)</span>
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
              />
              <span className={styles.tcUnit}>CLP / JPY</span>
              <button
                className={styles.btnRefreshTasa}
                disabled={manualGuardando}
                onClick={guardarManual}
              >
                {manualGuardando ? "Guardando…" : "Guardar"}
              </button>
              <button
                className={styles.btnLimpiarManual}
                disabled={manualGuardando}
                onClick={limpiarManual}
              >
                Limpiar
              </button>
            </div>
            {manualMsg && <span className={styles.tcAutoFuente}>{manualMsg}</span>}
          </div>
        </div>

        {/* Costo de logística */}
        <div className={`${styles.sectionLabel} ${styles.sectionLabelSpaced}`}>
          Costo de Logística
        </div>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Se suma a cada cotización</span>
          </div>
          <div className={styles.tcBody}>
            <div className={styles.tcManualRow}>
              <label htmlFor="logisticaInput">Costo logística</label>
              <input
                id="logisticaInput"
                ref={logisticaInputRef}
                className={styles.tcManualInput}
                type="number"
                step="1"
                min="0"
                placeholder="Ej: 15000"
              />
              <span className={styles.tcUnit}>CLP</span>
              <button
                className={styles.btnRefreshTasa}
                disabled={logisticaGuardando}
                onClick={guardarLogistica}
              >
                {logisticaGuardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
            {logisticaMsg && <span className={styles.tcAutoFuente}>{logisticaMsg}</span>}
          </div>
        </div>

        {/* Descuento sobrecargo por volumen (DHL) */}
        <div className={`${styles.sectionLabel} ${styles.sectionLabelSpaced}`}>
          Sobrecargo por Volumen (DHL)
        </div>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>
              Piezas sin peso/tamaño en Yumbo: se cobra este % del flete DHL real
            </span>
          </div>
          <div className={styles.tcBody}>
            <div className={styles.tcManualRow}>
              <label htmlFor="descuentoDhlInput">Descuento sobre flete DHL</label>
              <input
                id="descuentoDhlInput"
                ref={descuentoDhlInputRef}
                className={styles.tcManualInput}
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="Ej: 50"
              />
              <span className={styles.tcUnit}>%</span>
              <button
                className={styles.btnRefreshTasa}
                disabled={descuentoDhlGuardando}
                onClick={guardarDescuentoDhl}
              >
                {descuentoDhlGuardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
            {descuentoDhlMsg && <span className={styles.tcAutoFuente}>{descuentoDhlMsg}</span>}
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
          <span>Consultando Yumbo Japan…</span>
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
                <span className={styles.key}>Precio repuesto (sin logística)</span>
                <span className={styles.value}>
                  ${fmt(resultado.precioRepuestoClp ?? 0)} CLP
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.key}>Costo logística</span>
                <span className={styles.value}>
                  ${fmt(resultado.costoLogisticaClp ?? 0)} CLP
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.key}>Peso (Yumbo)</span>
                <span className={styles.value}>
                  {resultado.pesoKg ? `${resultado.pesoKg} kg` : "Sin dato (posible sobrecargo)"}
                </span>
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
