# Inventario de Endpoints - Auditoría de Performance

**Fecha:** 2025-01-27  
**Versión:** 1.0

## Resumen

Este documento lista todos los endpoints de la API (`app/api/**/route.ts`), sus parámetros, tamaño aproximado de payload, y consumidores principales.

---

## Endpoints por Categoría

### Dashboard

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/dashboard/metrics` | GET | `companyId`, `month?` | ~50KB | `useDashboardMetrics`, `ComprehensiveDashboard` | ❌ |
| `/api/dashboard/top-products` | GET | `companyId`, `month?`, `limit?` | ~20KB | `useDashboardTopProducts` | ❌ |
| `/api/dashboard/production-summary` | GET | `companyId`, `month?` | ~15KB | `useDashboardProductionSummary` | ❌ |
| `/api/dashboard/available-months` | GET | `companyId` | ~2KB | `CalculadoraCostosPage` (fetch directo) | ❌ |

**Observaciones:**
- `metrics` es el más pesado (múltiples queries DB)
- Cache HTTP de 30s solo en `metrics`
- Resto sin instrumentación

---

### Costos y Calculadora

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/calculadora-costos-final` | GET | `companyId`, `productionMonth?`, `distributionMethod?` | ~200-500KB | `useCalculadoraCostosFinal` | ✅ |
| `/api/costos/categorias` | GET | `companyId` | ~10KB | `useCostosCategorias` | ❌ |
| `/api/costos/historial` | GET | `companyId`, `employeeId?` | ~50-100KB | `useCostosHistorial` | ❌ |
| `/api/costos/stats` | GET | `companyId` | ~20KB | `useCostosStats` | ❌ |
| `/api/price-comparisons` | GET | `companyId` | ~30KB | `usePriceComparisons` | ❌ |

**Observaciones:**
- `calculadora-costos-final` es el endpoint MÁS PESADO del sistema
- Tiempo de respuesta: 3-12 segundos
- Instrumentado con `lib/perf.ts`
- Múltiples queries SQL complejas

---

### Mantenimiento

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/maintenance/dashboard` | GET | `companyId`, `sectorId?`, `pageSize?` | ~100-200KB | `useMaintenanceDashboard` | ❌ |
| `/api/maintenance/[id]/stats` | GET | `id` | ~30KB | `EnhancedMaintenancePanel` | ❌ |
| `/api/maintenance/preventive/[id]` | GET | `id` | ~50KB | `MaintenanceDetailDialog` | ❌ |
| `/api/maintenance/execute` | POST | Body complejo | ~5KB | `ChecklistExecutionDialog` | ❌ |
| `/api/maintenance/completed` | GET | `companyId`, `sectorId?` | ~50KB | Varios | ❌ |
| `/api/maintenance/by-id` | GET | `id` | ~30KB | Varios | ❌ |
| `/api/maintenance/duplicate` | POST | `id` | ~5KB | Varios | ❌ |
| `/api/maintenance/manual-completion` | POST | Body | ~5KB | `ManualServiceCompletionDialog` | ❌ |
| `/api/maintenance/unidad-movil/[unidadId]` | GET | `unidadId` | ~30KB | Varios | ❌ |
| `/api/maintenance/preventive/[id]/complete` | POST | `id`, Body | ~5KB | Varios | ❌ |
| `/api/maintenance/preventive/[id]/instructives` | GET | `id` | ~20KB | Varios | ❌ |

**Observaciones:**
- `dashboard` consolida múltiples datos (optimización previa)
- Muchos endpoints sin instrumentación
- `execute` es crítico (POST con validaciones complejas)

---

### Core y Bootstrap

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/core/bootstrap` | GET | Ninguno (usa token) | ~30KB | `useCoreBootstrap` | ❌ |

**Observaciones:**
- Endpoint agregador crítico
- Reemplaza 5-10 requests individuales
- Sin instrumentación (debería tenerla)

---

### Tareas

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/tasks` | GET | Query params (filtros) | ~50KB | `useTaskStore` (Zustand) | ❌ |
| `/api/tasks/[id]` | GET | `id` | ~10KB | `TaskDetailModal` | ❌ |
| `/api/tasks/check-overdue` | GET | Ninguno | ~5KB | `NotificationContext` | ❌ |
| `/api/fixed-tasks` | GET | `companyId?` | ~30KB | `useFixedTasks` | ❌ |
| `/api/fixed-tasks/[id]` | GET/PUT/DELETE | `id` | ~10KB | Varios | ❌ |
| `/api/fixed-tasks/auto-reset` | POST | Ninguno | ~2KB | Cron/Admin | ❌ |

**Observaciones:**
- `tasks` usa Zustand (fetch directo, no React Query)
- Sin instrumentación
- `check-overdue` se llama periódicamente

---

### Herramientas y Panol

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/tools` | GET | `companyId?`, `itemType?` | ~50KB | `useToolsDashboard` | ❌ |
| `/api/tools/[id]` | GET/PUT/DELETE | `id` | ~20KB | Varios | ❌ |
| `/api/tools/categories` | GET | `companyId?` | ~10KB | Varios | ❌ |
| `/api/tools/suppliers` | GET | `companyId?` | ~10KB | Varios | ❌ |
| `/api/tools/loans` | GET | `companyId?` | ~30KB | Varios | ❌ |
| `/api/tools/movements` | GET | `companyId?` | ~30KB | Varios | ❌ |
| `/api/tools/restock` | POST | Body | ~5KB | Varios | ❌ |
| `/api/tools/use-stock` | POST | Body | ~5KB | Varios | ❌ |
| `/api/tool-requests` | GET | `companyId?` | ~30KB | `PanolPage` (fetch directo) | ❌ |
| `/api/tool-requests/[id]/approve` | POST/PUT | `id`, Body | ~2KB | `PanolPage` (fetch directo) | ❌ |

**Observaciones:**
- `PanolPage` usa fetch directo (no React Query)
- Sin instrumentación
- Múltiples endpoints relacionados

---

### Impuestos

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/tax-base` | GET | `companyId` | ~10KB | `TaxControlModal` (fetch directo) | ❌ |
| `/api/tax-record` | GET | `companyId`, `month`, `status?` | ~30KB | `TaxControlModal` (fetch directo) | ❌ |
| `/api/tax-alerts/check` | GET | `companyId` | ~5KB | `TaxControlModal` (fetch directo) | ❌ |
| `/api/tax-control` | GET/POST | Varios | ~20KB | Varios | ❌ |

**Observaciones:**
- **CRÍTICO:** `TaxControlModal` usa fetch directo sin cache
- 3 endpoints llamados en `useEffect` sin deduplicación
- Sin instrumentación

---

### Productos e Insumos

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/products` | GET | `companyId?` | ~50KB | `useProductos` | ❌ |
| `/api/products/search` | GET | `companyId`, `q` | ~20KB | Varios | ❌ |
| `/api/products/bulk-upload` | POST | FormData | Variable | Varios | ❌ |
| `/api/product-categories` | GET | `companyId?` | ~10KB | Varios | ❌ |
| `/api/product-prices` | GET | `companyId?` | ~30KB | Varios | ❌ |
| `/api/insumos/insumos` | GET | `companyId?` | ~40KB | `useInsumos` | ❌ |
| `/api/insumos/precios` | GET | `companyId?` | ~30KB | Varios | ❌ |
| `/api/insumos/historial` | GET | `companyId?` | ~50KB | Varios | ❌ |
| `/api/insumos/estadisticas` | GET | `companyId?` | ~20KB | Varios | ❌ |
| `/api/inputs` | GET | `companyId?` | ~40KB | Varios | ❌ |
| `/api/inputs/[id]` | GET | `id` | ~20KB | Varios | ❌ |
| `/api/inputs/history` | GET | `companyId?` | ~50KB | Varios | ❌ |

**Observaciones:**
- Muchos endpoints sin instrumentación
- Algunos con bulk upload (payload variable)

---

### Empleados

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/employees` | GET | `companyId?` | ~30KB | `useEmployeeCosts` | ❌ |
| `/api/employees/categories` | GET | `companyId?` | ~10KB | `useEmployeeCategories` | ❌ |
| `/api/employees/[id]/comp-history` | GET | `id` | ~20KB | Varios | ❌ |
| `/api/employees/salaries/[id]` | GET | `id` | ~20KB | Varios | ❌ |
| `/api/employees/import` | POST | FormData | Variable | Varios | ❌ |
| `/api/employees/upload-salary` | POST | FormData | Variable | Varios | ❌ |
| `/api/employees/upload-payroll` | POST | FormData | Variable | Varios | ❌ |
| `/api/employees/export-salaries` | GET | `companyId?` | Variable | Varios | ❌ |

**Observaciones:**
- Varios endpoints de import/export (payload variable)
- Sin instrumentación

---

### Costos Indirectos

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/indirect-costs` | GET | `companyId?` | ~50KB | `useIndirectCosts` | ❌ |
| `/api/indirect-items` | GET | `companyId?` | ~40KB | Varios | ❌ |
| `/api/indirect-items/[id]/history` | GET | `id` | ~30KB | Varios | ❌ |
| `/api/employee-cost-distribution` | GET | `companyId?` | ~30KB | Varios | ❌ |
| `/api/employee-distribution` | GET | `companyId?` | ~30KB | Varios | ❌ |
| `/api/employee-distribution/[id]` | GET | `id` | ~20KB | Varios | ❌ |

**Observaciones:**
- Sin instrumentación
- Endpoints relacionados con distribución de costos

---

### Ventas y Producción

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/sales/monthly/bulk-upload` | POST | FormData | Variable | Varios | ❌ |
| `/api/production/monthly/bulk-upload` | POST | FormData | Variable | Varios | ❌ |
| `/api/production/import` | POST | FormData | Variable | Varios | ❌ |
| `/api/registros-mensuales` | GET | `companyId?`, `month?` | ~50KB | `useRegistrosMensuales` | ❌ |

**Observaciones:**
- Bulk upload endpoints (payload variable)
- Sin instrumentación

---

### Clientes y Proveedores

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/clients` | GET | `companyId?` | ~30KB | Varios | ❌ |
| `/api/clients/[id]` | GET/PUT/DELETE | `id` | ~20KB | Varios | ❌ |
| `/api/compras/proveedores` | GET | `companyId?` | ~40KB | Varios | ❌ |
| `/api/compras/comprobantes` | GET | `companyId?` | ~50KB | Varios | ❌ |
| `/api/compras/solicitudes` | GET | `companyId?` | ~30KB | Varios | ❌ |

**Observaciones:**
- Sin instrumentación
- Endpoints de gestión de clientes y proveedores

---

### Máquinas y Sectores

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/maquinas` | GET | `companyId?` | ~50KB | `useMachinesInitial` | ❌ |
| `/api/maquinas/[id]` | GET | `id` | ~30KB | `useMachineDetail` | ❌ |
| `/api/machines/[id]/history` | GET | `id` | ~50KB | Varios | ❌ |
| `/api/machines/[id]/components` | GET | `id` | ~30KB | Varios | ❌ |
| `/api/machines/[id]/tools` | GET | `id` | ~20KB | Varios | ❌ |
| `/api/areas` | GET | `companyId?` | ~10KB | Varios | ❌ |
| `/api/sectores` | GET | `companyId?` | ~20KB | `useSectors` | ❌ |
| `/api/sectores/[id]/tools` | GET | `id` | ~20KB | Varios | ❌ |

**Observaciones:**
- Sin instrumentación
- Endpoints de gestión de máquinas y sectores

---

### Órdenes de Trabajo

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/work-orders` | GET | `companyId?` | ~50KB | `useWorkOrdersDashboard` | ❌ |
| `/api/work-orders/[id]` | GET | `id` | ~50KB | `useWorkOrderDetail` | ❌ |
| `/api/work-orders/[id]/comments` | GET/POST | `id` | ~10KB | Varios | ❌ |

**Observaciones:**
- Sin instrumentación
- Endpoints de gestión de órdenes de trabajo

---

### Usuarios y Permisos

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/users` | GET | Ninguno | ~20KB | `useUsers` | ❌ |
| `/api/users/[id]` | GET | `id` | ~10KB | Varios | ❌ |
| `/api/users/activity` | GET/POST | `userId?` | ~10KB | Varios | ❌ |
| `/api/admin/stats` | GET | Ninguno | ~50KB | Varios | ❌ |
| `/api/admin/catalogs` | GET | `companyId?` | ~100KB | `useAdminCatalogs` | ❌ |
| `/api/admin/permissions` | GET | `companyId?` | ~20KB | Varios | ❌ |

**Observaciones:**
- `admin/catalogs` es pesado (consolida múltiples catálogos)
- Sin instrumentación

---

### Notificaciones

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/notifications/stats` | GET | Ninguno | ~5KB | Varios | ❌ |
| `/api/notifications/stock-check` | GET | `companyId?` | ~5KB | Cron | ❌ |
| `/api/notifications/daily-overdue-check` | GET | Ninguno | ~5KB | Cron | ❌ |

**Observaciones:**
- Endpoints de cron/background jobs
- Sin instrumentación

---

### Plant/Planta

| Endpoint | Método | Params | Payload Est. | Consumidor | Instrumentado |
|----------|--------|--------|--------------|------------|---------------|
| `/api/plant/stop` | POST | Body | ~5KB | `PlantStopDialog` | ❌ |
| `/api/plant/resume` | POST | Body | ~5KB | `PlantResumeDialog` | ❌ |
| `/api/plant/tool-requests` | GET | `companyId?` | ~30KB | Varios | ❌ |
| `/api/plant/tool-requests/by-stop/[stopId]` | GET | `stopId` | ~20KB | Varios | ❌ |

**Observaciones:**
- Sin instrumentación
- Endpoints de gestión de planta

---

## Resumen de Instrumentación

### ✅ Instrumentados (con `lib/perf.ts`)
- `/api/calculadora-costos-final` ✅

### ❌ Sin Instrumentar (críticos)
- `/api/core/bootstrap` ❌
- `/api/dashboard/metrics` ❌
- `/api/maintenance/dashboard` ❌
- `/api/maintenance/execute` ❌
- `/api/costos/historial` ❌
- `/api/costos/categorias` ❌
- `/api/tax-base` ❌
- `/api/tax-record` ❌
- `/api/tax-alerts/check` ❌
- `/api/tool-requests/[id]/approve` ❌
- `/api/tasks` ❌

**Total:** ~365 endpoints, solo 1 instrumentado (~0.3%)

---

## Endpoints Más Pesados (estimado)

1. `/api/calculadora-costos-final` - 3-12s, ~200-500KB
2. `/api/maintenance/dashboard` - 1-3s, ~100-200KB
3. `/api/admin/catalogs` - 1-2s, ~100KB
4. `/api/dashboard/metrics` - 500ms-2s, ~50KB
5. `/api/costos/historial` - 500ms-1s, ~50-100KB
6. `/api/work-orders/[id]` - 500ms-1s, ~50KB
7. `/api/machines/[id]/history` - 500ms-1s, ~50KB

---

## Próximos Pasos

Ver `OPTIMIZATION_PLAN.md` para mejoras priorizadas.

