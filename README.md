# Cotizador OEM — Raulspeed

Cotizador de repuestos OEM japoneses. Consulta el precio en Impex Japan, lo convierte de JPY a CLP usando el tipo de cambio del Banco Central de Chile (con fallback a exchangerate-api) y aplica la fórmula de negocio.

### Orden de cotización

1. **Impex en vivo** (`src/lib/impex.ts`) — precio y peso frescos. Cada consulta pasa por caché, cuota diaria, límite por minuto y circuit breaker.
2. **Base de datos** (`repuestos_catalogo.costo_jpy`) — respaldo, solo cuando Impex no está disponible (sin key, cuota agotada, circuito abierto, error de red). El precio se recalcula con la tasa de cambio vigente, no es un CLP congelado.

Cuando Impex responde limpio que la pieza **no existe o está descontinuada**, no se cae al respaldo: se le informa al cliente. Servir un precio viejo ahí sería cotizar algo que ya no se puede conseguir.

Cada cotización que llega a Impex **refresca la fila del catálogo** (precio, peso, nombre), así que el respaldo siempre es el último dato bueno conocido.

Migrado desde una app Flask/Python a Next.js (App Router, TypeScript).

## Estructura

- `src/app/page.tsx` — vista cliente (cotizador público).
- `src/app/admin/page.tsx` — panel administrador (tipo de cambio manual/automático, costo de logística). Protegido por login.
- `src/app/admin/login/page.tsx` — login del panel admin (Supabase Auth).
- `src/proxy.ts` — protege `/admin/*` redirigiendo a `/admin/login` sin sesión válida.
- `src/app/api/cotizar/route.ts` — endpoint POST que cotiza un número de parte.
- `src/app/api/tipo-cambio/route.ts` — endpoint GET que retorna el tipo de cambio JPY → CLP.
- `src/app/api/settings/route.ts` — GET/PUT del costo de logística y tasa manual (ambos solo admin).
- `src/lib/config.ts` — variables de entorno y multiplicadores de la fórmula.
- `src/lib/calculator.ts` — tipo de cambio (Banco Central + fallback) y fórmula de precio.
- `src/lib/impex.ts` — consulta a la API de Impex Japan (única fuente de precios en vivo).
- `src/lib/priceCache.ts` / `priceCircuitBreaker.ts` / `priceQuota.ts` — caché, circuit breaker y cuota diaria por proveedor (evitan repetir el agotamiento de cuota que ya pasó con Impex y con Yumbo).
- `src/lib/sobrecargoEnvio.ts` — tabla de reglas del sobrecargo por envío (peso + nombre + precio, sin llamar a ninguna API de flete).
- `src/lib/settings.ts` — lectura/escritura del costo de logística en Supabase.
- `src/lib/cotizar.ts` — orquestación de la cotización completa (repuesto + logística + sobrecargo por envío).
- `src/lib/supabase/client.ts` / `server.ts` — clientes Supabase (browser/servidor).

## Configuración

Copia `.env.example` a `.env.local` y completa las credenciales:

```bash
cp .env.example .env.local
```

- `IMPEX_API_KEY` — clave de la API de Impex Japan (obtener en https://en.impex-jp.com/user/profile/api-keys.html). El correo y la contraseña de esa cuenta no son variables de entorno: solo sirven para entrar al panel de Impex a ver el consumo o regenerar la key.
- `BCENTRAL_USER` / `BCENTRAL_PASS` — credenciales del Banco Central de Chile.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — proyecto Supabase (tabla `settings` + Auth del admin).

En Vercel, define las mismas variables en **Project Settings → Environment Variables**.

> **Importante:** las credenciales anteriores estaban hardcodeadas en `cotizador/config.py` y quedaron expuestas en el historial de git del repo original. Rota el API key del proveedor y la contraseña del Banco Central antes de usarlas en producción.

### Cuota diaria de Impex

La cuenta tiene un tope de **500 consultas/día**; el código opera con margen (`LIMITE_DIARIO_IMPEX` en `src/lib/priceQuota.ts`) y lleva la cuenta en Supabase (`price_provider_quota`), no en memoria — el límite por minuto de `rateLimit.ts` es por instancia y varias instancias en paralelo no se ven entre sí.

El día se corta a **medianoche JST**. El consumo se ve en `/admin`.

Ojo: una cotización puede costar **más de una consulta**. `normalizar()` prueba hasta 3 variantes del número de parte (con y sin guiones); un código que existe suele resolverse en la primera, uno que no existe gasta las tres. La caché guarda también los no encontrados para no pagarlos dos veces.

### Supabase

Proyecto: `raul speed` (ref `qixingzmmzriwqbuqiqm`).

- Tabla `settings` (fila única, `id = 1`): columna `costo_logistica_clp`. RLS: lectura pública, escritura solo para usuarios autenticados.
- Auth: un único usuario admin (creado directamente en Supabase Auth) usado para entrar a `/admin`.
- El costo de logística se guarda desde el panel admin y se suma automáticamente al precio de cada cotización (pública y admin).

## Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) — vista cliente — y [http://localhost:3000/admin](http://localhost:3000/admin) — panel administrador.

## Build

```bash
npm run build
npm run start
```

## Deploy

Proyecto Next.js estándar: Vercel lo detecta automáticamente, no requiere `vercel.json`.
