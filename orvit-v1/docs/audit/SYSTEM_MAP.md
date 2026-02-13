# Mapa del Sistema - Auditoría de Performance

**Fecha:** 2025-01-27  
**Versión:** 1.0

## Resumen Ejecutivo

Este documento mapea la arquitectura del sistema ORVIT, identificando módulos principales, páginas, endpoints y sus relaciones para facilitar la auditoría de performance.

---

## 1. Módulos Principales

### 1.1 Administración (`/app/administracion/`)
- **Dashboard** (`/dashboard`) - Métricas generales, KPIs
- **Costos** (`/costos`) - Gestión de costos, calculadora, historial
- **Ventas** (`/ventas`) - Clientes, productos, ventas mensuales
- **Compras** (`/compras`) - Proveedores, comprobantes, solicitudes
- **Tareas** (`/tareas`) - Gestión de tareas y fixed tasks
- **Usuarios** (`/usuarios`) - Gestión de usuarios y permisos
- **Configuración** (`/configuracion`) - Configuración general, distribución de costos
- **Controles** (`/controles`) - Control de impuestos
- **Agenda** (`/agenda`) - Agenda personal
- **Permisos** (`/permisos`) - Gestión de permisos
- **Auditoría** (`/auditoria`) - Logs y auditoría
- **Cargas** (`/cargas`) - Gestión de cargas

### 1.2 Mantenimiento (`/app/mantenimiento/`)
- **Máquinas** (`/maquinas`) - Gestión de máquinas
- **Órdenes** (`/ordenes`) - Órdenes de trabajo
- **Configuración** (`/configuracion`) - Configuración de mantenimiento
- **Reportes** (`/reportes`) - Reportes de mantenimiento
- **Puestos de Trabajo** (`/puestos-trabajo`) - Gestión de puestos
- **Unidades Móviles** (`/unidades-moviles`) - Gestión de unidades móviles

### 1.3 Otros Módulos
- **Panol** (`/app/panol`) - Gestión de herramientas
- **Áreas** (`/app/areas`) - Gestión de áreas
- **Sectores** (`/app/sectores`) - Gestión de sectores
- **Empresas** (`/app/empresas`) - Gestión de empresas
- **Máquinas** (`/app/maquinas`) - Vista de máquinas

---

## 2. Mapa de Endpoints por Módulo

### 2.1 Dashboard (`/api/dashboard/`)
| Endpoint | Método | Consumidor Principal | Payload Est. |
|----------|--------|---------------------|--------------|
| `/api/dashboard/metrics` | GET | `ComprehensiveDashboard`, `useDashboardMetrics` | ~50KB |
| `/api/dashboard/top-products` | GET | `useDashboardTopProducts` | ~20KB |
| `/api/dashboard/production-summary` | GET | `useDashboardProductionSummary` | ~15KB |
| `/api/dashboard/available-months` | GET | `MonthSelector` | ~2KB |

**Observaciones:**
- `metrics` es el endpoint más pesado (múltiples queries DB, cálculos)
- Usado por múltiples componentes simultáneamente
- Cache de 30 segundos implementado

### 2.2 Costos (`/api/costos/`, `/api/calculadora-*`)
| Endpoint | Método | Consumidor Principal | Payload Est. |
|----------|--------|---------------------|--------------|
| `/api/calculadora-costos-final` | GET | `useCalculadoraCostosFinal`, `CalculadoraCostosEmbedded` | ~200-500KB |
| `/api/costos/categorias` | GET | `useCostosCategorias` | ~10KB |
| `/api/costos/historial` | GET | `useCostosHistorial` | ~50-100KB |
| `/api/costos/stats` | GET | `useCostosStats` | ~20KB |

**Observaciones:**
- `calculadora-costos-final` es el endpoint MÁS PESADO del sistema
- Tiempo de respuesta: 3-12 segundos
- Múltiples queries SQL complejas, loops, transformaciones
- Instrumentado con `lib/perf.ts`

### 2.3 Mantenimiento (`/api/maintenance/`)
| Endpoint | Método | Consumidor Principal | Payload Est. |
|----------|--------|---------------------|--------------|
| `/api/maintenance/dashboard` | GET | `useMaintenanceDashboard` | ~100-200KB |
| `/api/maintenance/[id]/stats` | GET | `EnhancedMaintenancePanel` | ~30KB |
| `/api/maintenance/preventive/[id]` | GET | `MaintenanceDetailDialog` | ~50KB |
| `/api/maintenance/execute` | POST | `ChecklistExecutionDialog` | ~5KB |

**Observaciones:**
- `dashboard` consolida múltiples datos (antes 8-10 requests)
- Implementa deduplicación global
- Cache TTL de 2 minutos

### 2.4 Core/Bootstrap (`/api/core/`)
| Endpoint | Método | Consumidor Principal | Payload Est. |
|----------|--------|---------------------|--------------|
| `/api/core/bootstrap` | GET | `useCoreBootstrap` | ~30KB |

**Observaciones:**
- Endpoint agregador crítico
- Reemplaza 5-10 requests individuales
- Carga: user, companies, areas, sectors, permissions, notifications
- Usado en inicialización de la app

### 2.5 Tareas (`/api/tasks/`)
| Endpoint | Método | Consumidor Principal | Payload Est. |
|----------|--------|---------------------|--------------|
| `/api/tasks` | GET | `useTaskStore` (Zustand) | ~50KB |
| `/api/tasks/[id]` | GET | `TaskDetailModal` | ~10KB |
| `/api/tasks/check-overdue` | GET | `NotificationContext` | ~5KB |

**Observaciones:**
- `useTaskStore` usa fetch directo (NO React Query)
- Posible duplicación si múltiples componentes usan el store

### 2.6 Herramientas/Panol (`/api/tools/`, `/api/tool-requests/`)
| Endpoint | Método | Consumidor Principal | Payload Est. |
|----------|--------|---------------------|--------------|
| `/api/tools` | GET | `useToolsDashboard` | ~50KB |
| `/api/tool-requests` | GET | `PanolPage` | ~30KB |
| `/api/tool-requests/[id]/approve` | POST | `PanolPage` (fetch directo) | ~2KB |

**Observaciones:**
- `PanolPage` tiene múltiples fetch directos (no React Query)
- Posible duplicación en `handleApproveRequest`, `handleRejectRequest`

### 2.7 Impuestos (`/api/tax-*`)
| Endpoint | Método | Consumidor Principal | Payload Est. |
|----------|--------|---------------------|--------------|
| `/api/tax-base` | GET | `TaxControlModal` (fetch directo) | ~10KB |
| `/api/tax-record` | GET | `TaxControlModal` (fetch directo) | ~30KB |
| `/api/tax-alerts/check` | GET | `TaxControlModal` (fetch directo) | ~5KB |

**Observaciones:**
- **CRÍTICO:** `TaxControlModal` usa fetch directo en lugar de React Query
- 3 endpoints llamados en `useEffect` sin deduplicación
- Sin cache, sin staleTime

### 2.8 Otros Endpoints Críticos
| Endpoint | Método | Consumidor Principal | Payload Est. |
|----------|--------|---------------------|--------------|
| `/api/products` | GET | `useProductos` | ~50KB |
| `/api/insumos/insumos` | GET | `useInsumos` | ~40KB |
| `/api/employees` | GET | `useEmployeeCosts` | ~30KB |
| `/api/indirect-costs` | GET | `useIndirectCosts` | ~50KB |

---

## 3. Flujo de Datos Principal

### 3.1 Inicialización de la App
```
1. Usuario inicia sesión
2. useCoreBootstrap() → /api/core/bootstrap
   - Carga: user, companies, areas, sectors, permissions, notifications
3. Usuario selecciona empresa
4. Carga de datos específicos de la empresa:
   - useDashboardMetrics() → /api/dashboard/metrics
   - useMaintenanceDashboard() → /api/maintenance/dashboard
   - useCalculadoraCostosFinal() → /api/calculadora-costos-final (si está en costos)
```

### 3.2 Dashboard Principal
```
ComprehensiveDashboard:
  - useDashboardMetrics() → /api/dashboard/metrics
  - useDashboardTopProducts() → /api/dashboard/top-products
  - useDashboardProductionSummary() → /api/dashboard/production-summary
  - useCalculadoraCostosFinal() → /api/calculadora-costos-final
  - useAdminCatalogs() → /api/admin/catalogs
```

### 3.3 Página de Costos
```
CalculadoraCostosPage:
  - useCalculadoraCostosFinal() (sales) → /api/calculadora-costos-final?distributionMethod=sales
  - useCalculadoraCostosFinal() (production) → /api/calculadora-costos-final?distributionMethod=production
  - fetch() directo → /api/dashboard/available-months
```

---

## 4. Puntos de Duplicación Identificados

### 4.1 Fetch Directo vs React Query
- ❌ `TaxControlModal`: 3 fetch directos sin cache
- ❌ `PanolPage`: fetch directos en handlers
- ❌ `useTaskStore`: fetch directo (Zustand, no React Query)
- ❌ `ComprehensiveDashboard`: fetch directo para `fetchHistoricalData`

### 4.2 Múltiples Hooks con Mismos Params
- ⚠️ `useCalculadoraCostosFinal` puede ser llamado 2 veces (sales + production) en la misma página
- ⚠️ `useDashboardMetrics` puede ser llamado desde múltiples componentes

### 4.3 Endpoints Sin Instrumentación
- ❌ `/api/tax-base` - Sin instrumentación
- ❌ `/api/tax-record` - Sin instrumentación
- ❌ `/api/tax-alerts/check` - Sin instrumentación
- ❌ `/api/tool-requests/[id]/approve` - Sin instrumentación
- ❌ `/api/tasks` - Sin instrumentación

---

## 5. Arquitectura de Cache

### 5.1 React Query (Frontend)
- **QueryClientProvider**: Configurado en `app/layout.tsx`
- **staleTime**: 5 minutos (default)
- **gcTime**: 30 minutos (default)
- **refetchOnWindowFocus**: false
- **refetchOnMount**: false

### 5.2 Cache Global (Frontend)
- `useGlobalCache`: Implementado en `hooks/use-global-cache.ts`
- Usado por `useMaintenanceDashboard`
- TTL configurable por hook

### 5.3 Cache HTTP (Backend)
- Solo `/api/dashboard/metrics` tiene `Cache-Control: max-age=30`
- Resto de endpoints: `force-dynamic` (sin cache)

---

## 6. Dependencias Críticas

### 6.1 Base de Datos
- **Prisma ORM**: Todas las queries
- **PostgreSQL**: Base de datos principal
- **Tablas grandes identificadas**:
  - `monthly_sales` (ventas mensuales)
  - `monthly_production` (producción mensual)
  - `ChecklistExecution` (ejecuciones de checklist)
  - `Maintenance` (mantenimientos)

### 6.2 Frontend
- **React Query**: Gestión de estado del servidor
- **Zustand**: `useTaskStore` (tareas)
- **Context API**: Auth, Company, Notification, Navigation

---

## 7. Notas de Performance

### 7.1 Endpoints Más Pesados (estimado)
1. `/api/calculadora-costos-final` - 3-12s, ~200-500KB
2. `/api/maintenance/dashboard` - 1-3s, ~100-200KB
3. `/api/dashboard/metrics` - 500ms-2s, ~50KB
4. `/api/costos/historial` - 500ms-1s, ~50-100KB

### 7.2 Endpoints Más Llamados
1. `/api/core/bootstrap` - 1 vez al inicio
2. `/api/dashboard/metrics` - Múltiples componentes
3. `/api/maintenance/dashboard` - Múltiples componentes de mantenimiento
4. `/api/calculadora-costos-final` - 2 veces en página de costos (sales + production)

---

## 8. Próximos Pasos

Ver `OPTIMIZATION_PLAN.md` para mejoras priorizadas.

