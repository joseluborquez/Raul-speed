"use client";

import { useState } from "react";
import styles from "../page.module.css";

const SOL_FORM_INICIAL = {
  nombreApellido: "",
  contacto: "",
  moto: "",
  chasisVinPatente: "",
  descripcionRepuesto: "",
};

/**
 * El padre solo monta este componente mientras el modal está abierto
 * ({mostrarSolicitud && <SolicitudModal .../>}) — así cada apertura es un
 * montaje nuevo y el formulario/estado de envío parte limpio sin tener que
 * resetearlo a mano.
 */
export function SolicitudModal({ onClose }: { onClose: () => void }) {
  const [solForm, setSolForm] = useState(SOL_FORM_INICIAL);
  const [solEnviando, setSolEnviando] = useState(false);
  const [solEnviada, setSolEnviada] = useState(false);
  const [solError, setSolError] = useState<string | null>(null);

  function actualizarSolCampo(campo: keyof typeof solForm, valor: string) {
    setSolForm((prev) => ({ ...prev, [campo]: valor }));
  }

  async function enviarSolicitud() {
    if (
      !solForm.nombreApellido.trim() ||
      !solForm.contacto.trim() ||
      !solForm.moto.trim() ||
      !solForm.chasisVinPatente.trim() ||
      !solForm.descripcionRepuesto.trim()
    ) {
      setSolError("Completa los campos obligatorios");
      return;
    }

    setSolEnviando(true);
    setSolError(null);
    try {
      const res = await fetch("/api/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(solForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setSolError(data.error || "No se pudo enviar la solicitud");
        setSolEnviando(false);
        return;
      }
      setSolEnviada(true);
      setSolForm(SOL_FORM_INICIAL);
    } catch {
      setSolError("Error de conexión");
    }
    setSolEnviando(false);
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
        <h2 className={styles.modalTitle}>Déjanos los datos de tu moto</h2>
        <p className={styles.modalSub}>Te contactamos por WhatsApp.</p>

        {solEnviada ? (
          <p className={styles.modalSuccess}>
            ✅ ¡Listo! Recibimos tus datos, te contactaremos pronto.
          </p>
        ) : (
          <div className={styles.modalForm}>
            <div className={styles.modalField}>
              <label htmlFor="solNombre">Nombre completo *</label>
              <input
                id="solNombre"
                value={solForm.nombreApellido}
                onChange={(e) => actualizarSolCampo("nombreApellido", e.target.value)}
              />
            </div>
            <div className={styles.modalField}>
              <label htmlFor="solContacto">
                Número de WhatsApp (con código de área) o correo electrónico *
              </label>
              <input
                id="solContacto"
                value={solForm.contacto}
                onChange={(e) => actualizarSolCampo("contacto", e.target.value)}
              />
            </div>
            <div className={styles.modalField}>
              <label htmlFor="solMoto">Marca, Modelo y Año de la motocicleta *</label>
              <input
                id="solMoto"
                value={solForm.moto}
                onChange={(e) => actualizarSolCampo("moto", e.target.value)}
              />
            </div>
            <div className={styles.modalField}>
              <label htmlFor="solChasis">Número de Chasis / VIN / Patente *</label>
              <input
                id="solChasis"
                value={solForm.chasisVinPatente}
                onChange={(e) => actualizarSolCampo("chasisVinPatente", e.target.value)}
              />
            </div>
            <div className={styles.modalField}>
              <label htmlFor="solDescripcion">Descripción detallada del repuesto *</label>
              <textarea
                id="solDescripcion"
                rows={3}
                value={solForm.descripcionRepuesto}
                onChange={(e) => actualizarSolCampo("descripcionRepuesto", e.target.value)}
              />
            </div>

            {solError && <p className={styles.modalError}>{solError}</p>}

            <button className={styles.addBtn} disabled={solEnviando} onClick={enviarSolicitud}>
              {solEnviando ? "Enviando…" : "Enviar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
