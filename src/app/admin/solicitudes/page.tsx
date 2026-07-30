"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ESTADO_SOLICITUD_LABELS,
  ESTADOS_SOLICITUD,
  type EstadoSolicitud,
} from "@/lib/estadoGestion";
import { createClient } from "@/lib/supabase/client";
import styles from "../admin.module.css";

interface SolicitudRow {
  id: string;
  created_at: string;
  nombre_apellido: string;
  descripcion_repuesto: string;
  contacto: string;
  moto: string;
  chasis_vin_patente: string;
  estado: EstadoSolicitud;
}

const FILTROS: { value: EstadoSolicitud | "todos"; label: string }[] = [
  { value: "todos", label: "Todas" },
  ...ESTADOS_SOLICITUD.map((estado) => ({
    value: estado,
    label: ESTADO_SOLICITUD_LABELS[estado],
  })),
];

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminSolicitudesPage() {
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<SolicitudRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoSolicitud | "todos">("todos");
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

  // Igual que en pedidos: se pinta el estado nuevo de inmediato y se
  // revierte si el PATCH falla.
  async function cambiarEstado(solicitud: SolicitudRow, estado: EstadoSolicitud) {
    const previo = solicitud.estado;
    setErrorAccion(null);
    setOcupadoId(solicitud.id);
    setSolicitudes(
      (prev) => prev?.map((s) => (s.id === solicitud.id ? { ...s, estado } : s)) ?? prev,
    );

    try {
      const res = await fetch("/api/admin/solicitudes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: solicitud.id, estado }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar el estado");
      }
    } catch (exc) {
      setSolicitudes(
        (prev) =>
          prev?.map((s) => (s.id === solicitud.id ? { ...s, estado: previo } : s)) ?? prev,
      );
      setErrorAccion(exc instanceof Error ? exc.message : "No se pudo guardar el estado");
    } finally {
      setOcupadoId(null);
    }
  }

  async function borrarSolicitud(solicitud: SolicitudRow) {
    if (
      !window.confirm(
        `Vas a eliminar la solicitud de ${solicitud.nombre_apellido}. No se puede deshacer.`,
      )
    )
      return;

    setErrorAccion(null);
    setOcupadoId(solicitud.id);
    try {
      const res = await fetch("/api/admin/solicitudes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: solicitud.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar la solicitud");
      }
      setSolicitudes((prev) => prev?.filter((s) => s.id !== solicitud.id) ?? prev);
      setExpandidoId((prev) => (prev === solicitud.id ? null : prev));
    } catch (exc) {
      setErrorAccion(exc instanceof Error ? exc.message : "No se pudo eliminar la solicitud");
    } finally {
      setOcupadoId(null);
    }
  }

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  useEffect(() => {
    fetch("/api/admin/solicitudes")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setSolicitudes(d.solicitudes);
      })
      .catch(() => setError("Error de conexión"));
  }, []);

  const solicitudesFiltradas = (solicitudes ?? []).filter(
    (s) => filtro === "todos" || s.estado === filtro,
  );

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
          <Link
            href="/admin/solicitudes"
            className={`${styles.topbarNavLink} ${styles.topbarNavLinkActive}`}
          >
            Solicitudes N° parte
          </Link>
          <Link href="/admin/repuestos" className={styles.topbarNavLink}>
            Repuestos
          </Link>
          <Link href="/admin/filtro-envio" className={styles.topbarNavLink}>
            Filtros de envío
          </Link>
        </nav>
        <div className={styles.topbarBadge}>Administrador</div>
        <button className={styles.btnLimpiarManual} onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </header>

      <div className={styles.main}>
        <div className={styles.sectionLabel}>Solicitudes N° de parte</div>
        <div className={styles.panel}>
          <div className={styles.filterRow}>
            {FILTROS.map((f) => (
              <button
                key={f.value}
                className={`${styles.filterBtn} ${
                  filtro === f.value ? styles.filterBtnActive : ""
                }`}
                onClick={() => setFiltro(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {error && <div className={styles.emptyMsg}>{error}</div>}

          {errorAccion && <div className={styles.accionError}>{errorAccion}</div>}

          {!error && solicitudes === null && <div className={styles.emptyMsg}>Cargando…</div>}

          {!error && solicitudes !== null && solicitudesFiltradas.length === 0 && (
            <div className={styles.emptyMsg}>
              {solicitudes.length === 0
                ? "No hay solicitudes todavía."
                : "No hay solicitudes en este estado."}
            </div>
          )}

          {solicitudesFiltradas.map((s) => (
            <div key={s.id}>
              <div
                className={styles.pedidoRow}
                onClick={() => setExpandidoId(expandidoId === s.id ? null : s.id)}
              >
                <div className={styles.pedidoRowInfo}>
                  <span className={styles.pedidoRowNombre}>{s.nombre_apellido}</span>
                  <span className={styles.pedidoRowMeta}>{fmtFecha(s.created_at)}</span>
                </div>
                <div className={styles.pedidoRowRight}>
                  <span className={styles.pedidoRowTotal}>{s.contacto}</span>
                  <span className={`${styles.badge} ${styles.neutral}`}>
                    {ESTADO_SOLICITUD_LABELS[s.estado]}
                  </span>
                </div>
              </div>

              {expandidoId === s.id && (
                <div className={styles.pedidoDetalle}>
                  <div className={styles.details}>
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Seguimiento</span>
                      <select
                        className={styles.estadoSelect}
                        value={s.estado}
                        disabled={ocupadoId === s.id}
                        onChange={(e) => cambiarEstado(s, e.target.value as EstadoSolicitud)}
                      >
                        {ESTADOS_SOLICITUD.map((estado) => (
                          <option key={estado} value={estado}>
                            {ESTADO_SOLICITUD_LABELS[estado]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Contacto</span>
                      <span className={styles.value}>{s.contacto}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Moto</span>
                      <span className={styles.value}>{s.moto}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Chasis / VIN / Patente</span>
                      <span className={styles.value}>{s.chasis_vin_patente}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Descripción del repuesto</span>
                      <span className={styles.value}>{s.descripcion_repuesto}</span>
                    </div>
                  </div>
                  <div className={styles.accionesRow}>
                    <button
                      className={styles.btnEliminar}
                      disabled={ocupadoId === s.id}
                      onClick={() => borrarSolicitud(s)}
                    >
                      Eliminar solicitud
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <footer className={styles.footer}>
        <span>Raulspeed</span> · Panel Administrador ·{" "}
        <Link href="/">Ver vista cliente</Link>
      </footer>
    </>
  );
}
