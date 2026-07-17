-- Esquema base — reconstrucción de las 8 primeras migraciones, que se
-- aplicaron directo en Supabase (dashboard/MCP) sin quedar versionadas en
-- el repo (auditoría fase 4). En el proyecto de producción este esquema YA
-- EXISTE: este archivo está para que el repo pueda reconstruir la base de
-- datos desde cero (entorno local, proyecto nuevo). Todo es idempotente
-- (if not exists / drop-create de policies), así que aplicarlo sobre la
-- base existente tampoco rompe nada.
--
-- Migraciones originales cubiertas (nombre en supabase_migrations):
--   create_settings_table, add_tipo_cambio_manual_to_settings,
--   create_pedidos_table, agregar_estado_reembolsado_pedidos,
--   crear_tabla_solicitudes_parte, actualizar_campos_solicitudes_parte,
--   endurecer_rls_policies, add_descuento_sobrecargo_dhl_pct_to_settings.
--
-- Nota: admin_emails + settings_admin_update y la columna
-- descuento_sobrecargo_dhl_pct nacen acá y se eliminan después (0007 y
-- 0009) — van igual para que el replay histórico sea fiel.

-- settings: fila única de configuración global.
create table if not exists settings (
  id smallint primary key default 1 check (id = 1),
  costo_logistica_clp numeric not null default 0,
  updated_at timestamptz not null default now(),
  tipo_cambio_manual numeric,
  descuento_sobrecargo_dhl_pct numeric not null default 50
    check (descuento_sobrecargo_dhl_pct >= 0 and descuento_sobrecargo_dhl_pct <= 100)
);

alter table settings enable row level security;

insert into settings (id) values (1) on conflict (id) do nothing;

-- Lectura pública (el cotizador necesita costo_logistica_clp / tasa manual
-- desde el cliente anon del servidor); escritura solo vía service-role.
drop policy if exists settings_public_read on settings;
create policy settings_public_read on settings
  for select to anon, authenticated using (true);

-- Allowlist de admins usada por la policy settings_admin_update.
-- (Ambas se eliminan en 0007: el código pasó a validar admin con la env
-- var ADMIN_EMAILS y a escribir settings con el cliente service-role.)
create table if not exists admin_emails (
  email text primary key
);

alter table admin_emails enable row level security;

drop policy if exists settings_admin_update on settings;
create policy settings_admin_update on settings
  for update to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) in (select email from admin_emails))
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) in (select email from admin_emails));

-- pedidos: una fila por intento de compra. RLS sin policies: solo
-- service-role (la API valida y escribe; ver src/lib/pedidos.ts).
create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  items jsonb not null,
  subtotal_repuestos_clp numeric not null,
  costo_logistica_clp numeric not null,
  total_clp numeric not null,
  nombre_completo text not null,
  rut text not null,
  telefono text not null,
  email text not null,
  metodo_envio text not null check (metodo_envio in (
    'starken_domicilio', 'starken_retiro',
    'chilexpress_domicilio', 'chilexpress_retiro',
    'correoschile_domicilio', 'correoschile_retiro',
    'bluexpress_domicilio', 'bluexpress_retiro',
    'retiro_tome', 'otro'
  )),
  envio_detalle text,
  region text not null,
  ciudad text not null,
  comuna text not null,
  direccion text not null,
  estado text not null default 'pendiente' check (estado in (
    'pendiente', 'pagado', 'fallido', 'expirado', 'reembolsado'
  )),
  metodo_pago text check (metodo_pago in ('mercadopago', 'webpay', 'flow')),
  proveedor_ref text,
  raw_provider_payload jsonb
);

alter table pedidos enable row level security;

create index if not exists pedidos_created_at_idx on pedidos (created_at desc);
create index if not exists pedidos_estado_idx on pedidos (estado);
-- Se elimina en 0009: el código nunca consulta por proveedor_ref.
create index if not exists pedidos_proveedor_ref_idx on pedidos (proveedor_ref);

-- solicitudes_parte: formulario "no sé mi número de parte". RLS sin
-- policies: solo service-role.
create table if not exists solicitudes_parte (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre_apellido text not null,
  descripcion_repuesto text not null,
  contacto text not null,
  moto text not null,
  chasis_vin_patente text not null
);

alter table solicitudes_parte enable row level security;
