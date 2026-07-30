-- Seguimiento manual del admin, aparte del estado automático.
--
-- pedidos.estado ya existe pero lo mueven las pasarelas (pendiente →
-- pagado/fallido/expirado/reembolsado): no se puede usar para anotar en
-- qué va la gestión, porque un webhook lo pisaría. Por eso el
-- seguimiento va en una columna propia, estado_gestion, que solo escribe
-- el panel admin y ninguna ruta de pago toca.
--
-- solicitudes_parte no tenía ningún estado: cada solicitud de "no sé mi
-- número de parte" quedaba en la lista sin forma de marcar si ya se
-- buscó, se cotizó o se respondió.

alter table pedidos
  add column if not exists estado_gestion text not null default 'sin_gestionar'
    check (estado_gestion in (
      'sin_gestionar', 'pedido_al_proveedor', 'en_transito',
      'en_bodega', 'despachado', 'entregado', 'cancelado'
    ));

alter table solicitudes_parte
  add column if not exists estado text not null default 'pendiente'
    check (estado in (
      'pendiente', 'en_busqueda', 'cotizada', 'respondida', 'cerrada', 'descartada'
    ));
