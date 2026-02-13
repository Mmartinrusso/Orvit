# Plan de Optimización - Auditoría de Performance

**Fecha:** 2025-01-27  
**Versión:** 1.0

## Resumen Ejecutivo

Este documento prioriza las mejoras de performance identificadas en la auditoría, ordenadas por impacto, esfuerzo y riesgo. Se enfoca en "quick wins" primero, luego mejoras de mediano plazo.

---

## Top 15 Mejoras Priorizadas

### Quick Wins (Alto Impacto, Bajo Esfuerzo, Bajo Riesgo)

#### 1. ✅ Migrar TaxControlModal a React Query
- **Impacto:** Alto (elimina 3 requests duplicados sin cache)
- **Esfuerzo:** Bajo (2-3 horas)
- **Riesgo:** Bajo
- **Descripción:** 
  - Crear hooks `useTaxBases`, `useTaxRecords`, `useTaxAlerts`
  - Reemplazar fetch directo en `TaxControlModal`
  - Agregar `staleTime` y `placeholderData`
- **Cómo verificar:**
  - Abrir DevTools → Network
  - Abrir `TaxControlModal`
  - Verificar que solo se hacen 3 requests (no duplicados)
  - Verificar que al reabrir el modal, no se hacen nuevos requests (cache)

#### 2. ✅ Instrumentar endpoints críticos sin instrumentación
- **Impacto:** Alto (permite medir y optimizar)
- **Esfuerzo:** Bajo (1-2 horas)
- **Riesgo:** Bajo
- **Endpoints a instrumentar:**
  - `/api/core/bootstrap`
  - `/api/dashboard/metrics`
  - `/api/maintenance/dashboard`
  - `/api/costos/historial`
  - `/api/costos/categorias`
- **Cómo verificar:**
  - Agregar `?debug=1` a cada endpoint
  - Verificar headers `X-Perf-*` en respuesta
  - Comparar tiempos antes/después de optimizaciones

#### 3. ✅ Migrar PanolPage handlers a React Query mutations
- **Impacto:** Medio (elimina fetch directo, agrega cache)
- **Esfuerzo:** Bajo (1-2 horas)
- **Riesgo:** Bajo
- **Descripción:**
  - Crear `useApproveToolRequest`, `useRejectToolRequest` con `useMutation`
  - Reemplazar fetch directo en `handleApproveRequest`, `handleRejectRequest`
  - Invalidar queries relacionadas después de mutación
- **Cómo verificar:**
  - Aprobar/rechazar solicitud en PanolPage
  - Verificar que se actualiza la UI sin refetch manual
  - Verificar que no hay requests duplicados

#### 4. ✅ Normalizar queryKeys en React Query
- **Impacto:** Medio (evita queries duplicadas)
- **Esfuerzo:** Bajo (2-3 horas)
- **Riesgo:** Bajo
- **Descripción:**
  - Crear helpers centralizados para queryKeys (ej: `queryKeys.ts`)
  - Asegurar que todos los hooks usen los mismos helpers
  - Normalizar parámetros (siempre Number para IDs, siempre string para meses)
- **Cómo verificar:**
  - Verificar que no hay queries duplicadas en React Query DevTools
  - Verificar que cache funciona correctamente

#### 5. ✅ Agregar placeholderData a hooks críticos
- **Impacto:** Medio (mejora UX, evita flashes)
- **Esfuerzo:** Bajo (1 hora)
- **Riesgo:** Bajo
- **Descripción:**
  - Agregar `placeholderData: (previousData) => previousData` a hooks que ya tienen datos
  - Especialmente en `useCalculadoraCostosFinal`, `useDashboardMetrics`
- **Cómo verificar:**
  - Cambiar mes en dashboard
  - Verificar que no hay "flash" de loading, se mantienen datos anteriores

---

### Mejoras de Mediano Plazo (Alto Impacto, Medio Esfuerzo, Medio Riesgo)

#### 6. ⚠️ Optimizar calculadora-costos-final (DB queries)
- **Impacto:** Muy Alto (endpoint más pesado: 3-12s)
- **Esfuerzo:** Medio (4-6 horas)
- **Riesgo:** Medio (cambios en lógica de cálculo)
- **Descripción:**
  - Analizar queries SQL con `EXPLAIN`
  - Optimizar queries lentas (agregar índices si falta)
  - Reducir número de queries (combinar donde sea posible)
  - Cachear resultados intermedios si aplica
- **Cómo verificar:**
  - Medir tiempo antes/después con `?debug=1`
  - Verificar que resultados son idénticos
  - Verificar que tiempo total < 3s

#### 7. ⚠️ Agregar cache HTTP a endpoints pesados
- **Impacto:** Alto (reduce carga en servidor)
- **Esfuerzo:** Medio (2-3 horas)
- **Riesgo:** Bajo
- **Endpoints:**
  - `/api/maintenance/dashboard` (2 min)
  - `/api/admin/catalogs` (5 min)
  - `/api/costos/categorias` (5 min)
- **Cómo verificar:**
  - Hacer request, verificar header `Cache-Control`
  - Hacer segundo request, verificar que es más rápido
  - Verificar que datos se actualizan cuando cambian

#### 8. ⚠️ Migrar useTaskStore a React Query
- **Impacto:** Medio (unifica con resto de la app)
- **Esfuerzo:** Medio (3-4 horas)
- **Riesgo:** Medio (cambios en lógica de estado)
- **Descripción:**
  - Crear hooks `useTasks`, `useTask`, `useCreateTask`, etc.
  - Migrar componentes que usan `useTaskStore`
  - Mantener compatibilidad durante transición
- **Cómo verificar:**
  - Verificar que todas las funcionalidades de tareas siguen funcionando
  - Verificar que no hay requests duplicados

#### 9. ⚠️ Optimizar dashboard/metrics (queries paralelas)
- **Impacto:** Medio (endpoint usado por múltiples componentes)
- **Esfuerzo:** Medio (2-3 horas)
- **Riesgo:** Bajo
- **Descripción:**
  - Ya tiene `Promise.all` para queries paralelas ✅
  - Revisar si hay queries que se pueden combinar
  - Agregar índices si falta
- **Cómo verificar:**
  - Medir tiempo con `?debug=1`
  - Verificar que tiempo DB < 500ms

#### 10. ⚠️ Consolidar fetchHistoricalData en ComprehensiveDashboard
- **Impacto:** Medio (elimina múltiples requests)
- **Esfuerzo:** Medio (2-3 horas)
- **Riesgo:** Bajo
- **Descripción:**
  - Crear hook `useHistoricalData` con React Query
  - Reemplazar fetch directo en `fetchHistoricalData`
  - Usar `queryKey` con array de meses para cachear
- **Cómo verificar:**
  - Cargar datos históricos en dashboard
  - Verificar que solo se hacen requests necesarios
  - Verificar que cache funciona

---

### Mejoras de Largo Plazo (Alto Impacto, Alto Esfuerzo, Alto Riesgo)

#### 11. 🔴 Refactorizar calculadora-costos-final (arquitectura)
- **Impacto:** Muy Alto (endpoint más pesado)
- **Esfuerzo:** Alto (1-2 semanas)
- **Riesgo:** Alto (cambios en lógica de negocio)
- **Descripción:**
  - Separar lógica en funciones más pequeñas
  - Cachear resultados intermedios
  - Considerar background job para cálculos pesados
  - Considerar materialized views en DB
- **Cómo verificar:**
  - Tests exhaustivos
  - Comparar resultados antes/después
  - Medir tiempo (objetivo: <2s)

#### 12. 🔴 Implementar paginación en endpoints grandes
- **Impacto:** Alto (reduce payloads)
- **Esfuerzo:** Alto (1 semana)
- **Riesgo:** Medio (cambios en UI)
- **Endpoints:**
  - `/api/products`
  - `/api/insumos/insumos`
  - `/api/employees`
- **Cómo verificar:**
  - Verificar que UI maneja paginación correctamente
  - Verificar que tiempo de carga mejora

#### 13. 🔴 Implementar GraphQL o tRPC
- **Impacto:** Muy Alto (reduce over-fetching)
- **Esfuerzo:** Muy Alto (2-4 semanas)
- **Riesgo:** Alto (refactor grande)
- **Descripción:**
  - Considerar solo para endpoints críticos
  - Evaluar si el esfuerzo vale la pena
- **Cómo verificar:**
  - Comparar número de requests antes/después
  - Medir tiempo total de carga

#### 14. 🔴 Implementar Service Worker para cache offline
- **Impacto:** Medio (mejora UX)
- **Esfuerzo:** Alto (1 semana)
- **Riesgo:** Medio (complejidad adicional)
- **Descripción:**
  - Cachear datos estáticos
  - Cachear datos de catálogos
- **Cómo verificar:**
  - Verificar que funciona offline
  - Verificar que datos se actualizan correctamente

#### 15. 🔴 Optimizar base de datos (índices, queries)
- **Impacto:** Muy Alto (mejora todos los endpoints)
- **Esfuerzo:** Alto (1 semana)
- **Riesgo:** Medio (requiere análisis profundo)
- **Descripción:**
  - Analizar `EXPLAIN` de queries lentas
  - Agregar índices donde falte
  - Optimizar queries N+1
  - Considerar materialized views
- **Cómo verificar:**
  - Medir tiempos de queries antes/después
  - Verificar que índices se usan correctamente

---

## Priorización por ROI

### Fase 1: Quick Wins (1-2 días)
1. Migrar TaxControlModal a React Query
2. Instrumentar endpoints críticos
3. Migrar PanolPage handlers
4. Normalizar queryKeys
5. Agregar placeholderData

**ROI esperado:** 20-30% mejora en tiempo de carga, bajo riesgo

### Fase 2: Mejoras Mediano Plazo (1 semana)
6. Optimizar calculadora-costos-final (DB)
7. Agregar cache HTTP
8. Migrar useTaskStore
9. Optimizar dashboard/metrics
10. Consolidar fetchHistoricalData

**ROI esperado:** 30-50% mejora adicional, riesgo controlado

### Fase 3: Mejoras Largo Plazo (2-4 semanas)
11. Refactorizar calculadora-costos-final
12. Implementar paginación
13. Evaluar GraphQL/tRPC
14. Service Worker
15. Optimizar base de datos

**ROI esperado:** 50-80% mejora adicional, requiere planificación

---

## Métricas de Éxito

### Antes (Baseline)
- Dashboard: 2-5s
- Costos/Calculadora: 5-15s
- Mantenimiento: 2-4s
- Requests duplicados: ~10-20%
- Endpoints instrumentados: 1/365 (~0.3%)

### Después Fase 1 (Quick Wins)
- Dashboard: 1.5-3s (25-40% mejora)
- Costos/Calculadora: 4-10s (20-33% mejora)
- Mantenimiento: 1.5-3s (25% mejora)
- Requests duplicados: <5%
- Endpoints instrumentados: 6/365 (~1.6%)

### Después Fase 2 (Mediano Plazo)
- Dashboard: <2s (60% mejora)
- Costos/Calculadora: <3s (80% mejora)
- Mantenimiento: <2s (50% mejora)
- Requests duplicados: <2%
- Endpoints instrumentados: 15/365 (~4%)

### Después Fase 3 (Largo Plazo)
- Dashboard: <1s (80% mejora)
- Costos/Calculadora: <2s (87% mejora)
- Mantenimiento: <1s (75% mejora)
- Requests duplicados: 0%
- Endpoints instrumentados: 50+/365 (~14%+)

---

## Checklist de Implementación

### Para cada mejora:
- [ ] Crear branch
- [ ] Implementar cambio
- [ ] Agregar tests si aplica
- [ ] Verificar funcionalidad (cómo verificar específico)
- [ ] Medir performance antes/después
- [ ] Documentar cambios
- [ ] Code review
- [ ] Merge a main

---

## Notas

- **Riesgo:** Bajo = cambios aislados, fácil revertir
- **Riesgo:** Medio = cambios en lógica, requiere testing
- **Riesgo:** Alto = refactor grande, requiere planificación

- **Esfuerzo:** Bajo = <4 horas
- **Esfuerzo:** Medio = 4-8 horas
- **Esfuerzo:** Alto = >1 día

- **Impacto:** Basado en frecuencia de uso y tiempo actual

