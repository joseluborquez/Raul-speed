"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ESTADO_GESTION_LABELS,
  ESTADOS_GESTION,
  type EstadoGestion,
} from "@/lib/estadoGestion";
import { METODO_ENVIO_LABELS, type MetodoEnvio } from "@/lib/metodoEnvio";
import { describirMotivoPago } from "@/lib/motivoPago";
import type { EstadoPedido, ItemPedido, MetodoPago } from "@/lib/pedidos";
import { createClient } from "@/lib/supabase/client";
import styles from "../admin.module.css";

interface PedidoRow {
  id: string;
  created_at: string;
  items: ItemPedido[];
  subtotal_repuestos_clp: number;
  sobrecargo_peso_clp: number;
  peso_total_kg: number;
  costo_logistica_clp: number;
  total_clp: number;
  nombre_completo: string;
  rut: string;
  telefono: string;
  email: string;
  metodo_envio: MetodoEnvio;
  envio_detalle: string | null;
  region: string;
  ciudad: string;
  comuna: string;
  direccion: string;
  estado: EstadoPedido;
  estado_gestion: EstadoGestion;
  metodo_pago: MetodoPago | null;
  raw_provider_payload: unknown;
}

const FILTROS: { value: EstadoPedido | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendiente", label: "Pendiente" },
  { value: "pagado", label: "Pagado" },
  { value: "fallido", label: "Fallido" },
  { value: "expirado", label: "Expirado" },
  { value: "reembolsado", label: "Reembolsado" },
];

function fmt(n: number): string {
  return new Intl.NumberFormat("es-CL").format(n);
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

function badgeClass(estado: EstadoPedido): string {
  if (estado === "pagado") return styles.ok;
  if (estado === "fallido" || estado === "expirado") return styles.error;
  if (estado === "reembolsado") return styles.refunded;
  return styles.pending;
}

export default function AdminPedidosPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<PedidoRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoPedido | "todos">("todos");
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

  // El seguimiento se guarda optimista: el select cambia al toque y, si
  // el PATCH falla, se revierte al valor que tenía antes. Mostrar un
  // estado que la DB no aceptó sería peor que el parpadeo.
  async function cambiarEstadoGestion(pedido: PedidoRow, estadoGestion: EstadoGestion) {
    const previo = pedido.estado_gestion;
    setErrorAccion(null);
    setOcupadoId(pedido.id);
    setPedidos(
      (prev) =>
        prev?.map((p) => (p.id === pedido.id ? { ...p, estado_gestion: estadoGestion } : p)) ??
        prev,
    );

    try {
      const res = await fetch("/api/admin/pedidos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pedido.id, estadoGestion }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar el estado");
      }
    } catch (exc) {
      setPedidos(
        (prev) =>
          prev?.map((p) => (p.id === pedido.id ? { ...p, estado_gestion: previo } : p)) ?? prev,
      );
      setErrorAccion(exc instanceof Error ? exc.message : "No se pudo guardar el estado");
    } finally {
      setOcupadoId(null);
    }
  }

  async function borrarPedido(pedido: PedidoRow) {
    // Borrar un pedido con pago registrado elimina el único respaldo
    // propio de ese cobro, así que el aviso lo dice antes de preguntar.
    const tienePago = pedido.estado === "pagado" || pedido.estado === "reembolsado";
    const aviso = tienePago
      ? `Vas a eliminar el pedido de ${pedido.nombre_completo} por $${fmt(pedido.total_clp)}, ` +
        `que está ${pedido.estado}. Se pierde el registro del cobro y no se puede deshacer.`
      : `Vas a eliminar el pedido de ${pedido.nombre_completo}. No se puede deshacer.`;
    if (!window.confirm(aviso)) return;

    setErrorAccion(null);
    setOcupadoId(pedido.id);
    try {
      const res = await fetch("/api/admin/pedidos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        // El admin ya vio en el confirm qué se pierde: la API acepta el
        // borrado de un pedido pagado solo con esta confirmación.
        body: JSON.stringify({ id: pedido.id, confirmar: tienePago }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar el pedido");
      }
      setPedidos((prev) => prev?.filter((p) => p.id !== pedido.id) ?? prev);
      setExpandidoId((prev) => (prev === pedido.id ? null : prev));
    } catch (exc) {
      setErrorAccion(exc instanceof Error ? exc.message : "No se pudo eliminar el pedido");
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
    fetch("/api/admin/pedidos")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setPedidos(d.pedidos);
      })
      .catch(() => setError("Error de conexión"));
  }, []);

  const pedidosFiltrados = (pedidos ?? []).filter(
    (p) => filtro === "todos" || p.estado === filtro,
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
          <Link
            href="/admin/pedidos"
            className={`${styles.topbarNavLink} ${styles.topbarNavLinkActive}`}
          >
            Pedidos
          </Link>
          <Link href="/admin/solicitudes" className={styles.topbarNavLink}>
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
        <div className={styles.sectionLabel}>Pedidos</div>
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

          {!error && pedidos === null && <div className={styles.emptyMsg}>Cargando…</div>}

          {!error && pedidos !== null && pedidosFiltrados.length === 0 && (
            <div className={styles.emptyMsg}>No hay pedidos en este estado.</div>
          )}

          {pedidosFiltrados.map((pedido) => (
            <div key={pedido.id}>
              <div
                className={styles.pedidoRow}
                onClick={() => setExpandidoId(expandidoId === pedido.id ? null : pedido.id)}
              >
                <div className={styles.pedidoRowInfo}>
                  <span className={styles.pedidoRowNombre}>{pedido.nombre_completo}</span>
                  <span className={styles.pedidoRowMeta}>
                    {fmtFecha(pedido.created_at)} · {pedido.metodo_pago ?? "sin elegir"}
                  </span>
                </div>
                <div className={styles.pedidoRowRight}>
                  <span className={styles.pedidoRowTotal}>${fmt(pedido.total_clp)}</span>
                  <span className={`${styles.badge} ${styles.neutral}`}>
                    {ESTADO_GESTION_LABELS[pedido.estado_gestion]}
                  </span>
                  <span className={`${styles.badge} ${badgeClass(pedido.estado)}`}>
                    {pedido.estado}
                  </span>
                </div>
              </div>

              {expandidoId === pedido.id && (
                <div className={styles.pedidoDetalle}>
                  <div className={styles.details}>
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Seguimiento</span>
                      <select
                        className={styles.estadoSelect}
                        value={pedido.estado_gestion}
                        disabled={ocupadoId === pedido.id}
                        onChange={(e) =>
                          cambiarEstadoGestion(pedido, e.target.value as EstadoGestion)
                        }
                      >
                        {ESTADOS_GESTION.map((estado) => (
                          <option key={estado} value={estado}>
                            {ESTADO_GESTION_LABELS[estado]}
                          </option>
                        ))}
                      </select>
                    </div>
                    {(() => {
                      const motivo = describirMotivoPago(
                        pedido.metodo_pago,
                        pedido.raw_provider_payload,
                      );
                      return (
                        motivo && (
                          <div className={styles.detailRow}>
                            <span className={styles.key}>Motivo</span>
                            <span className={styles.value}>{motivo}</span>
                          </div>
                        )
                      );
                    })()}
                    {pedido.items.map((item, i) => (
                      <div className={styles.detailRow} key={i}>
                        <span className={styles.key}>
                          {item.partNumber} ×{item.cantidad ?? 1}
                        </span>
                        <span className={styles.value}>
                          {[item.maker, item.nombre].filter(Boolean).join(" · ")} — $
                          {fmt(item.precioRepuestoClp * (item.cantidad ?? 1))}
                        </span>
                      </div>
                    ))}
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Peso total</span>
                      <span className={styles.value}>
                        {pedido.peso_total_kg ? `${pedido.peso_total_kg} kg` : "Sin dato"}
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Subtotal repuestos</span>
                      <span className={styles.value}>
                        ${fmt(pedido.subtotal_repuestos_clp)}
                      </span>
                    </div>
                    {pedido.sobrecargo_peso_clp > 0 && (
                      <div className={styles.detailRow}>
                        <span className={styles.key}>Sobrecargo por peso</span>
                        <span className={styles.value}>${fmt(pedido.sobrecargo_peso_clp)}</span>
                      </div>
                    )}
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Costo logística</span>
                      <span className={styles.value}>${fmt(pedido.costo_logistica_clp)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.key}>RUT</span>
                      <span className={styles.value}>{pedido.rut}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Teléfono</span>
                      <span className={styles.value}>{pedido.telefono}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Email</span>
                      <span className={styles.value}>{pedido.email}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Envío</span>
                      <span className={styles.value}>
                        {METODO_ENVIO_LABELS[pedido.metodo_envio]}
                        {pedido.envio_detalle ? ` — ${pedido.envio_detalle}` : ""}
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Dirección</span>
                      <span className={styles.value}>
                        {pedido.direccion}, {pedido.comuna}, {pedido.ciudad}, {pedido.region}
                      </span>
                    </div>
                  </div>
                  <div className={styles.accionesRow}>
                    <button
                      className={styles.btnEliminar}
                      disabled={ocupadoId === pedido.id}
                      onClick={() => borrarPedido(pedido)}
                    >
                      Eliminar pedido
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
