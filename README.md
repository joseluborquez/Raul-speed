# Cotizador OEM — Raulspeed

Cotizador de repuestos OEM japoneses. Consulta el precio en Yumbo Japan, lo convierte de JPY a CLP usando el tipo de cambio del Banco Central de Chile (con fallback a exchangerate-api) y aplica la fórmula de negocio.

Migrado desde una app Flask/Python a Next.js (App Router, TypeScript).

## Estructura

- `src/app/page.tsx` — vista cliente (cotizador público).
- `src/app/admin/page.tsx` — panel administrador (tipo de cambio manual/automático, costo de logística). Protegido por login.
- `src/app/admin/login/page.tsx` — login del panel admin (Supabase Auth).
- `src/proxy.ts` — protege `/admin/*` redirigiendo a `/admin/login` sin sesión válida.
- `src/app/api/cotizar/route.ts` — endpoint POST que cotiza un número de parte.
- `src/app/api/tipo-cambio/route.ts` — endpoint GET que retorna el tipo de cambio JPY → CLP.
- `src/app/api/settings/route.ts` — GET público / PUT protegido del costo de logística.
- `src/lib/config.ts` — variables de entorno y multiplicadores de la fórmula.
- `src/lib/calculator.ts` — tipo de cambio (Banco Central + fallback) y fórmula de precio.
- `src/lib/yumbo.ts` — consulta a la API de Yumbo Japan (única fuente de precios).
- `src/lib/sobrecargoEnvio.ts` — tabla de reglas del sobrecargo por envío (peso + nombre + precio, sin llamar a ninguna API de flete).
- `src/lib/settings.ts` — lectura/escritura del costo de logística en Supabase.
- `src/lib/cotizar.ts` — orquestación de la cotización completa (repuesto + logística + sobrecargo por envío).
- `src/lib/supabase/client.ts` / `server.ts` — clientes Supabase (browser/servidor).

## Configuración

Copia `.env.example` a `.env.local` y completa las credenciales:

```bash
cp .env.example .env.local
```

- `YUMBO_API_KEY` — clave de la API de Yumbo Japan (obtener en https://yumbo-jp.com/user/user/profile.html).
- `BCENTRAL_USER` / `BCENTRAL_PASS` — credenciales del Banco Central de Chile.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — proyecto Supabase (tabla `settings` + Auth del admin).

En Vercel, define las mismas variables en **Project Settings → Environment Variables**.

> **Importante:** las credenciales anteriores estaban hardcodeadas en `cotizador/config.py` y quedaron expuestas en el historial de git del repo original. Rota el API key de Impex/Yumbo y la contraseña del Banco Central antes de usarlas en producción.

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
