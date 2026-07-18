-- Corrección de datos del seed de 0011: los NOMBRES pasan por
-- normalizar() (sobrecargoEnvio.ts), que convierte Ñ→N, pero los TÉRMINOS
-- de las listas se comparan tal cual — "PUÑO" y "EMPUÑADURA" con Ñ jamás
-- calzaban contra un nombre normalizado ("PUNO", "EMPUNADURA"). Desde
-- esta corrección, agregarTermino() (filtroEnvioConfig.ts) normaliza
-- todo término nuevo al guardarlo, así que esto no puede volver a entrar
-- por el panel; acá solo se arreglan las 2 filas que sembró 0011.
-- Guardas "not exists" por idempotencia (y por si el admin ya agregó la
-- versión sin Ñ a mano, para no chocar con el unique).

update filtro_envio_terminos
  set termino = 'PUNO'
  where categoria = 'subpiezas' and termino = 'PUÑO'
    and not exists (
      select 1 from filtro_envio_terminos
      where categoria = 'subpiezas' and termino = 'PUNO'
    );

update filtro_envio_terminos
  set termino = 'EMPUNADURA'
  where categoria = 'subpiezas' and termino = 'EMPUÑADURA'
    and not exists (
      select 1 from filtro_envio_terminos
      where categoria = 'subpiezas' and termino = 'EMPUNADURA'
    );
