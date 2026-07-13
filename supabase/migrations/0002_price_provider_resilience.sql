-- Generaliza el caché y el circuit breaker de precios por proveedor
-- (`provider`) en vez de tenerlos específicos de un solo proveedor. Ya
-- cambiamos de proveedor de precios más de una vez (Impex → Yumbo →
-- Impex) y el próximo cambio no debería requerir tablas nuevas.
--
-- Las tablas anteriores (yumbo_price_cache, yumbo_circuit_breaker, ver
-- 0001_yumbo_resilience.sql) quedan sin uso pero no se borran acá.
--
-- Igual que las tablas de Yumbo: se accede solo desde el server con el
-- service-role client (createAdminClient). RLS activado sin policies
-- públicas: nadie puede leer/escribir estas tablas con la anon key.

create table if not exists price_cache (
  provider text not null,
  part_number text not null,
  encontrado boolean not null,
  resultado jsonb,
  updated_at timestamptz not null default now(),
  primary key (provider, part_number)
);

alter table price_cache enable row level security;

create table if not exists price_circuit_breaker (
  provider text primary key,
  paused_until timestamptz,
  consecutive_fails integer not null default 0,
  last_status integer,
  last_message text,
  updated_at timestamptz not null default now()
);

alter table price_circuit_breaker enable row level security;

insert into price_circuit_breaker (provider)
values ('impex')
on conflict (provider) do nothing;
