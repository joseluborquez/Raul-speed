-- Cotizar desde la base primero: hasta ahora cotizar() siempre llamaba a
-- Yumbo en vivo y usaba repuestos_catalogo solo para peso/calidad de
-- dato. El proveedor ha fallado repetidas veces (cuota agotada,
-- respuestas malformadas — ver price_circuit_breaker), así que ahora se
-- prioriza el precio ya cargado acá: si un código tiene
-- precio_venta_clp, cotizar() lo usa directo y ni siquiera llama a
-- Yumbo — ver getDatosCatalogo()/cotizarDesdeCatalogo() en
-- repuestosCatalogo.ts/cotizar.ts.
--
-- precio_venta_clp es el precio FINAL de venta (no un costo que necesite
-- el multiplicador de calculator.ts) ya convertido a CLP una sola vez al
-- momento del import — es un precio de lista estático, no uno
-- recalculado en cada cotización. precio_actualizado_en registra cuándo
-- se cargó, para saber qué tan viejo es si más adelante se decide
-- refrescarlo.

alter table repuestos_catalogo
  add column if not exists precio_venta_clp numeric,
  add column if not exists precio_actualizado_en timestamptz;
