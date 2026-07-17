"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CARRITO_STORAGE_KEY, type ItemCotizacion } from "@/lib/carrito";
import { calcularSobrecargoCarrito } from "@/lib/sobrecargoEnvio";
import { Carrito } from "./_components/Carrito";
import { Cotizador } from "./_components/Cotizador";
import { SolicitudModal } from "./_components/SolicitudModal";
import { WhatsAppFloat } from "./_components/WhatsAppFloat";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();

  const [items, setItems] = useState<ItemCotizacion[]>([]);
  const [costoLogisticaClp, setCostoLogisticaClp] = useState(0);
  const [mostrarSolicitud, setMostrarSolicitud] = useState(false);

  function agregarAlCarrito(item: ItemCotizacion) {
    setItems((prev) => {
      // El mismo N° de parte se acumula en una sola línea del carrito en
      // vez de duplicarse como líneas separadas.
      const yaExiste = prev.some((i) => i.partNumber === item.partNumber);
      if (yaExiste) {
        return prev.map((i) =>
          i.partNumber === item.partNumber ? { ...i, cantidad: i.cantidad + item.cantidad } : i,
        );
      }
      return [...prev, item];
    });
  }

  function quitarItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function cambiarCantidadItem(id: string, delta: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, cantidad: Math.max(1, item.cantidad + delta) } : item,
      ),
    );
  }

  function procederAlPago() {
    if (calcularSobrecargoCarrito(items).resultado === "alerta_whatsapp") return;
    sessionStorage.setItem(CARRITO_STORAGE_KEY, JSON.stringify({ items, costoLogisticaClp }));
    router.push("/checkout");
  }

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarBrand}>
          Raul<span>Speed</span>
        </div>
        <div className={styles.topbarDivider} />
        <div className={styles.topbarSub}>Cotizador de Repuestos</div>
      </header>

      <div className={styles.main}>
        <div className={styles.heading}>
          <div className={styles.headingTag}>Repuestos OEM</div>
          <h1>
            Cotizador de
            <br />
            <em>Repuestos Japoneses</em>
          </h1>
          <p>Importación directa · Precio en Peso Chileno</p>
        </div>

        <p className={styles.tagline}>
          Tu repuesto en <span className={styles.taglineHighlight}>semanas</span>, no en meses
        </p>
        <div className={styles.taglineDivider} />

        <div className={styles.trustRow}>
          <span className={styles.trustItem}>
            <span className={styles.trustCheck}>✓</span> Repuestos 100% originales garantizados
          </span>
          <span className={styles.trustItem}>
            <span className={styles.trustCheck}>✓</span> Entrega en 10-20 días hábiles
          </span>
          <span className={styles.trustItem}>
            <span className={styles.trustCheck}>✓</span> Envío con seguimiento
          </span>
        </div>

        <Cotizador
          onCotizado={setCostoLogisticaClp}
          onAgregarAlCarrito={agregarAlCarrito}
          onAbrirSolicitud={() => setMostrarSolicitud(true)}
        />

        <Carrito
          items={items}
          costoLogisticaClp={costoLogisticaClp}
          onQuitarItem={quitarItem}
          onCambiarCantidad={cambiarCantidadItem}
          onProcederAlPago={procederAlPago}
        />
      </div>

      <footer className={styles.footer}>
        <span>Raulspeed</span> · Importación directa de repuestos originales
      </footer>

      {mostrarSolicitud && <SolicitudModal onClose={() => setMostrarSolicitud(false)} />}

      <WhatsAppFloat />
    </>
  );
}
