"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { METODO_ENVIO_LABELS, type MetodoEnvio } from "@/lib/metodoEnvio";
import type { EstadoPedido, ItemPedido, MetodoPago } from "@/lib/pedidos";
import styles from "../admin.module.css";

interface PedidoRow {
  id: string;
  created_at: string;
  items: ItemPedido[];
  subtotal_repuestos_clp: number;
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
  metodo_pago: MetodoPago | null;
}

const FILTROS: { value: EstadoPedido | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendiente", label: "Pendiente" },
  { value: "pagado", label: "Pagado" },
  { value: "fallido", label: "Fallido" },
  { value: "expirado", label: "Expirado" },
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
  return styles.pending;
}

export default function AdminPedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoPedido | "todos">("todos");
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

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
        <div className={styles.topbarSub}>Cotizador Interno</div>
        <div className={styles.topbarBadge}>Administrador</div>
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
                  <span className={`${styles.badge} ${badgeClass(pedido.estado)}`}>
                    {pedido.estado}
                  </span>
                </div>
              </div>

              {expandidoId === pedido.id && (
                <div className={styles.pedidoDetalle}>
                  <div className={styles.details}>
                    {pedido.items.map((item, i) => (
                      <div className={styles.detailRow} key={i}>
                        <span className={styles.key}>{item.partNumber}</span>
                        <span className={styles.value}>
                          {[item.maker, item.nombre].filter(Boolean).join(" · ")} — $
                          {fmt(item.precioRepuestoClp)}
                        </span>
                      </div>
                    ))}
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Subtotal repuestos</span>
                      <span className={styles.value}>
                        ${fmt(pedido.subtotal_repuestos_clp)}
                      </span>
                    </div>
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
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <footer className={styles.footer}>
        <span>Raulspeed</span> · Panel Administrador ·{" "}
        <Link href="/admin">Volver</Link>
      </footer>
    </>
  );
}
