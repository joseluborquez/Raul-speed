import styles from "../page.module.css";

// Copy informativa, no ligada 1:1 a LISTA_A_PALABRAS (sobrecargoEnvio.ts):
// son categorías en español para el cliente, no los términos en inglés que
// se buscan en el nombre del repuesto que devuelve el proveedor.
const CATEGORIAS_VOLUMINOSAS = [
  "Carenados",
  "Quillas",
  "Tapas de carenado",
  "Guardabarros",
  "Estanque",
  "Foco delantero",
  "Escape",
  "Radiador",
  "Basculante",
  "Llantas",
  "Neumáticos",
  "Chasis",
  "Manubrio",
  "Parabrisas",
  "Asiento",
  "Ductos de aire",
  "Tapas laterales",
];

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
        <span className={styles.envioCardIcon}>📦</span> Piezas voluminosas: te confirmamos el
        envío
      </div>
      <p className={styles.envioCardText}>
        Algunas piezas grandes o de más de 500 g pueden llevar un pequeño ajuste en el despacho.
        En la mayoría de los casos es un monto menor — escríbenos por WhatsApp y en minutos te
        confirmamos el valor exacto para tu repuesto.
      </p>
      <p className={styles.envioAlertaAplica}>Aplica solo para:</p>
      <ul className={styles.envioAlertaCriterios}>
        <li>Piezas de más de 500 g de peso</li>
        <li>Piezas voluminosas:</li>
      </ul>
      <div className={styles.envioTagList}>
        {CATEGORIAS_VOLUMINOSAS.map((categoria) => (
          <span key={categoria} className={styles.envioTag}>
            {categoria}
          </span>
        ))}
      </div>
      <p className={styles.envioAlertaNota}>
        La consulta toma solo un minuto — compras con el valor total confirmado, sin sorpresas.
      </p>
      <a
        className={styles.envioAlertaBtn}
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        💬 Confirmar mi envío por WhatsApp
      </a>
    </div>
  );
}
