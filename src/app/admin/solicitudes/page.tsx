"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
}

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
        </nav>
        <div className={styles.topbarBadge}>Administrador</div>
        <button className={styles.btnLimpiarManual} onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </header>

      <div className={styles.main}>
        <div className={styles.sectionLabel}>Solicitudes N° de parte</div>
        <div className={styles.panel}>
          {error && <div className={styles.emptyMsg}>{error}</div>}

          {!error && solicitudes === null && <div className={styles.emptyMsg}>Cargando…</div>}

          {!error && solicitudes !== null && solicitudes.length === 0 && (
            <div className={styles.emptyMsg}>No hay solicitudes todavía.</div>
          )}

          {solicitudes?.map((s) => (
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
                </div>
              </div>

              {expandidoId === s.id && (
                <div className={styles.pedidoDetalle}>
                  <div className={styles.details}>
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
