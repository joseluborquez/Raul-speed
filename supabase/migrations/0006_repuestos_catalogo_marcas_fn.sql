-- Marcas distintas de repuestos_catalogo para los botones de filtro de
-- /admin/repuestos. PostgREST no tiene SELECT DISTINCT nativo y la tabla
-- ya pasa las 60k filas (import de bases de pesos por Excel) — traer la
-- columna completa y deduplicar en Node requeriría paginar de a 1000
-- filas (tope del proyecto), demasiado lento para cada carga de página.
-- Una función SQL agrupa server-side en una sola consulta.

create or replace function repuestos_catalogo_marcas()
returns table(marca text)
language sql
stable
as $$
  select coalesce(maker, 'Sin marca') as marca
  from repuestos_catalogo
  group by coalesce(maker, 'Sin marca')
  order by 1;
$$;
