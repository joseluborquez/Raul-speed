import styles from "../page.module.css";

export function EnvioEstandarCard({ precioFinal = false }: { precioFinal?: boolean }) {
  return (
    <div className={styles.envioEstandarCard}>
      <div className={styles.envioCardTitle}>
        <span className={styles.envioCardIcon}>✓</span> Envío internacional incluido
      </div>
      <p className={styles.envioCardText}>
        {precioFinal
          ? "El precio mostrado es el valor final e incluye IVA y despacho internacional. No pagas nada adicional por piezas de tamaño normal."
          : "Esta pieza no tiene sobrecargo por tamaño o peso. El costo de despacho internacional se suma una sola vez al agregar tus repuestos al carrito."}
      </p>
      <p className={styles.envioCardBullet}>
        Envío internacional: piezas de hasta 500 g — retenes, empaquetaduras, filtros, tensores,
        pastillas, bujías y rodamientos, entre muchos otros — la gran mayoría de los repuestos.
      </p>
    </div>
  );
}

export function EnvioAlertaCard({ whatsappHref }: { whatsappHref: string }) {
  return (
    <div className={styles.envioAlertaCard}>
      <div className={styles.envioCardTitle}>
        <span className={styles.envioCardIcon}>📦</span> Confirmamos tu envío por WhatsApp
      </div>
      <p className={styles.envioCardText}>
        Para esta pieza necesitamos confirmarte el valor exacto del despacho antes de cerrar tu
        compra. Escríbenos por WhatsApp y te confirmamos precio y envío lo antes posible — sin
        sorpresas.
      </p>
      <p className={styles.envioAlertaNota}>La consulta toma solo un minuto, sin compromiso.</p>
      <a
        className={styles.envioAlertaBtn}
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        💬 Confirmar por WhatsApp
      </a>
    </div>
  );
}
