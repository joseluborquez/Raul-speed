-- Catálogo de repuestos ya cotizados, agrupado por marca en /admin/repuestos.
-- El proveedor de precios (Yumbo) casi nunca trae peso, y sin peso la
-- clasificarEnvio() de sobrecargoEnvio.ts pierde 3 de sus 5 pasos (todo
-- cae en la clasificación solo por precio). Acá se registra cada N° de
-- parte cotizado con éxito para que el admin pueda cargar el peso a mano
-- una vez; ese peso manual pasa a tener prioridad sobre el del proveedor
-- (ver getPesoManual() en src/lib/repuestosCatalogo.ts, usado desde
-- cotizar()).
--
-- Una fila por N° de parte (catálogo, no un log de cada búsqueda).
-- Mismo patrón que el resto: RLS activado sin policies públicas, solo se
-- accede con el cliente service-role (createAdminClient()).

create table if not exists repuestos_catalogo (
  part_number text primary key,
  maker text,
  nombre text,
  peso_kg_proveedor numeric,
  peso_kg_manual numeric,
  veces_cotizado integer not null default 1,
  primera_cotizacion timestamptz not null default now(),
  ultima_cotizacion timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table repuestos_catalogo enable row level security;
