"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../admin.module.css";

interface RepuestoRow {
  partNumber: string;
  maker: string | null;
  nombre: string | null;
  pesoKgProveedor: number | null;
  pesoKgManual: number | null;
  vecesCotizado: number;
  primeraCotizacion: string;
  ultimaCotizacion: string;
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

export default function AdminRepuestosPage() {
  const router = useRouter();
  const [repuestos, setRepuestos] = useState<RepuestoRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pesoInputs, setPesoInputs] = useState<Record<string, string>>({});
  const [guardandoPartNumber, setGuardandoPartNumber] = useState<string | null>(null);
  const [msgPorParte, setMsgPorParte] = useState<Record<string, string>>({});

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  useEffect(() => {
    fetch("/api/admin/repuestos")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setRepuestos(d.repuestos);
      })
      .catch(() => setError("Error de conexión"));
  }, []);

  async function guardarPeso(partNumber: string) {
    const raw = pesoInputs[partNumber];
    const pesoKgManual = raw === undefined || raw.trim() === "" ? null : Number(raw);
    if (pesoKgManual !== null && (!Number.isFinite(pesoKgManual) || pesoKgManual < 0)) {
      setMsgPorParte((m) => ({ ...m, [partNumber]: "Peso inválido" }));
      return;
    }

    setGuardandoPartNumber(partNumber);
    setMsgPorParte((m) => ({ ...m, [partNumber]: "" }));
    try {
      const r = await fetch("/api/admin/repuestos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partNumber, pesoKgManual }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsgPorParte((m) => ({ ...m, [partNumber]: d.error || "No se pudo guardar" }));
      } else {
        setMsgPorParte((m) => ({ ...m, [partNumber]: "Guardado" }));
        setRepuestos(
          (prev) =>
            prev?.map((row) =>
              row.partNumber === partNumber ? { ...row, pesoKgManual } : row,
            ) ?? prev,
        );
      }
    } catch {
      setMsgPorParte((m) => ({ ...m, [partNumber]: "Error de conexión" }));
    }
    setGuardandoPartNumber(null);
  }

  const grupos = new Map<string, RepuestoRow[]>();
  for (const r of repuestos ?? []) {
    const marca = r.maker?.trim() || "Sin marca";
    if (!grupos.has(marca)) grupos.set(marca, []);
    grupos.get(marca)!.push(r);
  }
  const marcasOrdenadas = [...grupos.keys()].sort((a, b) => a.localeCompare(b));

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
          <Link
            href="/admin/repuestos"
            className={`${styles.topbarNavLink} ${styles.topbarNavLinkActive}`}
          >
            Repuestos
          </Link>
        </nav>
        <div className={styles.topbarBadge}>Administrador</div>
        <button className={styles.btnLimpiarManual} onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </header>

      <div className={styles.main}>
        <div className={styles.sectionLabel}>Repuestos cotizados</div>

        {error && (
          <div className={styles.panel}>
            <div className={styles.emptyMsg}>{error}</div>
          </div>
        )}

        {!error && repuestos === null && (
          <div className={styles.panel}>
            <div className={styles.emptyMsg}>Cargando…</div>
          </div>
        )}

        {!error && repuestos !== null && repuestos.length === 0 && (
          <div className={styles.panel}>
            <div className={styles.emptyMsg}>Todavía no se ha cotizado ningún repuesto.</div>
          </div>
        )}

        {marcasOrdenadas.map((marca) => (
          <div key={marca}>
            <div className={`${styles.sectionLabel} ${styles.sectionLabelSpaced}`}>
              {marca} · {grupos.get(marca)!.length}
            </div>
            <div className={styles.panel}>
              {grupos.get(marca)!.map((r) => (
                <div className={styles.repuestoRow} key={r.partNumber}>
                  <div className={styles.repuestoRowInfo}>
                    <span className={styles.pedidoRowNombre}>{r.partNumber}</span>
                    <span className={styles.repuestoRowMeta}>
                      {r.nombre || "—"} · Proveedor:{" "}
                      {r.pesoKgProveedor ? `${r.pesoKgProveedor} kg` : "sin dato"} · Cotizado{" "}
                      {r.vecesCotizado}× · Última: {fmtFecha(r.ultimaCotizacion)}
                    </span>
                  </div>
                  <div className={styles.pesoManualControl}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={styles.pesoManualInput}
                      placeholder="Ej: 0.8"
                      value={
                        pesoInputs[r.partNumber] ??
                        (r.pesoKgManual !== null ? String(r.pesoKgManual) : "")
                      }
                      onChange={(e) =>
                        setPesoInputs((prev) => ({ ...prev, [r.partNumber]: e.target.value }))
                      }
                    />
                    <span className={styles.tcUnit}>kg</span>
                    <button
                      className={styles.btnRefreshTasa}
                      disabled={guardandoPartNumber === r.partNumber}
                      onClick={() => guardarPeso(r.partNumber)}
                    >
                      {guardandoPartNumber === r.partNumber ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                  {msgPorParte[r.partNumber] && (
                    <span className={styles.pesoManualMsg}>{msgPorParte[r.partNumber]}</span>
                  )}
                </div>
              ))}
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
