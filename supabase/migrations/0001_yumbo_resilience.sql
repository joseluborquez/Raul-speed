-- Caché de resultados de Yumbo Japan + circuit breaker para evitar repetir
-- el agotamiento de cuota que ya ocurrió con Impex y luego con Yumbo.
--
-- Ambas tablas se acceden solo desde el server con el service-role client
-- (createAdminClient), igual que "pedidos". Se deja RLS activado sin
-- policies públicas: nadie puede leer/escribir estas tablas con la anon key.

create table if not exists yumbo_price_cache (
  part_number text primary key,
  encontrado boolean not null,
  resultado jsonb,
  updated_at timestamptz not null default now()
);

alter table yumbo_price_cache enable row level security;

create table if not exists yumbo_circuit_breaker (
  id smallint primary key default 1,
  paused_until timestamptz,
  consecutive_fails integer not null default 0,
  last_status integer,
  last_message text,
  updated_at timestamptz not null default now(),
  constraint yumbo_circuit_breaker_single_row check (id = 1)
);

alter table yumbo_circuit_breaker enable row level security;

insert into yumbo_circuit_breaker (id)
values (1)
on conflict (id) do nothing;
