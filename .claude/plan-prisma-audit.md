# Auditoría y Optimización del Schema Prisma - Plan de Implementación

## Resumen Ejecutivo

**Schema:** `project/prisma/schema.prisma` (~15,000 líneas, 544KB)
**Modelos totales:** ~290 | **Índices existentes:** ~1,008 `@@index` + ~85 `@@unique`
**Anti-patterns detectados:** 127+ en 10 API routes críticas
**Modelos SIN índices:** 17 prioritarios identificados

---

## FASE 1 - ÍNDICES COMPUESTOS (Migration)

### Paso 1.1: Índices para modelos SIN ningún índice

**Archivo:** `schema.prisma` - Agregar `@@index` a 12 modelos que carecen de ellos.

#### Batch A: Modelos de alta volumetría

```prisma
// Tool (línea ~1264, antes de @@map("Tool"))
@@index([companyId])
@@index([companyId, status])
@@index([companyId, sectorId])
@@index([companyId, sectorId, status])

// Task (línea ~1897, antes de @@map("Task"))
@@index([companyId, status])
@@index([companyId, assignedToId, status])
@@index([companyId, dueDate])
@@index([assignedToId])

// Subtask (línea ~1924, antes de @@map("Subtask"))
@@index([taskId])

// Worker (línea ~1504, antes de cierre del model)
@@index([companyId])
@@index([companyId, isActive])

// Contact (línea ~2117, antes de cierre del model)
@@index([userId])
@@index([userId, isActive])

// ContactInteraction (línea ~2155, antes de cierre del model)
@@index([contactId])
@@index([userId])
@@index([contactId, date])
```

#### Batch B: Modelos de costos/producción

```prisma
// CostProduct (línea ~2537, antes de @@map("CostProduct"))
@@index([companyId])
@@index([companyId, active])
@@index([lineId])

// CostEmployee (línea ~2603, antes de cierre del model)
@@index([companyId])
@@index([companyId, active])

// MonthlyProduction (línea ~2792, antes de cierre del model)
// Ya tiene @@unique([productId, month]) - solo agregar:
@@index([companyId])
@@index([companyId, month])

// maintenance_history (línea ~5282, antes de cierre del model)
@@index([workOrderId])
@@index([machineId])
@@index([executedAt])
@@index([machineId, executedAt])
```

#### Batch C: Modelos de configuración (menor prioridad)

```prisma
// Area (línea ~749, antes de cierre del model)
@@index([companyId])

// Sector (línea ~807, antes de cierre del model)
@@index([companyId])
@@index([areaId])

// maintenance_configs - ya tiene @@unique([companyId, sectorId])
// Solo agregar:
@@index([companyId])
```

**Total: 28 índices nuevos en 12 modelos**

---

### Paso 1.2: Índices compuestos para modelos con alto tráfico (ya tienen índices simples)

Estos modelos ya tienen índices simples pero les faltan compuestos optimizados para queries frecuentes.

```prisma
// Sale (línea ~9120) - Agregar:
@@index([companyId, estado, createdAt])              // Listado paginado por estado

// SalesInvoice (línea ~9501) - Ya tiene buenos compuestos
// Solo agregar:
@@index([companyId, estado, fechaVencimiento])       // Aging analysis optimizado

// SaleDelivery (línea ~9223) - Agregar:
@@index([companyId, estado, createdAt])              // Dashboard entregas
@@index([companyId, fechaProgramada, fechaEntrega])  // On-time rate

// FailureOccurrence (línea ~1780) - Agregar:
@@index([companyId, status])                         // Ya tiene solo status
@@index([companyId, machineId, reportedAt])          // Stats por máquina

// EmployeeSalaryHistory (línea ~3213) - Agregar:
@@index([company_id, employee_id, effective_from])   // Historial con window functions

// SupplierAccountMovement (línea ~3652) - Agregar:
@@index([supplierId, tipo, fechaVencimiento])        // Aging proveedor
@@index([companyId, supplierId, fecha])              // Cuenta corriente

// ProductionOrder (línea ~13270) - Agregar:
@@index([companyId, status, actualEndDate])          // Completados
@@index([companyId, workCenterId, status])           // Por centro trabajo

// DailyProductionReport (línea ~13347) - Agregar:
@@index([companyId, date, workCenterId])             // Dashboard producción

// ProductionDowntime (línea ~13418) - Agregar:
@@index([companyId, reasonCodeId, startTime])        // Pareto por motivo
```

**Total: 13 índices compuestos nuevos en 9 modelos**

---

## FASE 2 - CORRECCIÓN DE ANTI-PATTERNS (API Routes)

### Prioridad CRÍTICA (Semana 1)

#### Fix 2.1: Maintenance Checklists - N+1 masivo (250+ queries → 2)
**Archivo:** `app/api/maintenance/checklists/route.ts` (líneas 230-340)
**Problema:** Loop async con 1-2 queries por checklist para filtrar por sector
**Fix:** Batch fetch de documentos + machines, filtrar en memoria
```typescript
// ANTES: 250+ queries (async map con queries por checklist)
// DESPUÉS: 2 batch queries + filtrado in-memory
const [maintenanceDocs, machines] = await Promise.all([
  prisma.document.findMany({
    where: { id: { in: allMaintenanceIds }, entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE' }
  }),
  prisma.machine.findMany({
    where: { id: { in: machineIds } },
    select: { id: true, sectorId: true }
  })
]);
const docsMap = new Map(maintenanceDocs.map(d => [d.id, d]));
const machineMap = new Map(machines.map(m => [m.id, m]));
// Filtrar en memoria usando maps
```
**Impacto:** 99% menos queries, ~1-2s ahorro por request

#### Fix 2.2: Entregas Analytics - Loop de 14 queries → 1-2
**Archivo:** `app/api/ventas/entregas/analytics/route.ts` (líneas 225-265)
**Problema:** `calculateRecentTrends()` - 7 días × 2 queries = 14 queries secuenciales
**Fix:** Un solo `$queryRaw` con `DATE_TRUNC` + GROUP BY
```typescript
// ANTES: 14 queries en loop secuencial
// DESPUÉS: 1 query con grouping
const trends = await prisma.$queryRaw`
  SELECT DATE("createdAt") as date,
         COUNT(*) as created,
         COUNT(CASE WHEN "estado" = 'ENTREGADA' THEN 1 END) as delivered
  FROM "sale_deliveries"
  WHERE "companyId" = ${companyId}
    AND "createdAt" >= CURRENT_DATE - INTERVAL '6 days'
  GROUP BY DATE("createdAt")
  ORDER BY date ASC
`;
```
**Impacto:** 500-1000ms ahorro

#### Fix 2.3: Entregas - On-time rate fetchAll → aggregate
**Archivo:** `app/api/ventas/entregas/analytics/route.ts` (líneas 139-159)
**Problema:** Fetch ALL entregas entregadas, filtra en JS
**Fix:** `$queryRaw` con CASE WHEN para conteo DB-level
**Impacto:** 70% más rápido

#### Fix 2.4: Entregas - Avg delivery time fetchAll → aggregate
**Archivo:** `app/api/ventas/entregas/analytics/route.ts` (líneas 164-185)
**Problema:** Fetch ALL entregas, calcula tiempo promedio en JS
**Fix:** `AVG(EXTRACT(EPOCH FROM ...))` en DB
**Impacto:** 75% más rápido

---

### Prioridad ALTA (Semana 2)

#### Fix 2.5: Facturas Dashboard - fetchAll → aggregates
**Archivo:** `app/api/ventas/facturas/dashboard/route.ts` (líneas 59-96)
**Problema:** Carga TODAS las facturas, reduce 4 veces en JS
**Fix:**
1. KPIs → `prisma.salesInvoice.aggregate({ _sum: { total, totalCobrado, saldoPendiente } })`
2. Facturas vencidas → `$queryRaw` con `WHERE fechaVencimiento < CURRENT_DATE`
3. Trends → `$queryRaw` con `GROUP BY DATE_TRUNC('month', fechaEmision)`
4. Aging → `$queryRaw` con `CASE WHEN CURRENT_DATE - fechaVencimiento BETWEEN...`
**Impacto:** 70-80% más rápido, de ~5s a ~800ms

#### Fix 2.6: Facturas Dashboard - Top clientes groupBy+fetch → JOIN
**Archivo:** `app/api/ventas/facturas/dashboard/route.ts` (líneas 180-215)
**Problema:** `groupBy` por clientId + fetch separado de nombres
**Fix:** `$queryRaw` con `LEFT JOIN "Client"` y `GROUP BY`
**Impacto:** Elimina 1 round-trip

#### Fix 2.7: Órdenes Analytics - 8 reduces → 1 pass o aggregates
**Archivo:** `app/api/ventas/ordenes/analytics/route.ts` (líneas 74-110)
**Problema:** Mismo array iterado 8 veces para distintas métricas
**Fix:** Consolidar en single pass o usar `aggregate` + `groupBy`
**Impacto:** 50-60% más rápido

#### Fix 2.8: Órdenes Analytics - Monthly grouping → DB groupBy
**Archivo:** `app/api/ventas/ordenes/analytics/route.ts` (líneas 188-204)
**Problema:** Fetch all orders, agrupa por mes en JS
**Fix:** `$queryRaw` con `TO_CHAR(fechaEmision, 'YYYY-MM')` + GROUP BY
**Impacto:** 50% más rápido

#### Fix 2.9: Pagos Analytics - fetchAll → aggregates
**Archivo:** `app/api/ventas/pagos/analytics/route.ts` (líneas 56-96)
**Problema:** Carga todos los pagos, reduce múltiples veces, calcula collection time en JS
**Fix:**
1. `prisma.clientPayment.aggregate({ _sum, _count })` para KPIs
2. `$queryRaw` con `AVG(EXTRACT(EPOCH FROM ...))` para tiempo cobranza
3. `aggregate({ _sum: { efectivo, transferencia, ... } })` para medios de pago
**Impacto:** 80% más rápido

#### Fix 2.10: Pagos Analytics - Aging client-side → DB CASE WHEN
**Archivo:** `app/api/ventas/pagos/analytics/route.ts` (líneas 271-296)
**Problema:** Fetch all pending invoices + calcular aging buckets en JS
**Fix:** `$queryRaw` con CASE WHEN para buckets de aging
**Impacto:** 70% más rápido

---

### Prioridad MEDIA (Semana 3)

#### Fix 2.11: Production KPIs - fetchAll → aggregates
**Archivo:** `app/api/production/kpis/route.ts` (líneas 47-90)
**Problema:** Fetch completed orders + daily reports, 7 reduces
**Fix:** `prisma.productionOrder.aggregate()` + `prisma.dailyProductionReport.aggregate()`
**Impacto:** 70% más rápido

#### Fix 2.12: Production KPIs - Pareto loop → DB GROUP BY
**Archivo:** `app/api/production/kpis/route.ts` (líneas 100-140)
**Problema:** Fetch all downtimes con include, Pareto en JS
**Fix:** `$queryRaw` con LEFT JOIN + GROUP BY + ORDER BY + LIMIT
**Impacto:** 80% más rápido

#### Fix 2.13: Resumen Ejecutivo - N+1 clientes y vendedores
**Archivo:** `app/api/ventas/reportes/resumen-ejecutivo/route.ts` (líneas 157-214)
**Problema:** groupBy + fetch separado de nombres (×2: clientes + vendedores)
**Fix:** 2× `$queryRaw` con LEFT JOIN + GROUP BY
**Impacto:** Elimina 2 round-trips

#### Fix 2.14: Resumen Ejecutivo - Daily sales grouping
**Archivo:** `app/api/ventas/reportes/resumen-ejecutivo/route.ts` (líneas 220-241)
**Problema:** Fetch 30 días de ventas, Map grouping en JS
**Fix:** `$queryRaw` con `DATE(fechaEmision)` + GROUP BY
**Impacto:** 80% más rápido

#### Fix 2.15: Costos Historial - Client-side grouping + LAG
**Archivo:** `app/api/costos/historial/route.ts` (líneas 28-90)
**Problema:** Fetch all salary history, agrupa por empleado, sort manual
**Fix:** `$queryRaw` con `LAG()` window function + GROUP BY
**Impacto:** 60% más rápido

#### Fix 2.16: Cuentas Corrientes - 3 queries redundantes → CTE
**Archivo:** `app/api/compras/cuentas-corrientes/route.ts` (líneas 130-221)
**Problema:** 3 `$queryRaw` con WHERE clauses casi idénticas
**Fix:** 1 `$queryRaw` con CTEs (Common Table Expressions)
**Impacto:** 50% menos round-trips

---

## FASE 3 - PLAN DE EJECUCIÓN

### Paso 3.1: Migration de Índices

```bash
# Generar migration con todos los índices nuevos
cd project
npx prisma migrate dev --name add_composite_indices_audit_2026
```

**Contenido de la migration:**
- 28 índices para modelos sin índices (Batch A, B, C)
- 13 índices compuestos para modelos existentes
- **Total: 41 índices nuevos**

**Nota:** En producción usar `CREATE INDEX CONCURRENTLY` para zero-downtime.

### Paso 3.2: Implementar Fixes de API Routes

**Orden de implementación (por impacto):**

| Orden | Fix | Archivo | Esfuerzo | Impacto |
|-------|-----|---------|----------|---------|
| 1 | 2.1 | maintenance/checklists | 3h | 99% menos queries |
| 2 | 2.2 | entregas/analytics | 2h | 90% menos queries |
| 3 | 2.5 | facturas/dashboard | 3h | 70-80% más rápido |
| 4 | 2.9 | pagos/analytics | 2h | 80% más rápido |
| 5 | 2.7 | ordenes/analytics | 2h | 50-60% más rápido |
| 6 | 2.11 | production/kpis | 2h | 70% más rápido |
| 7 | 2.3-2.4 | entregas (on-time+avg) | 1h | 70-75% más rápido |
| 8 | 2.6 | facturas/top-clients | 1h | -1 round-trip |
| 9 | 2.10 | pagos/aging | 1h | 70% más rápido |
| 10 | 2.13 | resumen-ejecutivo | 1h | -2 round-trips |
| 11 | 2.8+2.14 | ordenes+resumen monthly | 1h | 50-80% más rápido |
| 12 | 2.12 | production/pareto | 1h | 80% más rápido |
| 13 | 2.15 | costos/historial | 2h | 60% más rápido |
| 14 | 2.16 | cuentas-corrientes | 3h | 50% menos trips |

**Esfuerzo total estimado: ~25h de desarrollo**

### Paso 3.3: Verificación Post-Deploy

```sql
-- Verificar que los índices se crearon correctamente
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN (
  'Tool', 'Task', 'Subtask', 'Worker',
  'CostProduct', 'maintenance_history',
  'sales', 'sale_deliveries', 'sales_invoices',
  'client_payments', 'production_orders'
)
ORDER BY tablename, indexname;

-- Verificar uso de índices en queries frecuentes
EXPLAIN ANALYZE
SELECT * FROM "sales"
WHERE "companyId" = 1 AND "estado" = 'CONFIRMADA'
ORDER BY "createdAt" DESC LIMIT 50;

EXPLAIN ANALYZE
SELECT * FROM "sales_invoices"
WHERE "companyId" = 1 AND "estado" IN ('EMITIDA', 'PARCIALMENTE_COBRADA')
AND "fechaVencimiento" < CURRENT_DATE;
```

---

## MÉTRICAS ESPERADAS

| Métrica | Antes (est.) | Después | Mejora |
|---------|-------------|---------|--------|
| Dashboard facturas load | 3-5s | 500-800ms | 70% |
| Dashboard compras load | 2-4s | 400-600ms | 75% |
| KPIs producción | 2-3s | 300-500ms | 80% |
| Analytics entregas | 5-10s | 500ms-1s | 90% |
| Checklists mantenimiento | 3-8s | 200-500ms | 95% |
| Historial costos | timeout posible | 500ms pag. | 95% |
| Queries por page load | 50-100 | 5-10 | 90% |
| Memory usage (analytics) | 500MB+ | 50-100MB | 80% |

---

## DEBT TÉCNICO DOCUMENTADO (No abordar ahora)

### Naming inconsistency
- `companyId` (224 modelos) vs `company_id` (39 modelos legacy)
- `createdAt` (290) vs `created_at` (49)
- `status` (48) vs `estado` (45)
- **Acción:** Documentar, no migrar. Parar de agregar snake_case en nuevos campos.

### Modelos legacy duplicados (posible consolidación futura)
- `product_categories` / `product_subcategories` → ¿Reemplazados por `Category`?
- `supply_price_history` → ¿Reemplazado por `InputPriceHistory`?
- `checklist_executions` / `checklist_items` → ¿Reemplazados por `ChecklistExecution`?
- **Acción:** Grep de uso antes de deprecar. Tarea separada.

### Singleton models sin índices propios
- `SalesConfig`, `CompanySettings`, `CompanySettingsCosting`, etc.
- Ya tienen `@unique` en `companyId` que funciona como índice implícito
- **Acción:** No requieren índices adicionales
