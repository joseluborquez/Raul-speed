-- Auditoría fase 2 (auth/admin): dos arreglos de seguridad.
--
-- 1. repuestos_catalogo_marcas() quedaba con search_path mutable (WARN del
--    security advisor de Supabase): una función sin search_path fijado
--    resuelve nombres de tabla según el rol que la llama, lo que permite
--    hijacking vía esquemas con nombres colisionantes. Se fija search_path
--    vacío y se cualifica la tabla.
--
-- 2. "Quién es admin" tenía dos fuentes de verdad: la env var ADMIN_EMAILS
--    (la que usa TODO el código, ver src/lib/adminAuth.ts) y la tabla
--    admin_emails, usada solo por la policy RLS settings_admin_update. Esa
--    policy quedó obsoleta cuando /api/settings pasó a escribir con el
--    cliente service-role (que salta RLS) — ver el comentario en
--    src/lib/settings.ts sobre el bug de "Guardado" sin guardar que motivó
--    ese cambio. Mantener la tabla invita a divergencia silenciosa (agregar
--    un admin a la env no lo agrega a la tabla, y viceversa). Se eliminan
--    la policy y la tabla; la env var queda como única fuente de verdad.
--    Reversible: recrear tabla + policy si algún día se quiere una lista
--    de admins administrable sin redeploy.

create or replace function public.repuestos_catalogo_marcas()
returns table(marca text)
language sql
stable
set search_path = ''
as $$
  select coalesce(maker, 'Sin marca') as marca
  from public.repuestos_catalogo
  group by coalesce(maker, 'Sin marca')
  order by 1;
$$;

drop policy if exists settings_admin_update on settings;
drop table if exists admin_emails;
