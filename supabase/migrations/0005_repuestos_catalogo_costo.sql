-- Costo del repuesto (precio del repuesto en CLP, sin logística ni
-- sobrecargo de envío) de la última cotización exitosa, para mostrarlo
-- junto al N° de parte en /admin/repuestos — ver registrarCotizacion()
-- en src/lib/repuestosCatalogo.ts.

alter table repuestos_catalogo add column if not exists costo_clp numeric;
