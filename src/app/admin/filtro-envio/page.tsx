"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CategoriaFiltro, TerminoFiltro } from "@/lib/filtroEnvioConfig";
import type { ConfigFiltroEnvio } from "@/lib/sobrecargoEnvio";
import { createClient } from "@/lib/supabase/client";
import styles from "../admin.module.css";

const CATEGORIAS: { key: CategoriaFiltro; label: string; ayuda: string }[] = [
  {
    key: "voluminosas",
    label: "Voluminosas",
    ayuda: "El nombre manda sobre el peso: alarman con >500 g o sin peso.",
  },
  {
    key: "pesadas",
    label: "Pesadas",
    ayuda: "Solo deciden cuando NO hay peso utilizable.",
  },
  {
    key: "precision",
    label: "Precisión / electrónica",
    ayuda: "Nunca alarman por nombre; sin peso ignoran el precio.",
  },
  {
    key: "exclusiones",
    label: "Exclusiones",
    ayuda: "Apagan la alarma de nombre, pero el precio sí sigue aplicando.",
  },
  {
    key: "subpiezas",
    label: "Subpiezas",
    ayuda: "Accesorio menor: no alarma por nombre, el precio sí aplica.",
  },
];

const UMBRALES: { key: keyof ConfigFiltroEnvio; label: string; unidad: string }[] = [
  { key: "pesoIncluidoKg", label: "Peso incluido", unidad: "kg" },
  { key: "cobroKiloExtraClp", label: "Cobro por kg extra", unidad: "CLP" },
  { key: "pesoMaximoKg", label: "Peso máximo", unidad: "kg" },
  { key: "precioSeguroSinPesoClp", label: "Precio seguro sin peso", unidad: "CLP" },
  { key: "exencionVoluminosasKg", label: "Exención voluminosas", unidad: "kg" },
  { key: "precioMinimoVoluminosaClp", label: "Precio mínimo voluminosa", unidad: "CLP" },
];

type ListasAdmin = Record<CategoriaFiltro, TerminoFiltro[]>;

export default function AdminFiltroEnvioPage() {
  const router = useRouter();

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [umbrales, setUmbrales] = useState<Record<string, string>>({});
  const [guardandoUmbrales, setGuardandoUmbrales] = useState(false);
  const [msgUmbrales, setMsgUmbrales] = useState<string | null>(null);

  const [listas, setListas] = useState<ListasAdmin | null>(null);
  const [addInputs, setAddInputs] = useState<Record<CategoriaFiltro, string>>({
    voluminosas: "",
    pesadas: "",
    precision: "",
    exclusiones: "",
    subpiezas: "",
  });
  const [agregando, setAgregando] = useState<CategoriaFiltro | null>(null);
  const [msgPorCategoria, setMsgPorCategoria] = useState<Record<string, string>>({});

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/filtro-envio");
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "No se pudo cargar el filtro de envío");
        setCargando(false);
        return;
      }
      const config: ConfigFiltroEnvio = d.config;
      setUmbrales(
        Object.fromEntries(UMBRALES.map(({ key }) => [key, String(config[key])])),
      );
      setListas(d.listas);
    } catch {
      setError("Error de conexión");
    }
    setCargando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, []);

  async function guardarUmbrales() {
    const cambios: Record<string, number> = {};
    for (const { key } of UMBRALES) {
      const valor = Number(umbrales[key]);
      if (!Number.isFinite(valor) || valor < 0) {
        setMsgUmbrales(`Valor inválido en "${key}"`);
        return;
      }
      cambios[key] = valor;
    }

    setGuardandoUmbrales(true);
    setMsgUmbrales(null);
    try {
      const r = await fetch("/api/admin/filtro-envio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsgUmbrales(d.error || "No se pudo guardar");
      } else {
        setMsgUmbrales("Guardado");
      }
    } catch {
      setMsgUmbrales("Error de conexión");
    }
    setGuardandoUmbrales(false);
  }

  async function agregarTermino(categoria: CategoriaFiltro) {
    const termino = addInputs[categoria].trim();
    if (!termino) return;

    setAgregando(categoria);
    setMsgPorCategoria((prev) => ({ ...prev, [categoria]: "" }));
    try {
      const r = await fetch("/api/admin/filtro-envio/terminos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoria, termino }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsgPorCategoria((prev) => ({ ...prev, [categoria]: d.error || "No se pudo agregar" }));
      } else {
        setAddInputs((prev) => ({ ...prev, [categoria]: "" }));
        await cargar();
      }
    } catch {
      setMsgPorCategoria((prev) => ({ ...prev, [categoria]: "Error de conexión" }));
    }
    setAgregando(null);
  }

  async function eliminarTermino(categoria: CategoriaFiltro, id: string) {
    // Optimista: saca el chip de inmediato, lo repone si falla.
    setListas((prev) => {
      if (!prev) return prev;
      return { ...prev, [categoria]: prev[categoria].filter((t) => t.id !== id) };
    });
    try {
      const r = await fetch("/api/admin/filtro-envio/terminos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) await cargar();
    } catch {
      await cargar();
    }
  }

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarBrand}>
          Raul<span>Speed</span>
        </div>
        <div className={styles.topbarDivider} />
        <nav className={styles.topbarNav}>
          <Link href="/admin" className={styles.topbarNavLink}>
            Cotizador
          </Link>
          <Link href="/admin/pedidos" className={styles.topbarNavLink}>
            Pedidos
          </Link>
          <Link href="/admin/solicitudes" className={styles.topbarNavLink}>
            Solicitudes N° parte
          </Link>
          <Link href="/admin/repuestos" className={styles.topbarNavLink}>
            Repuestos
          </Link>
          <Link
            href="/admin/filtro-envio"
            className={`${styles.topbarNavLink} ${styles.topbarNavLinkActive}`}
          >
            Filtros de envío
          </Link>
        </nav>
        <div className={styles.topbarBadge}>Administrador</div>
        <button className={styles.btnLimpiarManual} onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </header>

      <div className={styles.main}>
        <div className={styles.sectionLabel}>Umbrales</div>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Peso, tarifa y precios del filtro</span>
          </div>
          {cargando ? (
            <div className={styles.emptyMsg}>Cargando…</div>
          ) : (
            <>
              <div className={styles.filtroThresholdGrid}>
                {UMBRALES.map(({ key, label, unidad }) => (
                  <div className={styles.filtroThresholdItem} key={key}>
                    <label htmlFor={`umbral-${key}`}>
                      {label} ({unidad})
                    </label>
                    <input
                      id={`umbral-${key}`}
                      className={styles.filtroThresholdInput}
                      type="number"
                      step="any"
                      min="0"
                      value={umbrales[key] ?? ""}
                      onChange={(e) =>
                        setUmbrales((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className={styles.filtroThresholdFooter}>
                <button
                  className={styles.btnRefreshTasa}
                  disabled={guardandoUmbrales}
                  onClick={guardarUmbrales}
                >
                  {guardandoUmbrales ? "Guardando…" : "Guardar umbrales"}
                </button>
                {msgUmbrales && <span className={styles.tcAutoFuente}>{msgUmbrales}</span>}
              </div>
            </>
          )}
        </div>

        {error && (
          <div className={`${styles.errorBox} ${styles.visible}`}>
            <strong>Error</strong>
            <span>{error}</span>
          </div>
        )}

        {!cargando &&
          listas &&
          CATEGORIAS.map(({ key, label, ayuda }) => (
            <div key={key}>
              <div className={`${styles.sectionLabel} ${styles.sectionLabelSpaced}`}>{label}</div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <span>{ayuda}</span>
                  <span>{listas[key].length} términos</span>
                </div>
                <div className={styles.terminoAddRow}>
                  <input
                    className={styles.terminoAddInput}
                    type="text"
                    placeholder="Ej: COWL o カウル"
                    value={addInputs[key]}
                    onChange={(e) =>
                      setAddInputs((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && agregarTermino(key)}
                  />
                  <button
                    className={styles.btnRefreshTasa}
                    disabled={agregando === key}
                    onClick={() => agregarTermino(key)}
                  >
                    {agregando === key ? "Agregando…" : "Agregar"}
                  </button>
                </div>
                {msgPorCategoria[key] && (
                  <div className={styles.terminoCategoriaMsg}>{msgPorCategoria[key]}</div>
                )}
                {listas[key].length === 0 ? (
                  <div className={styles.terminoEmpty}>Sin términos en esta categoría.</div>
                ) : (
                  <div className={styles.terminoList}>
                    {listas[key].map((t) => (
                      <span className={styles.terminoChip} key={t.id}>
                        {t.termino}
                        <button
                          className={styles.terminoChipDelete}
                          onClick={() => eliminarTermino(key, t.id)}
                          aria-label={`Borrar ${t.termino}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>

      <footer className={styles.footer}>
        <span>Raulspeed</span> · Panel Administrador ·{" "}
        <Link href="/">Ver vista cliente</Link>
      </footer>
    </>
  );
}
