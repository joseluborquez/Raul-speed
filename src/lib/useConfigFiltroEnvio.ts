"use client";

import { useEffect, useState } from "react";
import { CONFIG_DEFAULT, type ConfigFiltroEnvio } from "./sobrecargoEnvio";

// Caché de módulo (no un Context/Provider): varios componentes pueden
// montarse en la misma página (Carrito + el chequeo inline en page.tsx,
// por ejemplo) y todos comparten este único fetch en vez de duplicarlo.
const cache: { data: ConfigFiltroEnvio; promise: Promise<ConfigFiltroEnvio> | null } = {
  data: CONFIG_DEFAULT,
  promise: null,
};

function fetchConfig(): Promise<ConfigFiltroEnvio> {
  if (!cache.promise) {
    cache.promise = fetch("/api/filtro-envio-config")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch falló"))))
      .then((data: ConfigFiltroEnvio) => {
        cache.data = data;
        return data;
      })
      .catch(() => cache.data) // fail-open: se queda con el default
      .finally(() => {
        cache.promise = null;
      });
  }
  return cache.promise;
}

/**
 * Umbrales vigentes del filtro de envío (editables en /admin/filtro-envio),
 * para los componentes client-side que calculan calcularSobrecargoCarrito()
 * fuera de una cotización server-side (el pre-chequeo de carrito en
 * page.tsx/checkout/Carrito — ver ConfigFiltroEnvio en sobrecargoEnvio.ts).
 * Devuelve CONFIG_DEFAULT de inmediato (sin parpadeo) y lo reemplaza cuando
 * llega la respuesta. La verificación autoritativa siempre es server-side
 * (/api/pedidos, con la config recién leída de Supabase) — esto es solo
 * para que la advertencia del carrito no quede desactualizada.
 */
export function useConfigFiltroEnvio(): ConfigFiltroEnvio {
  const [config, setConfig] = useState<ConfigFiltroEnvio>(cache.data);

  useEffect(() => {
    let cancelado = false;
    fetchConfig().then((data) => {
      if (!cancelado) setConfig(data);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  return config;
}
