// Rate limit best-effort, en memoria del proceso de la función. No es
// distribuido: con Fluid Compute (instancias reutilizadas) frena a un
// abusador razonable desde la misma instancia, pero no protege contra
// tráfico repartido entre muchas instancias/regiones. Si algún día se
// necesita algo robusto habría que sumar un store compartido (Upstash
// Redis / Vercel KV) — por ahora esto evita el abuso simple que ya
// causó que se agotara la cuota de la API de Impex.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function limpiarExpirados(ahora: number): void {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (ahora > bucket.resetAt) buckets.delete(key);
  }
}

/**
 * Devuelve true si `key` superó `limite` intentos dentro de `ventanaMs`.
 */
export function rateLimitExcedido(key: string, limite: number, ventanaMs: number): boolean {
  const ahora = Date.now();
  limpiarExpirados(ahora);

  const bucket = buckets.get(key);
  if (!bucket || ahora > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: ahora + ventanaMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limite;
}

export function obtenerIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "desconocida";
}
