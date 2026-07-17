"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CARRITO_STORAGE_KEY } from "@/lib/carrito";
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
    // Sin pedidoId no hay nada que consultar — el render ya muestra el
    // error directamente (ver estadoUi más abajo).
    if (!pedidoId) return;

    let cancelado = false;
    let intentos = 0;

    const timer = setInterval(() => {
      intentos += 1;
      if (intentos >= MAX_INTENTOS) {
        clearInterval(timer);
        return;
      }
      tick();
    }, INTERVALO_MS);

    async function tick() {
      const nuevoEstado = await consultarEstado();
      if (cancelado) return;
      setEstado(nuevoEstado);
      if (nuevoEstado !== "pendiente") clearInterval(timer);
      // Recién con el pago aprobado se suelta el carrito — así un pago
      // fallido o abandonado deja la cotización intacta para reintentar
      // (el checkout ya no lo borra antes de redirigir a la pasarela).
      if (nuevoEstado === "pagado") {
        sessionStorage.removeItem(CARRITO_STORAGE_KEY);
      }
    }

    tick();

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
    if (nuevoEstado === "pagado") {
      sessionStorage.removeItem(CARRITO_STORAGE_KEY);
    }
    setReintentando(false);
  }

  // Sin pedidoId en la URL el estado es un error fijo, derivado en render
  // (no vía setState en el effect).
  const estadoUi: EstadoUi = pedidoId ? estado : "error";

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
            {estadoUi === "cargando" && (
              <p className={`${styles.confirmMsg} ${styles.confirmMsgMuted}`}>
                Verificando el pago…
              </p>
            )}

            {estadoUi === "pagado" && (
              <p className={styles.confirmMsg}>
                ✅ <strong>Pago aprobado.</strong> Te contactaremos para coordinar el envío.
              </p>
            )}

            {estadoUi === "pendiente" && (
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

            {estadoUi === "fallido" && (
              <p className={styles.confirmMsg}>
                ❌ <strong>Pago rechazado.</strong>{" "}
                <Link href="/">Vuelve al cotizador</Link> para intentar con otro método.
              </p>
            )}

            {estadoUi === "reembolsado" && (
              <p className={styles.confirmMsg}>
                ↩️ <strong>Este pedido fue reembolsado.</strong>{" "}
                Contáctanos por WhatsApp si tienes dudas.
              </p>
            )}

            {(estadoUi === "expirado" || estadoUi === "error") && (
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
