-- El sobrecargo por envío ahora se calcula sobre el peso ACUMULADO del
-- pedido (no sumando el sobrecargo individual de cada pieza, que duplicaba
-- el tramo gratuito de 0,5 kg por pieza). Se guarda como campos propios
-- para poder auditar cada pedido en /admin/pedidos.

alter table pedidos
  add column if not exists sobrecargo_peso_clp numeric not null default 0,
  add column if not exists peso_total_kg numeric not null default 0;
