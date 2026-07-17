-- Auditoría fase 4 (base de datos): limpieza de restos e índices para el
-- catálogo de repuestos.
--
-- 1. settings.descuento_sobrecargo_dhl_pct: columna del flujo de sobrecargo
--    vía flete DHL, retirado y reemplazado por la tabla de reglas fija de
--    src/lib/sobrecargoEnvio.ts. Ninguna línea de código la lee.
--
-- 2. pedidos_proveedor_ref_idx: el código escribe proveedor_ref pero nunca
--    consulta por él (los webhooks buscan por id del pedido). El advisor de
--    performance de Supabase lo confirma como índice nunca usado.
--
-- 3. repuestos_catalogo.veces_cotizado default 1 → 0: el default correcto
--    para una fila nueva es "nunca cotizado" (0). registrarCotizacion()
--    siempre setea el valor explícito, así que el default solo aplica a
--    imports/inserts manuales — y el default 1 ya causó un import marcado
--    como "cotizado" por error (import de pesos del 2026-07-16).
--
-- 4. Índices para repuestos_catalogo (65k filas y creciendo con imports):
--    la búsqueda de /admin/repuestos usa part_number/nombre ILIKE '%q%'
--    (→ GIN trigram; btree no sirve para patrones con % inicial), filtro
--    por maker (→ btree) y la vista inicial "recientes" filtra
--    veces_cotizado > 0 ordenando por ultima_cotizacion (→ índice parcial,
--    solo ~decenas de filas lo cumplen).

alter table settings drop column if exists descuento_sobrecargo_dhl_pct;

drop index if exists pedidos_proveedor_ref_idx;

alter table repuestos_catalogo alter column veces_cotizado set default 0;

create extension if not exists pg_trgm;

create index if not exists repuestos_catalogo_part_number_trgm_idx
  on repuestos_catalogo using gin (part_number gin_trgm_ops);

create index if not exists repuestos_catalogo_nombre_trgm_idx
  on repuestos_catalogo using gin (nombre gin_trgm_ops);

create index if not exists repuestos_catalogo_maker_idx
  on repuestos_catalogo (maker);

create index if not exists repuestos_catalogo_recientes_idx
  on repuestos_catalogo (ultima_cotizacion desc)
  where veces_cotizado > 0;
