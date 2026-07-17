import type { ItemCotizacion } from "@/lib/carrito";
import { calcularSobrecargoCarrito } from "@/lib/sobrecargoEnvio";
import { EnvioAlertaCard, EnvioEstandarCard } from "./EnvioCards";
import { fmt } from "./format";
import styles from "../page.module.css";

export function Carrito({
  items,
  costoLogisticaClp,
  onQuitarItem,
  onCambiarCantidad,
  onProcederAlPago,
}: {
  items: ItemCotizacion[];
  costoLogisticaClp: number;
  onQuitarItem: (id: string) => void;
  onCambiarCantidad: (id: string, delta: number) => void;
  onProcederAlPago: () => void;
}) {
  if (items.length === 0) return null;

  const subtotalRepuestos = items.reduce(
    (sum, item) => sum + item.precioRepuestoClp * item.cantidad,
    0,
  );
  const pesoTotalCarritoKg = items.reduce((sum, item) => sum + item.pesoKg * item.cantidad, 0);
  const clasificacionCarrito = calcularSobrecargoCarrito(items);
  const sobrecargoCarritoClp = clasificacionCarrito.extraClp;
  const bloqueadoPorPeso = clasificacionCarrito.resultado === "alerta_whatsapp";
  const totalCotizacion = subtotalRepuestos + sobrecargoCarritoClp + costoLogisticaClp;

  return (
    <div className={`${styles.cartCard} ${styles.visible}`}>
      <div className={styles.cartHeader}>Repuestos agregados ({items.length})</div>
      {items.map((item) => (
        <div className={styles.cartItem} key={item.id}>
          <div className={styles.cartItemInfo}>
            <span className={styles.cartItemPart}>{item.partNumber}</span>
            <span className={styles.cartItemName}>
              {[item.maker, item.nombre].filter(Boolean).join(" · ") || "—"}
            </span>
          </div>
          <div className={styles.cartItemRight}>
            <div className={styles.qtyControlsSmall}>
              <button
                type="button"
                className={styles.qtyBtnSmall}
                onClick={() => onCambiarCantidad(item.id, -1)}
                aria-label={`Disminuir cantidad de ${item.partNumber}`}
              >
                −
              </button>
              <span className={styles.qtyValueSmall}>{item.cantidad}</span>
              <button
                type="button"
                className={styles.qtyBtnSmall}
                onClick={() => onCambiarCantidad(item.id, 1)}
                aria-label={`Aumentar cantidad de ${item.partNumber}`}
              >
                +
              </button>
            </div>
            <span className={styles.cartItemPrice}>
              ${fmt(item.precioRepuestoClp * item.cantidad)}
            </span>
            <button
              className={styles.cartRemoveBtn}
              onClick={() => onQuitarItem(item.id)}
              aria-label={`Quitar ${item.partNumber}`}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <div className={styles.cartTotals}>
        <div className={styles.cartTotalRow}>
          <span>Peso total</span>
          <span>{pesoTotalCarritoKg ? `${pesoTotalCarritoKg} kg` : "Sin dato"}</span>
        </div>
        <div className={styles.cartTotalRow}>
          <span>Subtotal repuestos</span>
          <span>${fmt(subtotalRepuestos)} CLP</span>
        </div>
        {sobrecargoCarritoClp > 0 && (
          <div className={styles.cartTotalRow}>
            <span>Sobrecargo por peso</span>
            <span>${fmt(sobrecargoCarritoClp)} CLP</span>
          </div>
        )}
        <div className={styles.cartTotalRow}>
          <span>Costo de logística (único)</span>
          <span>${fmt(costoLogisticaClp)} CLP</span>
        </div>
        <div className={`${styles.cartTotalRow} ${styles.cartTotalFinal}`}>
          <span>Total</span>
          <span>${fmt(totalCotizacion)} CLP · IVA incluido</span>
        </div>
      </div>

      {bloqueadoPorPeso ? (
        <EnvioAlertaCard
          whatsappHref={`https://wa.me/56954156358?text=${encodeURIComponent(
            `Hola, quiero cotizar el envío de mi pedido (peso total ~${pesoTotalCarritoKg} kg): ` +
              items.map((item) => `${item.partNumber} ×${item.cantidad}`).join(", "),
          )}`}
        />
      ) : (
        <>
          {clasificacionCarrito.resultado === "estandar" && <EnvioEstandarCard precioFinal />}
          <div className={styles.addRow}>
            <button className={styles.addBtn} onClick={onProcederAlPago}>
              Proceder al pago →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
