-- Auditoría fase 3: limpieza pendiente desde 0002_price_provider_resilience,
-- que generalizó caché/circuit breaker en price_cache/price_circuit_breaker
-- y dejó anotado que las tablas específicas de Yumbo "quedan sin uso pero
-- no se borran acá". Ningún código las referencia desde entonces; solo
-- contenían caché desechable (el caché vigente vive en price_cache con
-- provider = 'yumbo').

drop table if exists yumbo_price_cache;
drop table if exists yumbo_circuit_breaker;
