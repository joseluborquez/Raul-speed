"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CARRITO_STORAGE_KEY, type CarritoStorage } from "@/lib/carrito";
import { validarRut } from "@/lib/rut";
import styles from "./checkout.module.css";

function fmt(n: number): string {
  return new Intl.NumberFormat("es-CL").format(n);
}

const OPCIONES_ENVIO: { value: string; label: string }[] = [
  { value: "starken_domicilio", label: "Starken — Despacho a domicilio" },
  { value: "starken_retiro", label: "Retiro en sucursal — Starken" },
  { value: "chilexpress_domicilio", label: "Chilexpress — Despacho a domicilio" },
  { value: "chilexpress_retiro", label: "Retiro en sucursal — Chilexpress" },
  { value: "correoschile_domicilio", label: "Correos de Chile — Despacho a domicilio" },
  { value: "correoschile_retiro", label: "Retiro en sucursal — Correos de Chile" },
  { value: "bluexpress_domicilio", label: "Bluexpress — Despacho a domicilio" },
  { value: "bluexpress_retiro", label: "Retiro en sucursal — Bluexpress" },
  { value: "retiro_tome", label: "Retiro en tienda en Tomé" },
  { value: "otro", label: "Otro" },
];

interface FormState {
  nombreCompleto: string;
  rut: string;
  telefono: string;
  email: string;
  metodoEnvio: string;
  envioDetalle: string;
  region: string;
  ciudad: string;
  comuna: string;
  direccion: string;
}

const FORM_INICIAL: FormState = {
  nombreCompleto: "",
  rut: "",
  telefono: "",
  email: "",
  metodoEnvio: "",
  envioDetalle: "",
  region: "",
  ciudad: "",
  comuna: "",
  direccion: "",
};

export default function CheckoutPage() {
  const [carrito, setCarrito] = useState<CarritoStorage | null>(null);
  const [cargando, setCargando] = useState(true);

  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [errores, setErrores] = useState<Partial<Record<keyof FormState, string>>>({});
  const [paso, setPaso] = useState<"form" | "pago">("form");

  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CARRITO_STORAGE_KEY);
      setCarrito(raw ? (JSON.parse(raw) as CarritoStorage) : null);
    } catch {
      setCarrito(null);
    }
    setCargando(false);
  }, []);

  function setCampo(campo: keyof FormState, valor: string) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function validarFormulario(): boolean {
    const nuevosErrores: Partial<Record<keyof FormState, string>> = {};

    if (!form.nombreCompleto.trim()) nuevosErrores.nombreCompleto = "Requerido";
    if (!validarRut(form.rut)) nuevosErrores.rut = "RUT inválido";
    if (!form.telefono.trim()) nuevosErrores.telefono = "Requerido";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nuevosErrores.email = "Email inválido";
    if (!form.metodoEnvio) nuevosErrores.metodoEnvio = "Elige una opción";
    if (form.metodoEnvio === "otro" && !form.envioDetalle.trim()) {
      nuevosErrores.envioDetalle = "Describe el método de envío";
    }
    if (!form.region.trim()) nuevosErrores.region = "Requerido";
    if (!form.ciudad.trim()) nuevosErrores.ciudad = "Requerido";
    if (!form.comuna.trim()) nuevosErrores.comuna = "Requerido";
    if (!form.direccion.trim()) nuevosErrores.direccion = "Requerido";

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  function continuar() {
    if (validarFormulario()) setPaso("pago");
  }

  async function pagarCon(metodo: "mercadopago" | "webpay" | "flow") {
    if (!carrito) return;
    setProcesando(true);
    setError(null);

    try {
      const resPedido = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: carrito.items,
          costoLogisticaClp: carrito.costoLogisticaClp,
          nombreCompleto: form.nombreCompleto,
          rut: form.rut,
          telefono: form.telefono,
          email: form.email,
          metodoEnvio: form.metodoEnvio,
          envioDetalle: form.envioDetalle,
          region: form.region,
          ciudad: form.ciudad,
          comuna: form.comuna,
          direccion: form.direccion,
        }),
      });
      const dataPedido = await resPedido.json();
      if (!resPedido.ok) {
        setError(dataPedido.error || "No se pudo crear el pedido");
        setProcesando(false);
        return;
      }

      const resPago = await fetch(`/api/pagos/${metodo}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: dataPedido.pedidoId }),
      });
      const dataPago = await resPago.json();
      if (!resPago.ok) {
        setError(dataPago.error || "No se pudo iniciar el pago");
        setProcesando(false);
        return;
      }

      sessionStorage.removeItem(CARRITO_STORAGE_KEY);

      if (metodo === "webpay") {
        // Webpay no es un redirect simple: hay que hacer un POST autosubmit
        // del token hacia la url que entrega Transbank.
        const form = document.createElement("form");
        form.method = "POST";
        form.action = dataPago.url;
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "token_ws";
        input.value = dataPago.token;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
        return;
      }

      window.location.href = dataPago.redirectUrl;
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
      setProcesando(false);
    }
  }

  if (cargando) return null;

  if (!carrito || carrito.items.length === 0) {
    return (
      <>
        <header className={styles.topbar}>
          <div className={styles.topbarBrand}>
            Raul<span>Speed</span>
          </div>
          <div className={styles.topbarDivider} />
          <div className={styles.topbarSub}>Checkout</div>
        </header>
        <div className={styles.main}>
          <div className={styles.emptyState}>
            Tu carrito está vacío.
            <br />
            <Link href="/">Vuelve al cotizador</Link> para agregar repuestos.
          </div>
        </div>
      </>
    );
  }

  const subtotalRepuestos = carrito.items.reduce(
    (sum, item) => sum + item.precioRepuestoClp,
    0,
  );
  const total = subtotalRepuestos + carrito.costoLogisticaClp;

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarBrand}>
          Raul<span>Speed</span>
        </div>
        <div className={styles.topbarDivider} />
        <div className={styles.topbarSub}>Checkout</div>
      </header>

      <div className={styles.main}>
        <div className={styles.sectionLabel}>Tu cotización</div>
        <div className={styles.panel}>
          {carrito.items.map((item) => (
            <div className={styles.summaryItem} key={item.id}>
              <div className={styles.summaryItemInfo}>
                <span className={styles.summaryItemPart}>{item.partNumber}</span>
                <span className={styles.summaryItemName}>
                  {[item.maker, item.nombre].filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
              <span className={styles.summaryItemPrice}>${fmt(item.precioRepuestoClp)}</span>
            </div>
          ))}
          <div className={styles.summaryTotals}>
            <div className={styles.summaryTotalRow}>
              <span>Subtotal repuestos</span>
              <span>${fmt(subtotalRepuestos)} CLP</span>
            </div>
            <div className={styles.summaryTotalRow}>
              <span>Costo de logística (único)</span>
              <span>${fmt(carrito.costoLogisticaClp)} CLP</span>
            </div>
            <div className={`${styles.summaryTotalRow} ${styles.summaryTotalFinal}`}>
              <span>Total</span>
              <span>${fmt(total)} CLP · IVA incluido</span>
            </div>
          </div>
        </div>

        {paso === "form" && (
          <>
            <div className={`${styles.sectionLabel} ${styles.sectionLabelSpaced}`}>
              Datos de envío
            </div>
            <div className={styles.panel}>
              <div className={styles.form}>
                <div className={styles.fieldRow}>
                  <div className={`${styles.field} ${errores.nombreCompleto ? styles.hasError : ""}`}>
                    <label htmlFor="nombreCompleto">Nombre completo</label>
                    <input
                      id="nombreCompleto"
                      value={form.nombreCompleto}
                      onChange={(e) => setCampo("nombreCompleto", e.target.value)}
                    />
                    {errores.nombreCompleto && (
                      <span className={styles.fieldError}>{errores.nombreCompleto}</span>
                    )}
                  </div>
                  <div className={`${styles.field} ${errores.rut ? styles.hasError : ""}`}>
                    <label htmlFor="rut">RUT</label>
                    <input
                      id="rut"
                      placeholder="12.345.678-9"
                      value={form.rut}
                      onChange={(e) => setCampo("rut", e.target.value)}
                    />
                    {errores.rut && <span className={styles.fieldError}>{errores.rut}</span>}
                  </div>
                </div>

                <div className={styles.fieldRow}>
                  <div className={`${styles.field} ${errores.telefono ? styles.hasError : ""}`}>
                    <label htmlFor="telefono">Teléfono de contacto</label>
                    <input
                      id="telefono"
                      value={form.telefono}
                      onChange={(e) => setCampo("telefono", e.target.value)}
                    />
                    {errores.telefono && (
                      <span className={styles.fieldError}>{errores.telefono}</span>
                    )}
                  </div>
                  <div className={`${styles.field} ${errores.email ? styles.hasError : ""}`}>
                    <label htmlFor="email">Correo electrónico</label>
                    <input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setCampo("email", e.target.value)}
                    />
                    {errores.email && <span className={styles.fieldError}>{errores.email}</span>}
                  </div>
                </div>

                <div className={`${styles.field} ${errores.metodoEnvio ? styles.hasError : ""}`}>
                  <label htmlFor="metodoEnvio">Empresa de envío de preferencia</label>
                  <select
                    id="metodoEnvio"
                    value={form.metodoEnvio}
                    onChange={(e) => setCampo("metodoEnvio", e.target.value)}
                  >
                    <option value="">Selecciona una opción</option>
                    {OPCIONES_ENVIO.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                  {errores.metodoEnvio && (
                    <span className={styles.fieldError}>{errores.metodoEnvio}</span>
                  )}
                </div>

                {form.metodoEnvio === "otro" && (
                  <div className={`${styles.field} ${errores.envioDetalle ? styles.hasError : ""}`}>
                    <label htmlFor="envioDetalle">Describe el método de envío</label>
                    <input
                      id="envioDetalle"
                      value={form.envioDetalle}
                      onChange={(e) => setCampo("envioDetalle", e.target.value)}
                    />
                    {errores.envioDetalle && (
                      <span className={styles.fieldError}>{errores.envioDetalle}</span>
                    )}
                  </div>
                )}

                <div className={styles.fieldRow}>
                  <div className={`${styles.field} ${errores.region ? styles.hasError : ""}`}>
                    <label htmlFor="region">Región</label>
                    <input
                      id="region"
                      value={form.region}
                      onChange={(e) => setCampo("region", e.target.value)}
                    />
                    {errores.region && <span className={styles.fieldError}>{errores.region}</span>}
                  </div>
                  <div className={`${styles.field} ${errores.ciudad ? styles.hasError : ""}`}>
                    <label htmlFor="ciudad">Ciudad</label>
                    <input
                      id="ciudad"
                      value={form.ciudad}
                      onChange={(e) => setCampo("ciudad", e.target.value)}
                    />
                    {errores.ciudad && <span className={styles.fieldError}>{errores.ciudad}</span>}
                  </div>
                  <div className={`${styles.field} ${errores.comuna ? styles.hasError : ""}`}>
                    <label htmlFor="comuna">Comuna</label>
                    <input
                      id="comuna"
                      value={form.comuna}
                      onChange={(e) => setCampo("comuna", e.target.value)}
                    />
                    {errores.comuna && <span className={styles.fieldError}>{errores.comuna}</span>}
                  </div>
                </div>

                <div className={`${styles.field} ${errores.direccion ? styles.hasError : ""}`}>
                  <label htmlFor="direccion">
                    Dirección completa (calle, número y depto o nombre de oficina de retiro)
                  </label>
                  <input
                    id="direccion"
                    value={form.direccion}
                    onChange={(e) => setCampo("direccion", e.target.value)}
                  />
                  {errores.direccion && (
                    <span className={styles.fieldError}>{errores.direccion}</span>
                  )}
                </div>

                <button className={styles.submitBtn} onClick={continuar}>
                  Continuar al pago
                </button>
              </div>
            </div>
          </>
        )}

        {paso === "pago" && (
          <>
            <div className={`${styles.sectionLabel} ${styles.sectionLabelSpaced}`}>
              Elige cómo pagar
            </div>
            <div className={styles.panel}>
              <div className={styles.paymentMethods}>
                <button
                  className={styles.backLink}
                  onClick={() => setPaso("form")}
                  disabled={procesando}
                >
                  ← Volver a datos de envío
                </button>
                <button
                  className={styles.paymentBtn}
                  disabled={procesando}
                  onClick={() => pagarCon("mercadopago")}
                >
                  Mercado Pago
                </button>
                <button
                  className={styles.paymentBtn}
                  disabled={procesando}
                  onClick={() => pagarCon("webpay")}
                >
                  Webpay
                </button>
                <button className={styles.paymentBtn} disabled>
                  Flow <span className={styles.paymentBtnSoon}>Próximamente</span>
                </button>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className={styles.errorBox}>
            <span>{error}</span>
          </div>
        )}
      </div>

      <footer className={styles.footer}>
        <span>Raulspeed</span> · Pago seguro
      </footer>
    </>
  );
}
