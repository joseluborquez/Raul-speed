"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import styles from "../checkout.module.css";

type Estado = "pendiente" | "pagado" | "fallido" | "expirado" | "reembolsado";
type EstadoUi = Estado | "cargando" | "error";

const MAX_INTENTOS = 10;
const INTERVALO_MS = 1500;

function ConfirmacionContenido() {
  const searchParams = useSearchParams();
  const pedidoId = searchParams.get("pedido");

  const [estado, setEstado] = useState<EstadoUi>("cargando");
  const [reintentando, setReintentando] = useState(false);

  async function consultarEstado(): Promise<EstadoUi> {
    if (!pedidoId) return "error";
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}/estado`);
      if (!res.ok) return "error";
      const data = await res.json();
      return data.estado as Estado;
    } catch {
      return "error";
    }
  }

  useEffect(() => {
    if (!pedidoId) {
      setEstado("error");
      return;
    }

    let cancelado = false;
    let intentos = 0;
    let timer: ReturnType<typeof setInterval>;

    async function tick() {
      const nuevoEstado = await consultarEstado();
      if (cancelado) return;
      setEstado(nuevoEstado);
      if (nuevoEstado !== "pendiente") clearInterval(timer);
    }

    tick();
    timer = setInterval(() => {
      intentos += 1;
      if (intentos >= MAX_INTENTOS) {
        clearInterval(timer);
        return;
      }
      tick();
    }, INTERVALO_MS);

    return () => {
      cancelado = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  async function actualizarManual() {
    setReintentando(true);
    const nuevoEstado = await consultarEstado();
    setEstado(nuevoEstado);
    setReintentando(false);
  }

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarBrand}>
          Raul<span>Speed</span>
        </div>
        <div className={styles.topbarDivider} />
        <div className={styles.topbarSub}>Confirmación de pago</div>
      </header>

      <div className={styles.main}>
        <div className={styles.panel}>
          <div className={styles.summaryTotals}>
            {estado === "cargando" && (
              <p className={`${styles.confirmMsg} ${styles.confirmMsgMuted}`}>
                Verificando el pago…
              </p>
            )}

            {estado === "pagado" && (
              <p className={styles.confirmMsg}>
                ✅ <strong>Pago aprobado.</strong> Te contactaremos para coordinar el envío.
              </p>
            )}

            {estado === "pendiente" && (
              <>
                <p className={`${styles.confirmMsg} ${styles.confirmMsgMuted}`}>
                  ⏳ Tu pago está siendo procesado. Esto puede tardar unos segundos.
                </p>
                <button
                  className={`${styles.submitBtn} ${styles.confirmRetryBtn}`}
                  disabled={reintentando}
                  onClick={actualizarManual}
                >
                  {reintentando ? "Actualizando…" : "Actualizar estado"}
                </button>
              </>
            )}

            {estado === "fallido" && (
              <p className={styles.confirmMsg}>
                ❌ <strong>Pago rechazado.</strong>{" "}
                <Link href="/">Vuelve al cotizador</Link> para intentar con otro método.
              </p>
            )}

            {estado === "reembolsado" && (
              <p className={styles.confirmMsg}>
                ↩️ <strong>Este pedido fue reembolsado.</strong>{" "}
                Contáctanos por WhatsApp si tienes dudas.
              </p>
            )}

            {(estado === "expirado" || estado === "error") && (
              <p className={styles.confirmMsg}>
                No pudimos confirmar el estado de tu pago.{" "}
                <Link href="/">Vuelve al cotizador</Link> o contáctanos por WhatsApp.
              </p>
            )}
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <span>Raulspeed</span> · Pago seguro
      </footer>
    </>
  );
}

export default function ConfirmacionPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmacionContenido />
    </Suspense>
  );
}
