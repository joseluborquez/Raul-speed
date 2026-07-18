"use client";

import { useState } from "react";
import styles from "../page.module.css";

const PASOS_COMPRA = [
  {
    titulo: "1️⃣ Pago + Datos 💳",
    texto: "Confirmas con el 100% del pago.",
  },
  {
    titulo: "2️⃣ Importación ⚙️",
    texto: "Tu repuesto viaja a Chile en 10 a 20 días hábiles.",
  },
  {
    titulo: "3️⃣ Verificación 📸",
    texto: "Llega a nuestro centro y te enviamos foto real de tu pieza.",
  },
  {
    titulo: "4️⃣ Despacho 🚀",
    texto: "Lo enviamos por el courier que elegiste.",
  },
  {
    titulo: "5️⃣ Seguimiento ✅",
    texto: "Recibes el código para rastrear tu paquete hasta tus manos.",
  },
];

function ComoComprarBox() {
  const [verMas, setVerMas] = useState(false);
  const [primerPaso, ...restoPasos] = PASOS_COMPRA;

  return (
    <div className={styles.comoComprarCard}>
      <div className={styles.comoComprarTitle}>¿Cómo comprar tu repuesto importado?</div>
      <div className={styles.comoComprarSteps}>
        <div className={styles.comoComprarStep}>
          <span className={styles.comoComprarStepTitle}>{primerPaso.titulo}</span>
          <span className={styles.comoComprarStepText}>{primerPaso.texto}</span>
        </div>
        {verMas &&
          restoPasos.map((paso) => (
            <div className={styles.comoComprarStep} key={paso.titulo}>
              <span className={styles.comoComprarStepTitle}>{paso.titulo}</span>
              <span className={styles.comoComprarStepText}>{paso.texto}</span>
            </div>
          ))}
      </div>
      {verMas && (
        <p className={styles.comoComprarFooter}>¡Repuesto 100% original garantizado! 🏍️</p>
      )}
      <button type="button" className={styles.noticeToggle} onClick={() => setVerMas((v) => !v)}>
        {verMas ? "Ver menos ▲" : "Ver más ▼"}
      </button>
    </div>
  );
}

function HelpBox({ onAbrirSolicitud }: { onAbrirSolicitud: () => void }) {
  return (
    <div className={styles.helpBox}>
      <div className={`${styles.envioCardTitle} ${styles.helpBoxTitle}`}>
        ¿No sabes tu número de parte?
      </div>
      <p className={styles.envioCardText}>
        <button type="button" className={styles.helpBoxLink} onClick={onAbrirSolicitud}>
          Déjanos los datos de tu moto aquí
        </button>{" "}
        y lo buscamos por ti.
      </p>
      <p className={styles.helpBoxSub}>Te respondemos por WhatsApp</p>
    </div>
  );
}

export function InfoBoxes({ onAbrirSolicitud }: { onAbrirSolicitud: () => void }) {
  return (
    <>
      <ComoComprarBox />
      <HelpBox onAbrirSolicitud={onAbrirSolicitud} />
    </>
  );
}
