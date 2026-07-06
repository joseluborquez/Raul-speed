# Cotizador OEM — Raulspeed

Cotizador de repuestos OEM japoneses. Consulta el precio en Impex Japan, lo convierte de JPY a CLP usando el tipo de cambio del Banco Central de Chile (con fallback a exchangerate-api) y aplica la fórmula de negocio.

Migrado desde una app Flask/Python a Next.js (App Router, TypeScript).

## Estructura

- `src/app/page.tsx` — vista cliente (cotizador público).
- `src/app/admin/page.tsx` — panel administrador (tipo de cambio manual/automático).
- `src/app/api/cotizar/route.ts` — endpoint POST que cotiza un número de parte.
- `src/app/api/tipo-cambio/route.ts` — endpoint GET que retorna el tipo de cambio JPY → CLP.
- `src/lib/config.ts` — variables de entorno y multiplicadores de la fórmula.
- `src/lib/calculator.ts` — tipo de cambio (Banco Central + fallback) y fórmula de precio.
- `src/lib/impex.ts` — consulta a la API de Impex Japan (única fuente de precios).
- `src/lib/cotizar.ts` — orquestación de la cotización completa.

## Configuración

Copia `.env.example` a `.env.local` y completa las credenciales:

```bash
cp .env.example .env.local
```

- `IMPEX_API_KEY` — clave de la API de Impex Japan.
- `BCENTRAL_USER` / `BCENTRAL_PASS` — credenciales del Banco Central de Chile.

En Vercel, define las mismas variables en **Project Settings → Environment Variables**.

> **Importante:** las credenciales anteriores estaban hardcodeadas en `cotizador/config.py` y quedaron expuestas en el historial de git del repo original. Rota el API key de Impex y la contraseña del Banco Central antes de usarlas en producción.

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
