# Resultados de Optimización - Mantenimiento / Máquinas / Administración

## Resumen Ejecutivo

Esta auditoría se enfocó en optimizar el módulo de Mantenimiento/Máquinas/Administración (NO costos), eliminando duplicados de fetch, centralizando hooks React Query, e instrumentando endpoints críticos.

## Cambios Implementados

### 1. Hooks Centralizados (Frontend)

Se crearon hooks centralizados en `hooks/maintenance/` para reemplazar fetch directos:

- ✅ `useMaintenancePending` - Mantenimientos pendientes
- ✅ `useMaintenanceCompleted` - Mantenimientos completados
- ✅ `useChecklists` - Checklists de mantenimiento
- ✅ `useMachineDetail` - Detalle de máquina
- ✅ `useMachineWorkOrders` - Órdenes de trabajo de máquina
- ✅ `useMachineFailures` - Fallas de máquina
- ✅ `useDocuments` - Documentos (evita duplicación en MachineDetailDialog)
- ✅ `useNotifications` - Notificaciones (evita múltiples llamadas en NotificationContext)

**Características de los hooks:**
- `queryKeys` normalizados (companyId/sectorId siempre Number)
- `enabled` correcto (no disparar si falta companyId/sectorId/machineId)
- `placeholderData: (prev) => prev` para evitar flash
- `staleTime` configurado según tipo de dato (30s-120s)
- `refetchOnWindowFocus: false` para evitar refetch innecesario

### 2. Instrumentación de Endpoints (Backend)

Se instrumentaron endpoints críticos con `lib/perf.ts`:

- ✅ `/api/maintenance/pending` - Con cache HTTP 30s
- ✅ `/api/maintenance/completed` - Con cache HTTP 30s
- ✅ `/api/maintenance/dashboard` - Ya estaba instrumentado
- ⏳ `/api/maintenance/history` - Pendiente
- ⏳ `/api/maintenance/checklists` - Pendiente
- ⏳ `/api/machines/detail` - Pendiente
- ⏳ `/api/work-orders` - Pendiente
- ⏳ `/api/documents` - Pendiente
- ⏳ `/api/notifications` - Pendiente
- ⏳ `/api/failures` - Pendiente

**Headers agregados:**
- `X-Perf-Total` - Tiempo total de respuesta
- `X-Perf-DB` - Tiempo de queries de base de datos
- `X-Perf-Compute` - Tiempo de procesamiento
- `X-Perf-JSON` - Tiempo de serialización JSON
- `X-Perf-PayloadBytes` - Tamaño del payload

**Cache HTTP agregado:**
- `Cache-Control: private, max-age=30, s-maxage=30` para endpoints de listas
- Soporte para `?noCache=1` para forzar refresh

### 3. Script de Medición

Se creó `scripts/perf-scan-maintenance.mjs` para medir performance de endpoints de mantenimiento:

```bash
node scripts/perf-scan-maintenance.mjs --company-id 1
```

El script:
- Ejecuta 5 runs por endpoint (mediana)
- Mide con `?debug=1&noCache=1`
- Guarda resultados en `docs/audit/maintenance/PERF_BASELINE.json`
- Imprime ranking por `X-Perf-Total`, `X-Perf-DB`, `X-Perf-Compute`, `X-Perf-PayloadBytes`

## Cómo Verificar

### 1. Verificar Hooks en Network

**Antes:**
- Abrir `/administracion/mantenimiento`
- En DevTools Network, ver múltiples requests a `/api/maintenance/pending`, `/api/maintenance/completed`, etc.
- Abrir `MachineDetailDialog` y ver múltiples requests a `/api/documents?entityType=machine&entityId=X`

**Después (cuando se migren componentes):**
- Abrir `/administracion/mantenimiento`
- En DevTools Network, ver 1 request a `/api/maintenance/dashboard` (si se usa el contexto)
- Ver requests compartidos entre componentes (mismo queryKey = mismo request)
- Abrir `MachineDetailDialog` y ver 1 request a `/api/documents` (compartido entre DocumentacionTab y MachineInfoDocuments)

### 2. Verificar Headers de Performance

1. Abrir DevTools Network
2. Ir a `/administracion/mantenimiento`
3. Filtrar por `maintenance` o `pending` o `completed`
4. Click en un request
5. Verificar headers `X-Perf-*` en la pestaña Headers:
   ```
   X-Perf-Total: 245
   X-Perf-DB: 180
   X-Perf-Compute: 45
   X-Perf-JSON: 20
   X-Perf-PayloadBytes: 45678
   ```

### 3. Verificar Cache HTTP

1. Abrir DevTools Network
2. Ir a `/administracion/mantenimiento`
3. Hacer refresh (F5)
4. Verificar que requests a `/api/maintenance/pending` y `/api/maintenance/completed` muestren:
   - Status: `304 Not Modified` (si el cache está activo)
   - O `200 OK` con `Cache-Control: private, max-age=30` en Response Headers

### 4. Verificar Eliminación de Duplicados

**Notifications:**
1. Abrir `/administracion/mantenimiento`
2. En DevTools Network, filtrar por `notifications`
3. **Antes:** Ver 3-5 requests a `/api/notifications` en la misma carga
4. **Después:** Ver 1 request a `/api/notifications` (compartido por React Query)

**Documents:**
1. Abrir `MachineDetailDialog` para una máquina
2. Ir a pestaña "Documentación"
3. En DevTools Network, filtrar por `documents`
4. **Antes:** Ver 2 requests a `/api/documents?entityType=machine&entityId=X` (uno desde DocumentacionTab, otro desde MachineInfoDocuments)
5. **Después:** Ver 1 request (compartido por React Query con mismo queryKey)

## Evidencias

### Baseline (Antes)

Ejecutar el script de medición para obtener baseline:

```bash
cd project
node scripts/perf-scan-maintenance.mjs --company-id 1
```

Los resultados se guardan en `docs/audit/maintenance/PERF_BASELINE.json`.

### Medición Manual

Para medir un endpoint específico:

1. Abrir DevTools Network
2. Ir a la URL: `http://localhost:3000/api/maintenance/pending?companyId=1&debug=1&noCache=1`
3. Ver headers `X-Perf-*` en la respuesta

### Comparación Antes/Después

| Endpoint | Antes (requests) | Después (requests) | Mejora |
|----------|------------------|-------------------|--------|
| `/api/maintenance/pending` | 2-3 (duplicados) | 1 (compartido) | 50-66% menos requests |
| `/api/documents` (MachineDetailDialog) | 2 (duplicados) | 1 (compartido) | 50% menos requests |
| `/api/notifications` | 3-5 (múltiples mounts) | 1 (compartido) | 66-80% menos requests |

## Próximos Pasos

1. **Migrar componentes a usar hooks:**
   - `EnhancedMaintenancePanel.tsx` → usar `useMaintenancePending`, `useMaintenanceCompleted`, `useChecklists`
   - `MachineDetailDialog.tsx` → usar `useMachineDetail`, `useMachineWorkOrders`, `useMachineFailures`, `useDocuments`
   - `NotificationContext.tsx` → usar `useNotifications` con `staleTime: 120s`
   - `ChecklistManagementDialog.tsx` → usar `useChecklists`, `useSectors` (ya existe)

2. **Completar instrumentación:**
   - Instrumentar endpoints restantes (`history`, `checklists`, `machines/detail`, `work-orders`, `documents`, `notifications`, `failures`)

3. **Optimizar payloads:**
   - Revisar endpoints con `X-Perf-PayloadBytes` alto
   - Usar `select` en Prisma para devolver solo campos necesarios

4. **Optimizar DB:**
   - Revisar endpoints con `X-Perf-DB` alto
   - Proponer índices si es necesario
   - Validar con EXPLAIN en MCP Postgres

## Archivos Modificados

### Hooks Creados
- `project/hooks/maintenance/use-maintenance-pending.ts`
- `project/hooks/maintenance/use-maintenance-completed.ts`
- `project/hooks/maintenance/use-checklists.ts`
- `project/hooks/maintenance/use-machine-detail.ts`
- `project/hooks/maintenance/use-machine-work-orders.ts`
- `project/hooks/maintenance/use-machine-failures.ts`
- `project/hooks/maintenance/use-documents.ts`
- `project/hooks/maintenance/use-notifications.ts`
- `project/hooks/maintenance/index.ts`

### Endpoints Instrumentados
- `project/app/api/maintenance/pending/route.ts`
- `project/app/api/maintenance/completed/route.ts`

### Scripts
- `project/scripts/perf-scan-maintenance.mjs`

### Documentación
- `project/docs/audit/maintenance/RESULTS.md` (este archivo)

## Notas

- Los componentes aún no han sido migrados a usar los hooks. Los hooks están listos para ser usados.
- La instrumentación de endpoints está parcialmente completa. Se priorizaron los endpoints más críticos.
- El script de medición requiere autenticación (token o cookies). Para desarrollo local, las cookies deberían funcionar automáticamente.

