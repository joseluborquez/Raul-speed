-- Cuota diaria del proveedor de precios. La cuenta nueva de Impex tiene un
-- tope de 500 consultas por día, y esta vez el tope hay que respetarlo
-- desde el código: cada vez que se agotó una cuota (Impex la primera vez,
-- después Yumbo) fue porque nada llevaba la cuenta.
--
-- Por qué en Supabase y no en memoria como rateLimit.ts: el límite por
-- minuto de rateLimit.ts es por instancia de la función, y con Fluid
-- Compute hay varias vivas a la vez. N instancias × 20 llamadas/min queman
-- 500 en minutos sin que ningún contador local se entere. Una cuota diaria
-- solo sirve si es compartida.
--
-- El día se calcula en JST (zona del proveedor) desde el código — ver
-- diaJst() en src/lib/priceQuota.ts. Se guarda como date, una fila por
-- proveedor y día; las filas viejas quedan como historial de consumo.
--
-- Mismo patrón que price_cache/price_circuit_breaker: se accede solo desde
-- el server con el cliente service-role (createAdminClient). RLS activado
-- sin policies públicas: nadie puede leer/escribir con la anon key.

create table if not exists price_provider_quota (
  provider text not null,
  dia date not null,
  llamadas integer not null default 0,
  primary key (provider, dia)
);

alter table price_provider_quota enable row level security;

-- Incrementa y decide en una sola sentencia atómica. Hacer esto como
-- select + upsert desde JS es una condición de carrera: dos cotizaciones
-- simultáneas leen el mismo valor y ambas escriben el mismo +1, así que el
-- contador queda corto justo cuando hay más tráfico — que es cuando
-- importa. El INSERT ... ON CONFLICT DO UPDATE ... RETURNING resuelve la
-- lectura y la escritura bajo el mismo lock de fila.
--
-- Devuelve true si la llamada CABE en la cuota (ya contada), false si la
-- pasó. Ojo: cuenta igual cuando devuelve false — así queda registrado
-- cuánto se habría querido consumir, y el propio false evita el fetch.
--
-- search_path fijado y tabla cualificada por el mismo motivo que
-- repuestos_catalogo_marcas() en 0007_seguridad_admin.sql.
create or replace function public.consumir_cuota_proveedor(
  p_provider text,
  p_dia date,
  p_limite integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_llamadas integer;
begin
  insert into public.price_provider_quota (provider, dia, llamadas)
  values (p_provider, p_dia, 1)
  -- Sin cualificar con el esquema a propósito: acá "price_provider_quota"
  -- es el alias de la tabla destino del INSERT, no un nombre a resolver
  -- por search_path. Y no sirve "excluded", que trae el valor propuesto
  -- (siempre 1) en vez del acumulado.
  on conflict (provider, dia) do update
    set llamadas = price_provider_quota.llamadas + 1
  returning llamadas into v_llamadas;

  return v_llamadas <= p_limite;
end;
$$;

-- Solo el service-role la ejecuta (createAdminClient). PostgREST expone
-- por defecto las funciones a anon/authenticated; sin esto, cualquiera con
-- la anon key podría inflar el contador y dejar el cotizador degradado
-- contra la base de datos hasta el día siguiente.
revoke execute on function public.consumir_cuota_proveedor(text, date, integer)
  from anon, authenticated;

-- Yumbo se retira como proveedor: el respaldo ahora es repuestos_catalogo
-- (ver cotizar.ts). Se limpian sus filas para que el panel de admin y
-- cualquier consulta futura no muestren un proveedor que ya no existe.
delete from price_cache where provider = 'yumbo';
delete from price_circuit_breaker where provider = 'yumbo';

insert into price_circuit_breaker (provider)
values ('impex')
on conflict (provider) do nothing;
