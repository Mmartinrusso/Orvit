# Plan: Sistema de Análisis Automatizado del Codebase

## Resumen

Implementar un sistema de análisis estático del codebase que detecte anti-patterns, código duplicado, problemas de seguridad en rutas, y oportunidades de refactoring. El sistema se ejecuta bajo demanda o por cron, almacena resultados en la base de datos, notifica issues críticos, y presenta un dashboard de seguimiento.

---

## Fase 1: Tipos, Validaciones y Modelo de Datos

### 1.1 — `lib/types/code-analysis.ts`

Definir interfaces TypeScript para todo el sistema:

```typescript
// Severidades de findings
type Severity = 'info' | 'warning' | 'error' | 'critical';

// Categorías de análisis
type AnalysisCategory = 'security' | 'quality' | 'anti-pattern' | 'duplication';

// Un finding individual
interface AnalysisFinding {
  id: string;
  category: AnalysisCategory;
  severity: Severity;
  title: string;
  description: string;
  filePath: string;
  line?: number;
  suggestion?: string;
  metadata?: Record<string, unknown>;
}

// Resultado de un analyzer individual
interface AnalyzerResult {
  analyzer: string;          // e.g. 'route-security', 'code-quality'
  findings: AnalysisFinding[];
  durationMs: number;
}

// Reporte completo
interface AnalysisReport {
  id?: number;
  companyId: number;
  triggeredBy: 'manual' | 'cron';
  userId?: number;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  results: AnalyzerResult[];
  summary: AnalysisSummary;
}

interface AnalysisSummary {
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  byCategory: Record<AnalysisCategory, number>;
  topFiles: { path: string; count: number }[];
}
```

### 1.2 — `lib/validations/code-analysis.ts`

Zod schemas siguiendo el patrón existente (`lib/validations/helpers.ts`):

- `TriggerAnalysisSchema`: array opcional de analyzers a ejecutar, validado contra enum
- `ListAnalysisSchema`: paginación (page, limit) + filtro opcional de status
- Tipos inferidos exportados

### 1.3 — Modelo Prisma: `CodeAnalysisRun`

Agregar al final de `prisma/schema.prisma`:

```prisma
model CodeAnalysisRun {
  id          Int      @id @default(autoincrement())
  companyId   Int
  userId      Int?
  triggeredBy String   @default("manual")  // "manual" | "cron"
  status      String   @default("running")  // "running" | "completed" | "failed"
  analyzers   String[] @default([])
  results     Json?                          // AnalyzerResult[]
  summary     Json?                          // AnalysisSummary
  error       String?
  startedAt   DateTime @default(now())
  completedAt DateTime?
  createdAt   DateTime @default(now())

  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([companyId])
  @@index([companyId, status])
  @@index([startedAt])
  @@map("code_analysis_run")
}
```

Agregar relaciones inversas en `Company` y `User`. Agregar `code_analysis_critical` al enum `NotificationType`.

---

## Fase 2: Analyzers (Core Logic)

Cada analyzer es un módulo independiente que exporta una función `analyze(basePath: string): Promise<AnalyzerResult>`. Lee archivos con `fs/promises`, busca patrones con regex. Análisis estático puro, no ejecuta código.

### 2.1 — `lib/code-analysis/analyzers/route-security.ts`

Escanea `app/api/**/*.ts`. Detecta:

| Finding | Severidad | Descripción |
|---------|-----------|-------------|
| Ruta sin `withGuards` | `critical` | Export de handler HTTP sin wrapper de auth |
| POST/PUT sin `validateRequest` | `error` | Input no validado en rutas que reciben body |
| Sin `force-dynamic` | `warning` | Ruta API sin export de dynamic rendering |
| Query sin `companyId` | `error` | Prisma findMany/findFirst sin filtro multi-tenant |

### 2.2 — `lib/code-analysis/analyzers/code-quality.ts`

Escanea `**/*.{ts,tsx}` (excluye node_modules, .next, tests). Detecta:

| Finding | Severidad | Descripción |
|---------|-----------|-------------|
| Función >100 líneas | `warning` | Función demasiado larga, candidata a split |
| Archivo >500 líneas | `info` | Archivo grande, considerar descomponer |
| `console.log` en producción | `warning` | Debug logging fuera de archivos debug |
| TODO/FIXME/HACK | `info` | Tracking de deuda técnica |
| Uso de `: any` / `as any` | `warning` | Type safety comprometida |

### 2.3 — `lib/code-analysis/analyzers/anti-patterns.ts`

Escanea componentes y rutas. Detecta anti-patterns del frontend-guidelines:

| Finding | Severidad | Descripción |
|---------|-----------|-------------|
| `useEffect` sin deps array | `error` | Efecto sin dependencias = loop infinito potencial |
| Colores hex hardcodeados | `warning` | Debería usar `userColors` del sistema |
| `window.alert()` | `warning` | Debería usar toast de sonner |
| `fetch` sin catch | `warning` | Llamadas API sin manejo de errores |

### 2.4 — `lib/code-analysis/analyzers/duplicate-patterns.ts`

Busca patrones de código repetido:

| Finding | Severidad | Descripción |
|---------|-----------|-------------|
| Bloque de auth repetido | `warning` | Lógica de auth duplicada vs `withGuards` |
| Fetch pattern repetido | `info` | Mismo patrón fetch/setState/error en múltiples archivos |
| Config Prisma repetida | `info` | Queries con misma estructura select/include |

Implementación: Normaliza bloques (quita whitespace/comments), hashea y compara.

### 2.5 — `lib/code-analysis/orchestrator.ts`

```typescript
export async function runAnalysis(options: {
  companyId: number;
  userId?: number;
  triggeredBy: 'manual' | 'cron';
  analyzers?: string[];
}): Promise<AnalysisReport>
```

Flujo:
1. Crear registro `CodeAnalysisRun` con status `running`
2. Ejecutar analyzers seleccionados en paralelo (`Promise.allSettled`)
3. Calcular `AnalysisSummary` (totals, bySeverity, byCategory, topFiles)
4. Actualizar registro con results + summary + status `completed`
5. Si hay findings `critical` → crear notificación via Prisma
6. Retornar reporte completo

### 2.6 — Reporters

**`lib/code-analysis/reporters/console-reporter.ts`** — Formatea resultados como string legible para logs del cron.

**`lib/code-analysis/reporters/database-reporter.ts`** — Funciones para crear/actualizar `CodeAnalysisRun` en Prisma.

---

## Fase 3: API Routes

### 3.1 — `app/api/code-analysis/route.ts`

**GET** — Lista análisis anteriores (paginado):
- Permiso: `code_analysis.view`
- Query params: `page`, `limit`, `status` (validados con `ListAnalysisSchema`)
- Filtra por `companyId` del usuario autenticado
- Retorna: `{ runs: [...], total: number, page, limit }`

**POST** — Trigger nuevo análisis:
- Permiso: `code_analysis.trigger`
- Body: `{ analyzers?: string[] }` (validado con `TriggerAnalysisSchema`)
- Crea registro, lanza análisis en background (no bloquea respuesta)
- Retorna: `{ id: number, status: 'running' }` inmediatamente

### 3.2 — `app/api/code-analysis/[id]/route.ts`

**GET** — Detalle de un análisis:
- Permiso: `code_analysis.view`
- Verifica que pertenece al `companyId` del usuario
- Retorna reporte completo con findings

### 3.3 — `app/api/cron/code-analysis/route.ts`

**GET** — Ejecutado por Vercel Cron:
- Verifica `CRON_SECRET` (patrón estándar del codebase)
- Obtiene compañías activas
- Ejecuta `runAnalysis({ triggeredBy: 'cron' })` para cada una
- Structured logging con `loggers.cron`
- Crea notificaciones para users ADMIN+ si hay findings `critical`

---

## Fase 4: Notificaciones

Agregar `code_analysis_critical` al enum `NotificationType` en Prisma.

El orchestrator crea notificaciones cuando un análisis tiene findings `critical`:
- Solo para usuarios con rol ADMIN+ en la compañía
- Tipo: `code_analysis_critical`
- Título: "Análisis de código: issues críticos detectados"
- Mensaje: resumen de cantidad de findings
- Data: `{ analysisRunId }` para linkear al detalle

---

## Fase 5: Permisos

Agregar al tipo `Permission` en `lib/permissions.ts`:
- `code_analysis.view` — Ver resultados de análisis
- `code_analysis.trigger` — Ejecutar análisis manualmente
- `code_analysis.export` — Exportar reportes

Agregar categoría `code_analysis` al objeto de categorías de permisos.

---

## Fase 6: Frontend — `app/administracion/analisis-codigo/page.tsx`

Página client-side con `'use client'`. Estructura:

**Header:** Título + botón "Ejecutar Análisis" + botón "Exportar CSV"

**KPI Cards (grid 2-5 cols):**
- Total findings (último análisis)
- Findings críticos (color `kpiNegative` si > 0)
- Findings por categoría (4 mini badges)
- Trend vs anterior (mejorando ↓ / empeorando ↑)

**Tabs:**
1. **Último Análisis** — Findings del run más reciente
   - Filtros: severidad dropdown, categoría dropdown, búsqueda texto
   - Cards por finding: severity badge, filepath:line, description, suggestion
   - Ordenados por severidad (critical primero)
2. **Historial** — Tabla paginada de runs anteriores
   - Columnas: fecha, triggeredBy, status badge, total findings, duración
   - Click → muestra detalle inline
3. **Tendencias** — Gráficos de evolución (recharts)
   - Line chart: findings over time
   - Donut: distribución por categoría

**Patrones UI seguidos:**
- Colores dinámicos via `userColors` (del `CompanyContext` o dashboard config)
- Loading spinner con ícono central
- Empty state con CTA "Ejecutar primer análisis"
- Toast para feedback (sonner)
- Responsive grid

Componentes inline (no archivos separados):
- `FindingCard` — Card individual de finding
- `SeverityBadge` — Badge coloreado por severidad
- `AnalysisSummaryCards` — KPIs del resumen

---

## Fase 7: Configuración — `vercel.json`

Agregar cron job semanal:
```json
{
  "path": "/api/cron/code-analysis",
  "schedule": "0 3 * * 1"
}
```
(Lunes a las 3 AM — análisis pesado, frecuencia semanal es adecuada)

---

## Archivos a Crear (13):

| # | Archivo | Descripción |
|---|---------|-------------|
| 1 | `lib/types/code-analysis.ts` | Interfaces TypeScript |
| 2 | `lib/validations/code-analysis.ts` | Zod schemas |
| 3 | `lib/code-analysis/orchestrator.ts` | Orquestador principal |
| 4 | `lib/code-analysis/analyzers/route-security.ts` | Analyzer de seguridad en rutas |
| 5 | `lib/code-analysis/analyzers/code-quality.ts` | Analyzer de calidad |
| 6 | `lib/code-analysis/analyzers/anti-patterns.ts` | Analyzer de anti-patterns |
| 7 | `lib/code-analysis/analyzers/duplicate-patterns.ts` | Analyzer de duplicados |
| 8 | `lib/code-analysis/reporters/console-reporter.ts` | Reporter para logs |
| 9 | `lib/code-analysis/reporters/database-reporter.ts` | Reporter para Prisma |
| 10 | `app/api/code-analysis/route.ts` | API: list + trigger |
| 11 | `app/api/code-analysis/[id]/route.ts` | API: detalle |
| 12 | `app/api/cron/code-analysis/route.ts` | Cron job |
| 13 | `app/administracion/analisis-codigo/page.tsx` | Página frontend |

## Archivos a Modificar (3):

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `prisma/schema.prisma` | Agregar modelo `CodeAnalysisRun` + enum value |
| 2 | `lib/permissions.ts` | Agregar permisos `code_analysis.*` |
| 3 | `vercel.json` | Agregar cron entry |

---

## Orden de Implementación

1. Tipos y validaciones (1.1, 1.2)
2. Schema Prisma (1.3) — solo editar, no migrar
3. Permisos (Fase 5)
4. Analyzers (2.1–2.4) — en paralelo
5. Reporters (2.6)
6. Orchestrator (2.5)
7. API routes (3.1–3.3)
8. Frontend (Fase 6)
9. Vercel config (Fase 7)

---

## Decisiones de Diseño

1. **Análisis estático puro:** Los analyzers leen archivos y buscan patrones con regex. No ejecutan código ni importan módulos. Seguro y rápido.

2. **Resultados en JSON:** Se guardan como `Json` en Prisma. Simplifica el schema y permite evolucionar el formato sin migraciones.

3. **Ejecución asíncrona:** POST retorna inmediatamente con el ID. El análisis corre en background. El frontend hace polling del status.

4. **Analyzers modulares:** Cada analyzer es independiente. Se pueden agregar nuevos sin modificar el orchestrator.

5. **Cron semanal:** Análisis pesado → semanal los lunes a las 3 AM.

6. **Sin dependencias nuevas:** Todo se implementa con fs/promises + regex. No se necesitan herramientas de AST externas.
