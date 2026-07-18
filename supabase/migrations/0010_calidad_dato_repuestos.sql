-- Filtro de envío v3 (Filtros_Cotizador_FINAL_v3.pdf): el nuevo motor de
-- clasificación necesita saber, por N° de parte, si el código es válido y
-- si el nombre es confiable para evaluar contra las listas de alarma (en
-- inglés) — ver src/lib/sobrecargoEnvio.ts y src/lib/cotizar.ts. También se
-- agrega fuente_peso para poder mostrar la leyenda "envío estimado" cuando
-- corresponda.
--
-- Default true en ambos flags: permisivo para los 65k+ códigos ya
-- cargados que no tienen esta info — no se bloquea nada que no esté
-- marcado explícitamente como inválido/no confiable.

alter table repuestos_catalogo
  add column if not exists oem_valido boolean not null default true,
  add column if not exists nombre_confiable boolean not null default true,
  add column if not exists fuente_peso text;
