# Findings - Análisis Automático de Problemas

**Fecha:** 2025-01-27  
**Versión:** 1.0

## Resumen

Este documento lista problemas de performance identificados automáticamente en el código, ordenados por prioridad y esfuerzo.

---

## Tabla de Findings

| Área | Archivo/Endpoint | Tipo | Evidencia | Fix Propuesto | Prioridad | Esfuerzo |
|------|-----------------|------|-----------|---------------|-----------|----------|
| Frontend | `components/tax-control/TaxControlModal.tsx` | Fetch directo | 3 fetch en useEffect sin cache | Migrar a `useTaxBases`, `useTaxRecords`, `useTaxAlerts` | P0 | S |
| Frontend | `app/panol/page.tsx` | Fetch directo | `handleApproveRequest`, `handleRejectRequest` sin React Query | Crear mutations `useApproveToolRequest`, `useRejectToolRequest` | P0 | S |
| Frontend | `hooks/use-task-store.ts` | Fetch directo | Zustand con fetch directo, no React Query | Migrar a hooks React Query | P1 | M |
| Frontend | `components/dashboard/ComprehensiveDashboard.tsx` | Fetch directo | `fetchHistoricalData` sin React Query | Crear `useHistoricalData` hook | P1 | S |
| Frontend | `components/tax-control/TaxControlModal.tsx` | Cascada | 3 requests en useEffect sin deduplicación | React Query deduplica automáticamente | P0 | S |
| Frontend | `app/panol/page.tsx` | Cascada | `fetchAllData()` llama múltiples endpoints | Consolidar en un hook o endpoint agregador | P1 | M |
| Backend | `/api/tax-base` | Payload grande | Incluye `taxRecords` en cada base (nested) | Usar `select` para excluir relaciones innecesarias | P1 | S |
| Backend | `/api/tax-record` | Payload grande | Incluye `taxBase`, `receivedByUser`, `paidByUser` siempre | Hacer relaciones opcionales o usar `select` | P1 | S |
| Backend | `/api/dashboard/metrics` | Compute alto | Múltiples reduce() sobre arrays grandes | Pre-calcular en DB o cachear resultados | P1 | M |
| Backend | `/api/calculadora-costos-final` | Compute alto | Loops O(n²) sobre productos y recetas | Optimizar algoritmos, usar Maps O(1) | P0 | L |
| Backend | `/api/calculadora-costos-final` | Payload grande | 200-500KB sin paginación | Agregar paginación o reducir campos | P0 | M |
| Backend | `/api/core/bootstrap` | DB alto | Múltiples queries secuenciales | Ya optimizado con Promise.all ✅ | - | - |
| Backend | `/api/maintenance/dashboard` | Sin instrumentación | No tiene `lib/perf.ts` | Agregar instrumentación | P1 | S |
| Backend | `/api/costos/historial` | Sin instrumentación | No tiene `lib/perf.ts` | Agregar instrumentación | P1 | S |
| Backend | `/api/costos/categorias` | Sin instrumentación | No tiene `lib/perf.ts` | Agregar instrumentación | P1 | S |
| Backend | `/api/dashboard/metrics` | Cache HTTP | Solo 30s, podría ser más | Evaluar aumentar a 60s | P2 | S |
| Backend | `/api/maintenance/dashboard` | Sin cache HTTP | Endpoint pesado sin cache | Agregar Cache-Control 2min | P1 | S |
| Backend | `/api/admin/catalogs` | Sin cache HTTP | Endpoint pesado sin cache | Agregar Cache-Control 5min | P1 | S |
| Frontend | `hooks/use-dashboard-data.ts` | QueryKeys | `companyId` puede ser string o number | Normalizar a number siempre | P2 | S |
| Frontend | `hooks/use-calculadora-costos-final.ts` | QueryKeys | `productionMonth` puede ser undefined | Usar placeholder o enabled | P1 | S |
| Frontend | `components/dashboard/ComprehensiveDashboard.tsx` | Render | Múltiples hooks sin memo | Agregar useMemo para datos derivados | P2 | M |
| Backend | `/api/tax-base` | N+1 potencial | `taxRecords` en include puede causar N+1 | Verificar con EXPLAIN, agregar select | P1 | S |
| Backend | `/api/tax-record` | N+1 potencial | Múltiples includes anidados | Verificar con EXPLAIN, optimizar | P1 | S |

---

## Detalles por Tipo

### Fetch Directo (Frontend)

**Problema:** Componentes usando `fetch()` directamente en lugar de React Query.

**Impacto:** 
- Sin cache
- Sin deduplicación
- Sin staleTime
- Sin placeholderData
- Requests duplicados

**Archivos afectados:**
- `components/tax-control/TaxControlModal.tsx` - 11 fetch directos
- `app/panol/page.tsx` - 10 fetch directos
- `hooks/use-task-store.ts` - fetch directo en Zustand
- `components/dashboard/ComprehensiveDashboard.tsx` - fetch directo en `fetchHistoricalData`

**Fix:** Migrar a hooks React Query con mutations para POST/PUT/DELETE.

---

### Payload Grande (Backend)

**Problema:** Endpoints devolviendo 200-500KB sin necesidad.

**Impacto:**
- Tiempo de serialización JSON alto
- Tiempo de transferencia alto
- Memoria alta en cliente

**Endpoints afectados:**
- `/api/calculadora-costos-final` - 200-500KB
- `/api/tax-base` - Incluye `taxRecords` nested (redundante)
- `/api/tax-record` - Incluye relaciones completas siempre

**Fix:** 
- Usar `select` en Prisma para solo campos necesarios
- Hacer relaciones opcionales
- Agregar paginación donde aplique

---

### Compute Alto (Backend)

**Problema:** Cálculos pesados en endpoints (loops, transformaciones).

**Impacto:**
- X-Perf-Compute alto (>500ms)
- CPU alto en servidor
- Tiempo de respuesta alto

**Endpoints afectados:**
- `/api/calculadora-costos-final` - Loops O(n²) sobre productos
- `/api/dashboard/metrics` - Múltiples reduce() sobre arrays

**Fix:**
- Optimizar algoritmos (usar Maps O(1) en lugar de find O(n))
- Pre-calcular en DB donde sea posible
- Cachear resultados intermedios

---

### DB Alto (Backend)

**Problema:** Queries lentas o N+1.

**Impacto:**
- X-Perf-DB alto (>500ms)
- Carga en base de datos
- Tiempo de respuesta alto

**Endpoints afectados:**
- `/api/calculadora-costos-final` - Múltiples queries complejas
- `/api/tax-base` - Potencial N+1 con `taxRecords`
- `/api/tax-record` - Múltiples includes anidados

**Fix:**
- Usar `select` para solo campos necesarios
- Verificar N+1 con EXPLAIN
- Agregar índices si falta
- Optimizar joins

---

### Sin Instrumentación (Backend)

**Problema:** Endpoints sin `lib/perf.ts`, no se pueden medir.

**Impacto:**
- No se puede identificar cuellos de botella
- No se puede medir mejoras

**Endpoints afectados:**
- `/api/maintenance/dashboard`
- `/api/costos/historial`
- `/api/costos/categorias`
- Y ~360 más

**Fix:** Agregar instrumentación con `lib/perf.ts`.

---

### Sin Cache HTTP (Backend)

**Problema:** Endpoints pesados sin cache HTTP.

**Impacto:**
- Requests repetidos innecesarios
- Carga en servidor

**Endpoints afectados:**
- `/api/maintenance/dashboard` - 1-3s, sin cache
- `/api/admin/catalogs` - 1-2s, sin cache
- `/api/costos/categorias` - Sin cache

**Fix:** Agregar `Cache-Control` header donde tenga sentido (15s-5min según tipo de dato).

---

### QueryKeys Inconsistentes (Frontend)

**Problema:** QueryKeys con tipos inconsistentes (string vs number).

**Impacto:**
- Cache no funciona correctamente
- Queries duplicadas

**Hooks afectados:**
- `use-dashboard-data.ts` - `companyId` puede ser string o number
- `use-calculadora-costos-final.ts` - `productionMonth` puede ser undefined

**Fix:** Normalizar tipos en queryKeys (siempre number para IDs, siempre string para meses).

---

### Cascadas (Frontend)

**Problema:** Un componente dispara múltiples queries sin necesidad.

**Impacto:**
- Múltiples requests simultáneos
- Tiempo de carga alto

**Componentes afectados:**
- `TaxControlModal` - 3 requests en useEffect
- `PanolPage` - `fetchAllData()` llama múltiples endpoints

**Fix:** 
- React Query deduplica automáticamente (si se usa)
- Consolidar en endpoint agregador si aplica

---

### Renders Innecesarios (Frontend)

**Problema:** Componentes re-renderizando sin necesidad.

**Impacto:**
- CPU alto en cliente
- UI lenta

**Componentes afectados:**
- `ComprehensiveDashboard` - Múltiples hooks sin memo

**Fix:** Agregar `useMemo`, `useCallback`, `React.memo` donde sea necesario (solo si hay evidencia de problema).

---

## Priorización

### P0 - Crítico (Hacer primero)
1. Migrar TaxControlModal a React Query
2. Migrar PanolPage handlers a React Query
3. Optimizar calculadora-costos-final (compute)

### P1 - Alto (Hacer después)
4. Reducir payloads grandes
5. Agregar instrumentación a endpoints críticos
6. Agregar cache HTTP a endpoints pesados
7. Migrar useTaskStore a React Query

### P2 - Medio (Hacer si hay tiempo)
8. Normalizar queryKeys
9. Optimizar renders
10. Aumentar cache HTTP

---

## Próximos Pasos

Ver `OPTIMIZATION_PLAN.md` para plan detallado de implementación.

