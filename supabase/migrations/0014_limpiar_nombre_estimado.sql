-- Base_Cotizador_RaulSpeed_COMPLETA.csv (migración 0013) trae 8.884
-- nombres Nivel 3 con una aclaración interna pegada directo en la
-- columna Nombre, ej. "GEAR (categoría estimada por familia de código,
-- no es el nombre exacto)" — se importó tal cual y quedaba visible para
-- el cliente. Se deja solo la categoría ("GEAR"): sigue siendo útil
-- (el cliente sabe qué tipo de pieza es) sin sonar a nota interna.
--
-- El patrón es literal y consistente en las 8.884 filas (siempre la
-- misma frase entre paréntesis al final), así que un regexp_replace
-- alcanza sin falsos positivos.

update repuestos_catalogo
set nombre = trim(
  regexp_replace(
    nombre,
    '\s*\(categoría estimada por familia de código, no es el nombre exacto\)\s*$',
    '',
    'i'
  )
)
where nombre ~* '\(categoría estimada por familia de código, no es el nombre exacto\)';
