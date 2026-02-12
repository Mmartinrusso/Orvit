# Plan: Reemplazar console.log/error por sistema de logging estructurado

## Contexto Actual

### Lo que ya existe
- **`lib/logger.ts`** — Logger Pino básico con child loggers (afip, ocr, chatbot, forecast) y `PerformanceTracker`
- **`lib/ventas/detailed-audit-logger.ts`** — Audit trail a BD con diffs de campo (ya es independiente del logging)
- **Sentry** configurado en `sentry.server.config.ts` con `tracesSampleRate: 1` y `enableLogs: true`
- **Pino** ya instalado (`pino@^10.3.1` en package.json)
- **152 archivos** en `app/api/ventas/` con **~239 console.error/log calls**

### Patrón actual en cada route
```ts
catch (error) {
  console.error('Error fetching X:', error);
  return NextResponse.json({ error: '...' }, { status: 500 });
}
```

Algunos archivos tienen `console.log()` para info operativa (portal tokens, follow-ups, etc.).

---

## Plan de Implementación

### Paso 1: Extender `lib/logger.ts` con ventasLogger, sanitización y Sentry

**Archivo:** `lib/logger.ts` (editar, no crear nuevo)

**Cambios:**
1. Agregar función `sanitizeForLog(obj)` que remueva/redacte campos sensibles:
   - Campos a redactar: `password`, `token`, `secret`, `apiKey`, `accessToken`, `refreshToken`, `authorization`, `cookie`
   - Campos financieros a redactar parcialmente: `costoTotal`, `costoUnitario`, `margenBruto`, `margenPorcentaje`, `cost` → mostrar solo `[REDACTED]`
   - Campos de tarjeta: `cardNumber`, `cvv`, `cuit` → mostrar últimos 4 chars
   - Funciona recursivamente en objetos anidados

2. Agregar child logger para ventas:
   ```ts
   export const ventasLogger = logger.child({ domain: 'ventas' });
   ```

3. Agregar función helper `logVentasError()` que:
   - Loguea con `ventasLogger.error()` con contexto estructurado
   - Reporta a Sentry con `Sentry.captureException()` para errores 500
   - Incluye metadata: `userId`, `companyId`, `endpoint`, `method`, `duration`

4. Agregar función helper `logVentasInfo()` para logs informativos estructurados

5. Configurar pino con transports:
   - En desarrollo: `pino-pretty` a consola (todo nivel)
   - En producción: JSON a stdout (nivel `info`+), rotación via pino-file transport
   - Rotación: max 100MB por archivo, retención 7 días

**Tipos exportados:**
```ts
export interface VentasLogContext {
  userId?: number;
  companyId?: number;
  endpoint?: string;
  method?: string;
  entityType?: string;
  entityId?: number;
  [key: string]: unknown;
}
```

### Paso 2: Instalar dependencias necesarias

```bash
npm install pino-pretty pino-roll
```
- `pino-pretty`: Formato legible en desarrollo (ya podría estar)
- `pino-roll`: Rotación de archivos de log (max size, retention)

No se necesita `winston` — Pino ya está instalado y es más performante.

### Paso 3: Reemplazar console.log/error en `app/api/ventas/`

**Estrategia:** Reemplazo mecánico archivo por archivo, agrupado por módulo.

**Patrón de reemplazo:**

**Antes (catch blocks):**
```ts
console.error('Error fetching órdenes de venta:', error);
```

**Después:**
```ts
ventasLogger.error({ err: error, endpoint: '/api/ventas/ordenes', method: 'GET', companyId }, 'Error fetching órdenes de venta');
```

**Antes (info logs):**
```ts
console.log(`[Portal] Token generado para cotización ${numero}: ${token}`);
```

**Después:**
```ts
ventasLogger.info({ endpoint: '/api/ventas/cotizaciones/enviar', quoteNumber: numero }, 'Portal access token generated');
// NOTA: NO loguear el token real — dato sensible
```

**Antes (error en auditoría no-blocking):**
```ts
console.error('Error en auditoría:', e);
```

**Después:**
```ts
ventasLogger.warn({ err: e, endpoint: '/api/ventas/pagos', operation: 'audit' }, 'Non-blocking audit error');
```

**Cada archivo necesita:**
1. Agregar import: `import { ventasLogger } from '@/lib/logger';`
2. Reemplazar cada `console.error(...)` → `ventasLogger.error({ err: error, endpoint, method, companyId }, 'message')`
3. Reemplazar cada `console.log(...)` → `ventasLogger.info({ ... }, 'message')`
4. Asegurar que NO se logueen tokens, passwords ni datos financieros sensibles

### Paso 4: Integrar con Sentry para errores críticos

**Archivo:** `lib/logger.ts`

Agregar función wrapper que combine Pino + Sentry:
```ts
export function logVentasError(error: unknown, context: VentasLogContext, message: string) {
  const sanitizedContext = sanitizeForLog(context);
  ventasLogger.error({ err: error, ...sanitizedContext }, message);

  // Report to Sentry for 500-level errors
  if (error instanceof Error) {
    Sentry.captureException(error, {
      tags: { domain: 'ventas', endpoint: context.endpoint },
      extra: sanitizedContext,
    });
  }
}
```

Esto se usa en los catch blocks que retornan 500. Los errores de validación (400, 404, 422) solo se loguean con `ventasLogger.warn()`, no van a Sentry.

### Paso 5: Configurar rotación de logs en producción

En `lib/logger.ts`, configurar pino transport con `pino-roll`:
```ts
const transport = process.env.NODE_ENV === 'production'
  ? pino.transport({
      target: 'pino-roll',
      options: {
        file: './logs/app.log',
        size: '100m',      // Rotar a 100MB
        frequency: 'daily', // También rotar diariamente
        limit: { count: 7 }, // Retener 7 archivos
      },
    })
  : pino.transport({
      target: 'pino-pretty',
      options: { colorize: true },
    });
```

### Paso 6: Actualizar `detailed-audit-logger.ts`

Reemplazar su único `console.error` por `ventasLogger.warn()`:
```ts
// Línea 70: console.error('[DETAILED-AUDIT] Failed to log:', error);
ventasLogger.warn({ err: error, operation: 'detailed-audit' }, 'Failed to write audit log');
```

---

## Orden de Ejecución por Módulo

Los ~152 archivos se procesarán en lotes por módulo:

| # | Módulo | Archivos estimados | Prioridad |
|---|--------|-------------------|-----------|
| 1 | `lib/logger.ts` + deps | 1 | Alta — base para todo |
| 2 | `lib/ventas/detailed-audit-logger.ts` | 1 | Alta |
| 3 | `ordenes/` (route, [id], items, estado, etc.) | ~19 | Alta |
| 4 | `pagos/` (route, [id], aprobar, etc.) | ~7 | Alta |
| 5 | `facturas/` (route, [id], afip, bulk, etc.) | ~7 | Alta |
| 6 | `cotizaciones/` (route, [id], enviar, etc.) | ~17 | Media |
| 7 | `clientes/` (route, [id], analytics, etc.) | ~15 | Media |
| 8 | `entregas/` (route, [id], despachar, etc.) | ~17 | Media |
| 9 | `ordenes-carga/` | ~14 | Media |
| 10 | `productos/` | ~7 | Media |
| 11 | `listas-precios/` | ~7 | Media |
| 12 | `cuenta-corriente/` | ~4 | Baja |
| 13 | `reportes/` | ~11 | Baja |
| 14 | `dashboard/` | ~3 | Baja |
| 15 | Resto (cobranzas, disputas, metas, rmas, etc.) | ~23 | Baja |

---

## Criterios de Aceptación

1. **Cero `console.log` o `console.error`** en `app/api/ventas/` — verificable con `grep`
2. **Todos los logs usan `ventasLogger`** con contexto estructurado (endpoint, method, companyId mínimo)
3. **`sanitizeForLog()`** redacta: passwords, tokens, secrets, costos, márgenes, CUIT
4. **Errores 500 → Sentry** via `Sentry.captureException()`
5. **Errores 400/404/422 → solo log** (warn level, no Sentry)
6. **Rotación** configurada: 100MB max, 7 días retención
7. **Dev vs Prod**: consola pretty en dev, JSON estructurado en prod
8. **No se rompe nada**: la app sigue funcionando igual, solo cambia dónde van los logs

---

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| `pino-roll` no compatible con Next.js serverless | Usar stdout JSON en prod + servicio externo (Datadog/CloudWatch) para rotación |
| Import circular con Sentry | Import dinámico de Sentry solo en `logVentasError()` |
| Overhead de sanitización en hot paths | `sanitizeForLog` opera sobre objetos pequeños (contexto), no sobre payloads completos |
| Archivos que no siguen el patrón estándar | Revisar cada archivo individualmente, no usar find-replace ciego |

---

## Estimación de Cambios

- **1 archivo nuevo/modificado**: `lib/logger.ts` (expandir significativamente)
- **1 archivo modificado**: `lib/ventas/detailed-audit-logger.ts`
- **~152 archivos route** en `app/api/ventas/`: agregar import + reemplazar console calls
- **0 archivos frontend**: este cambio es 100% backend
- **2 dependencias nuevas**: `pino-pretty`, `pino-roll`
