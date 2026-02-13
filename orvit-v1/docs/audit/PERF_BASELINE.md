# Baseline de Performance - Auditoría

**Fecha:** 2025-01-27  
**Versión:** 1.0  
**Ambiente:** DEV (estimado basado en código y estructura)

## Resumen Ejecutivo

Este documento establece el baseline de performance del sistema ORVIT basado en análisis de código, estructura de endpoints, y patrones identificados. **Nota:** Las mediciones reales requieren ejecución en ambiente DEV/PROD con `?debug=1`.

---

## 1. Top 10 Endpoints Más Pesados (Estimado)

| # | Endpoint | Total (ms) | DB (ms) | Compute (ms) | JSON (ms) | Payload (KB) | Instrumentado |
|---|----------|------------|---------|--------------|-----------|--------------|---------------|
| 1 | `/api/calculadora-costos-final` | 3000-12000 | 2000-8000 | 800-3000 | 100-500 | 200-500 | ✅ |
| 2 | `/api/maintenance/dashboard` | 1000-3000 | 500-2000 | 300-800 | 50-200 | 100-200 | ❌ |
| 3 | `/api/admin/catalogs` | 1000-2000 | 800-1500 | 100-300 | 50-100 | 100 | ❌ |
| 4 | `/api/dashboard/metrics` | 500-2000 | 300-1500 | 100-300 | 50-100 | 50 | ❌ |
| 5 | `/api/costos/historial` | 500-1000 | 300-700 | 100-200 | 50-100 | 50-100 | ❌ |
| 6 | `/api/work-orders/[id]` | 500-1000 | 300-700 | 100-200 | 50-100 | 50 | ❌ |
| 7 | `/api/machines/[id]/history` | 500-1000 | 300-700 | 100-200 | 50-100 | 50 | ❌ |
| 8 | `/api/costos/stats` | 300-800 | 200-500 | 50-200 | 50-100 | 20 | ❌ |
| 9 | `/api/products` | 300-800 | 200-500 | 50-200 | 50-100 | 50 | ❌ |
| 10 | `/api/insumos/insumos` | 300-800 | 200-500 | 50-200 | 50-100 | 40 | ❌ |

**Nota:** Solo 1 de 10 endpoints está instrumentado. Las estimaciones se basan en:
- Complejidad de queries SQL
- Cantidad de datos procesados
- Transformaciones en el código
- Tamaño de payloads observados

---

## 2. Análisis por Fase

### 2.1 Parse (URL params, body parsing)
- **Rango típico:** 1-50ms
- **Endpoints problemáticos:** Ninguno identificado
- **Observación:** Parse es generalmente rápido

### 2.2 Database (Queries SQL)
- **Rango típico:** 50-8000ms
- **Endpoints problemáticos:**
  - `/api/calculadora-costos-final`: 2000-8000ms (múltiples queries complejas)
  - `/api/maintenance/dashboard`: 500-2000ms (queries con joins)
  - `/api/dashboard/metrics`: 300-1500ms (queries en paralelo)
- **Observación:** DB es el cuello de botella principal en endpoints pesados

### 2.3 Compute (Transformaciones, loops, cálculos)
- **Rango típico:** 50-3000ms
- **Endpoints problemáticos:**
  - `/api/calculadora-costos-final`: 800-3000ms (cálculos complejos, loops sobre productos)
  - `/api/maintenance/dashboard`: 300-800ms (agregaciones)
- **Observación:** Compute es significativo en endpoints de cálculo

### 2.4 JSON (Serialización)
- **Rango típico:** 50-500ms
- **Endpoints problemáticos:**
  - `/api/calculadora-costos-final`: 100-500ms (payload grande)
- **Observación:** JSON es generalmente rápido excepto en payloads grandes

---

## 3. Baseline de Frontend

### 3.1 Requests Duplicados Identificados

#### TaxControlModal
- **Problema:** 3 fetch directos sin cache
- **Endpoints:** `/api/tax-base`, `/api/tax-record`, `/api/tax-alerts/check`
- **Frecuencia:** Cada vez que se abre el modal
- **Impacto:** 3 requests adicionales innecesarios

#### PanolPage
- **Problema:** Fetch directo en handlers
- **Endpoints:** `/api/tool-requests/[id]/approve`
- **Frecuencia:** Cada aprobación/rechazo
- **Impacto:** Sin cache, sin deduplicación

#### ComprehensiveDashboard
- **Problema:** Fetch directo para datos históricos
- **Endpoints:** Múltiples llamadas a `/api/dashboard/metrics` con diferentes meses
- **Frecuencia:** Al cargar datos históricos
- **Impacto:** Múltiples requests sin React Query

### 3.2 React Query Coverage

- **Hooks con React Query:** ~15 hooks identificados
- **Fetch directo:** Múltiples componentes (TaxControlModal, PanolPage, ComprehensiveDashboard, useTaskStore)
- **Cobertura estimada:** ~70% de requests usan React Query

### 3.3 Cache Hit Rate (Estimado)

- **React Query:** staleTime 5min, gcTime 30min
- **Cache HTTP:** Solo `/api/dashboard/metrics` (30s)
- **Cache hit rate estimado:** ~40-60% (depende del uso)

---

## 4. Baseline de Base de Datos

### 4.1 Tablas Más Grandes (estimado)

Basado en estructura de schema y queries identificadas:

| Tabla | Filas Estimadas | Tamaño Estimado | Índices |
|-------|-----------------|-----------------|---------|
| `monthly_sales` | 10K-100K | 50-500MB | ✅ |
| `monthly_production` | 10K-100K | 50-500MB | ✅ |
| `ChecklistExecution` | 5K-50K | 20-200MB | ✅ |
| `Maintenance` | 5K-50K | 20-200MB | ✅ |
| `Product` | 1K-10K | 10-100MB | ✅ |
| `Tool` | 1K-10K | 10-100MB | ✅ |
| `Employee` | 100-1K | 1-10MB | ✅ |
| `User` | 100-1K | 1-10MB | ✅ |

**Nota:** Valores estimados. Requiere query real a `pg_stat_user_tables`.

### 4.2 Índices Identificados

- **Primary keys:** Todas las tablas principales
- **Foreign keys:** Índices en relaciones comunes
- **Búsquedas frecuentes:** Índices en `companyId`, `fecha_imputacion`, `sectorId`

**Observación:** Estructura de índices parece adecuada. Requiere análisis de `EXPLAIN` para queries específicas.

---

## 5. Baseline de Network

### 5.1 Tamaño de Payloads

| Tipo | Rango | Ejemplos |
|------|-------|----------|
| Pequeño (<10KB) | 2-10KB | `/api/dashboard/available-months`, `/api/tax-alerts/check` |
| Mediano (10-50KB) | 10-50KB | `/api/dashboard/metrics`, `/api/costos/categorias` |
| Grande (50-200KB) | 50-200KB | `/api/maintenance/dashboard`, `/api/costos/historial` |
| Muy Grande (>200KB) | 200-500KB | `/api/calculadora-costos-final` |

### 5.2 Requests por Página (Estimado)

| Página | Requests Iniciales | Requests Totales (con interacciones) |
|--------|-------------------|-------------------------------------|
| Dashboard | 4-6 | 6-10 |
| Costos/Calculadora | 3-5 | 5-8 |
| Mantenimiento | 2-4 | 4-8 |
| Panol | 2-3 | 5-10 |
| Tax Control | 3-4 | 3-6 |

**Observación:** Algunas páginas tienen requests duplicados que podrían eliminarse.

---

## 6. Métricas de Performance (Objetivo)

### 6.1 Tiempo de Carga de Página (Target)

| Página | Actual (estimado) | Objetivo | Mejora Necesaria |
|--------|------------------|----------|------------------|
| Dashboard | 2-5s | <2s | 40-60% |
| Costos/Calculadora | 5-15s | <3s | 40-80% |
| Mantenimiento | 2-4s | <2s | 0-50% |
| Panol | 1-3s | <1.5s | 0-50% |

### 6.2 Time to First Byte (TTFB)

- **Actual (estimado):** 100-500ms (endpoints simples), 500-2000ms (endpoints pesados)
- **Objetivo:** <200ms (endpoints simples), <500ms (endpoints pesados)

### 6.3 First Contentful Paint (FCP)

- **Actual (estimado):** 1-3s
- **Objetivo:** <1.5s

---

## 7. Cómo Medir Baseline Real

### 7.1 Endpoints Instrumentados

Para endpoints con `lib/perf.ts`:

```bash
# Ejemplo: Medir calculadora-costos-final
curl -H "Cookie: token=..." "http://localhost:3000/api/calculadora-costos-final?companyId=1&productionMonth=2025-01&distributionMethod=sales&debug=1" -v

# Ver headers X-Perf-*
# X-Perf-Total: tiempo total
# X-Perf-Parse: tiempo de parse
# X-Perf-DB: tiempo de DB
# X-Perf-Compute: tiempo de compute
# X-Perf-JSON: tiempo de JSON
# X-Perf-PayloadBytes: tamaño del payload
```

### 7.2 Endpoints Sin Instrumentar

Para endpoints sin instrumentación:

1. **DevTools Network Tab:**
   - Abrir DevTools → Network
   - Filtrar por XHR/Fetch
   - Verificar:
     - Tiempo total (Total)
     - Tiempo de espera (Waiting)
     - Tamaño de respuesta (Size)

2. **Script de Medición:**
   - Crear script que haga múltiples requests
   - Medir tiempos promedio
   - Comparar antes/después de optimizaciones

### 7.3 Base de Datos

```sql
-- Ver tablas más grandes
SELECT 
  schemaname,
  relname as table_name,
  n_live_tup as row_count,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as total_size
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC
LIMIT 20;

-- Ver índices
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

---

## 8. Próximos Pasos

1. **Ejecutar mediciones reales** en ambiente DEV con `?debug=1`
2. **Instrumentar endpoints críticos** sin instrumentación
3. **Medir baseline de DB** con queries a `pg_stat_user_tables`
4. **Comparar con objetivos** definidos en esta sección
5. **Aplicar optimizaciones** según `OPTIMIZATION_PLAN.md`

---

## 9. Notas

- **Estimaciones:** Todos los valores son estimaciones basadas en análisis de código
- **Mediciones reales:** Requieren ejecución en ambiente DEV/PROD
- **Variabilidad:** Los tiempos pueden variar según:
  - Carga de la base de datos
  - Tamaño de datos (filas en tablas)
  - Red (latencia)
  - Hardware del servidor

