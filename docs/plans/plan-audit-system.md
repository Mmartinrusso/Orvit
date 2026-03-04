# Plan: Sistema de Auditoría Completo para Mawir ERP

## Estado Actual del Codebase

### Ya existe (NO duplicar):
- **6 modelos de auditoría** en Prisma schema:
  - `AuditLog` (genérico CMMS) - `audit_logs` table
  - `SalesAuditLog` - `sales_audit_logs` table
  - `PurchaseAuditLog` - `purchase_audit_logs` table
  - `PermissionAuditLog` - `PermissionAuditLog` table
  - `PayrollAuditLog` - `payroll_audit_logs` table
  - `BillingAuditLog` - `billing_audit_log` table
- **Helpers por módulo**: `lib/ventas/audit-helper.ts`, `lib/compras/audit-helper.ts`, `lib/almacen/audit.ts`, `lib/billing/audit.ts`
- **Detailed audit logger** con diff field-level: `lib/ventas/detailed-audit-logger.ts`
- **Enum AuditAction**: CREATE, UPDATE, DELETE, STATUS_CHANGE, ASSIGN, APPROVE, REJECT, CLOSE, REOPEN, etc.
- **IP extraction**: `getClientIdentifier()` en `lib/auth/rate-limit.ts`
- **Permiso existente**: `audit.view`, `audit.export` en `lib/permissions.ts`
- **Página placeholder**: `app/administracion/auditoria/page.tsx` (solo mock data)

### Qué falta (scope de este plan):
1. **Modelo unificado** para consulta cross-module (vista consolidada)
2. **Triggers PostgreSQL** para tablas financieras/inventario sin auditoría manual
3. **Middleware API** que inyecte IP/userAgent automáticamente en context
4. **UI funcional** de auditoría con filtros, diff viewer, export
5. **Job de retención/archivado** de logs >90 días
6. **Cobertura de tablas** que hoy no tienen auditoría (tesorería, inventario)

---

## Fase 1: Schema y Modelo Unificado

### 1.1 Crear modelo `UnifiedAuditLog` en Prisma schema

**Archivo**: `project/prisma/schema.prisma` (agregar al final)

```prisma
model UnifiedAuditLog {
  id          Int      @id @default(autoincrement())
  timestamp   DateTime @default(now())

  // Quién
  userId      Int
  user        User     @relation("UnifiedAuditUser", fields: [userId], references: [id])
  companyId   Int
  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  // Qué
  tableName   String   @db.VarChar(100)  // "Sale", "PurchaseOrder", "CashMovement", etc.
  recordId    Int                         // ID del registro afectado
  action      AuditAction                 // CREATE, UPDATE, DELETE, STATUS_CHANGE, etc.

  // Cambios
  oldValues   Json?                       // Snapshot pre-cambio
  newValues   Json?                       // Snapshot post-cambio
  summary     String?                     // Resumen legible: "Cambió estado de BORRADOR a CONFIRMADA"

  // Contexto de request
  ipAddress   String?  @db.VarChar(50)
  userAgent   String?  @db.VarChar(500)

  // Origen (para saber si vino de trigger o de app)
  source      AuditSource @default(APP)

  @@index([companyId, timestamp])
  @@index([tableName, recordId])
  @@index([userId])
  @@index([companyId, tableName])
  @@index([companyId, action])
  @@map("unified_audit_logs")
}

model ArchivedAuditLog {
  id          Int      @id @default(autoincrement())
  timestamp   DateTime
  userId      Int
  companyId   Int
  tableName   String   @db.VarChar(100)
  recordId    Int
  action      AuditAction
  oldValues   Json?
  newValues   Json?
  summary     String?
  ipAddress   String?  @db.VarChar(50)
  userAgent   String?  @db.VarChar(500)
  source      AuditSource @default(APP)
  archivedAt  DateTime @default(now())

  @@index([companyId, timestamp])
  @@index([tableName, recordId])
  @@map("archived_audit_logs")
}

enum AuditSource {
  APP        // Desde la aplicación (API routes)
  TRIGGER    // Desde trigger PostgreSQL
  JOB        // Desde background job
  SYSTEM     // Acción del sistema automática
}
```

### 1.2 Agregar relaciones en User y Company

Agregar en el modelo `User`:
```prisma
unifiedAuditLogs UnifiedAuditLog[] @relation("UnifiedAuditUser")
```

Agregar en el modelo `Company`:
```prisma
unifiedAuditLogs UnifiedAuditLog[]
```

### 1.3 Migración

```bash
npx prisma migrate dev --name add_unified_audit_log
```

---

## Fase 2: Triggers PostgreSQL para Tablas Críticas

### 2.1 Script SQL de triggers

**Archivo nuevo**: `project/prisma/migrations/YYYYMMDD_audit_triggers/migration.sql`

Se creará también un archivo reutilizable: `project/prisma/sql/audit-triggers.sql`

**Estrategia**: Crear una función genérica `audit_trigger_func()` que se reutiliza en todas las tablas. El trigger escribe directamente a `unified_audit_logs`.

**Nota sobre userId**: Los triggers no tienen acceso al userId del JWT. Se usará `current_setting('app.current_user_id', true)` que será seteado por el middleware en cada transacción. Si no está seteado (ej: migraciones), se usará `0` como system user.

**Función genérica del trigger**:
```sql
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  _user_id INTEGER;
  _company_id INTEGER;
  _action TEXT;
  _old_values JSONB;
  _new_values JSONB;
  _summary TEXT;
BEGIN
  -- Obtener user_id del contexto de la app (seteado por middleware)
  BEGIN
    _user_id := COALESCE(NULLIF(current_setting('app.current_user_id', true), '')::INTEGER, 0);
  EXCEPTION WHEN OTHERS THEN
    _user_id := 0;
  END;

  IF TG_OP = 'INSERT' THEN
    _action := 'CREATE';
    _company_id := NEW."companyId";
    _new_values := to_jsonb(NEW);
    _summary := 'Registro creado en ' || TG_TABLE_NAME;

    INSERT INTO unified_audit_logs ("timestamp", "userId", "companyId", "tableName", "recordId", action, "newValues", summary, source)
    VALUES (NOW(), _user_id, _company_id, TG_TABLE_NAME, NEW.id, 'CREATE', _new_values, _summary, 'TRIGGER');

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'UPDATE';
    _company_id := NEW."companyId";
    _old_values := to_jsonb(OLD);
    _new_values := to_jsonb(NEW);

    -- Solo loguear si realmente cambió algo (excluir updatedAt)
    IF _old_values - 'updatedAt' = _new_values - 'updatedAt' THEN
      RETURN NEW;
    END IF;

    -- Detectar cambio de estado
    IF OLD."estado" IS DISTINCT FROM NEW."estado" THEN
      _action := 'STATUS_CHANGE';
      _summary := 'Estado cambió de ' || COALESCE(OLD."estado"::TEXT, 'NULL') || ' a ' || NEW."estado"::TEXT;
    ELSIF OLD."status" IS DISTINCT FROM NEW."status" THEN
      _action := 'STATUS_CHANGE';
      _summary := 'Status cambió de ' || COALESCE(OLD."status"::TEXT, 'NULL') || ' a ' || NEW."status"::TEXT;
    ELSE
      _summary := 'Registro actualizado en ' || TG_TABLE_NAME;
    END IF;

    INSERT INTO unified_audit_logs ("timestamp", "userId", "companyId", "tableName", "recordId", action, "oldValues", "newValues", summary, source)
    VALUES (NOW(), _user_id, _company_id, TG_TABLE_NAME, NEW.id, _action::"AuditAction", _old_values, _new_values, _summary, 'TRIGGER');

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    _action := 'DELETE';
    _company_id := OLD."companyId";
    _old_values := to_jsonb(OLD);
    _summary := 'Registro eliminado de ' || TG_TABLE_NAME;

    INSERT INTO unified_audit_logs ("timestamp", "userId", "companyId", "tableName", "recordId", action, "oldValues", summary, source)
    VALUES (NOW(), _user_id, _company_id, TG_TABLE_NAME, OLD.id, 'DELETE', _old_values, _summary, 'TRIGGER');

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### 2.2 Tablas que recibirán triggers

**Prioridad 1 - Financieros (transacciones de dinero)**:
| Tabla Prisma | Tabla SQL | Justificación |
|---|---|---|
| Sale | Sale | Ventas |
| SaleItem | SaleItem | Items de venta (precios, cantidades) |
| SalesInvoice | SalesInvoice | Facturas emitidas |
| SalesInvoiceItem | SalesInvoiceItem | Detalle facturación |
| SalesCreditDebitNote | SalesCreditDebitNote | Notas crédito/débito |
| ClientPayment | ClientPayment | Cobros |
| ClientLedgerEntry | ClientLedgerEntry | Cuenta corriente cliente |
| PurchaseOrder | PurchaseOrder | Órdenes de compra |
| PurchaseOrderItem | PurchaseOrderItem | Items OC |
| GoodsReceipt | GoodsReceipt | Recepciones |
| PaymentOrder | PaymentOrder | Órdenes de pago |
| PaymentRequest | PaymentRequest | Solicitudes de pago |
| CreditDebitNote | CreditDebitNote | NC/ND compras |
| SupplierAccountMovement | SupplierAccountMovement | Cuenta corriente proveedor |
| CashMovement | CashMovement | Movimientos de caja |
| BankMovement | BankMovement | Movimientos bancarios |
| Cheque | Cheque | Cartera de cheques |
| TreasuryTransfer | TreasuryTransfer | Transferencias internas |

**Prioridad 2 - Inventario/Stock**:
| Tabla Prisma | Tabla SQL | Justificación |
|---|---|---|
| ProductStockMovement | ProductStockMovement | Movimientos de stock |
| StockTransfer | StockTransfer | Transferencias entre depósitos |
| StockAdjustment | StockAdjustment | Ajustes de inventario |
| StockReservation | StockReservation | Reservas de stock |
| MaterialRequest | MaterialRequest | Solicitudes de material |
| Despacho | Despacho | Despachos |
| ToolMovement | ToolMovement | Movimientos de herramientas |

**Prioridad 3 - Configuración y Seguridad**:
| Tabla Prisma | Tabla SQL | Justificación |
|---|---|---|
| User | User | Cambios en usuarios |
| Role | Role | Cambios en roles |
| RolePermission | RolePermission | Asignación de permisos |
| UserPermission | UserPermission | Permisos directos |
| UserOnCompany | UserOnCompany | Asignación empresa |

**Prioridad 4 - Producción/OT**:
| Tabla Prisma | Tabla SQL | Justificación |
|---|---|---|
| WorkOrder | WorkOrder | Órdenes de trabajo |
| Quote | Quote | Cotizaciones |
| QuoteItem | QuoteItem | Items de cotización |

**Creación de triggers** (ejemplo para cada tabla):
```sql
CREATE TRIGGER audit_sale_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "Sale"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

Se generará un trigger por cada tabla listada arriba (total: ~30 triggers).

### 2.3 Consideraciones técnicas de los triggers

- **Tablas sin `companyId` directo**: Para tablas como `RolePermission` que no tienen `companyId`, se necesitará una versión adaptada del trigger que haga JOIN o use el `companyId` de la tabla padre.
- **Tablas con `estado` vs `status`**: La función genérica maneja ambos campos.
- **Performance**: Los triggers AFTER son non-blocking. El INSERT a `unified_audit_logs` es liviano.
- **Volumen estimado**: ~5K-20K audit entries/día dependiendo del uso. Particionamiento no es necesario aún, el archivado a 90 días será suficiente.

---

## Fase 3: Middleware para Captura de Contexto

### 3.1 Middleware de contexto de auditoría

**Archivo nuevo**: `project/lib/audit/audit-context.ts`

```typescript
// Setear el userId en la sesión PostgreSQL para que los triggers lo capturen
export async function setAuditContext(userId: number): Promise<void> {
  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.current_user_id', $1::TEXT, true)`,
    String(userId)
  );
}
```

### 3.2 Helper para captura de request metadata

**Archivo nuevo**: `project/lib/audit/request-context.ts`

```typescript
import { NextRequest } from 'next/server';
import { getClientIdentifier } from '@/lib/auth/rate-limit';

export interface AuditRequestContext {
  ipAddress: string;
  userAgent: string;
  userId: number;
  companyId: number;
}

export function extractAuditContext(
  request: NextRequest,
  user: { id: number; companyId: number }
): AuditRequestContext {
  return {
    ipAddress: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') || 'unknown',
    userId: user.id,
    companyId: user.companyId,
  };
}
```

### 3.3 Logger unificado de auditoría

**Archivo nuevo**: `project/lib/audit/unified-audit-logger.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { AuditAction } from '@prisma/client';

interface LogAuditParams {
  userId: number;
  companyId: number;
  tableName: string;
  recordId: number;
  action: AuditAction;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  summary?: string;
  ipAddress?: string;
  userAgent?: string;
  source?: 'APP' | 'TRIGGER' | 'JOB' | 'SYSTEM';
  tx?: typeof prisma;
}

export async function logUnifiedAudit(params: LogAuditParams): Promise<void> {
  const db = params.tx || prisma;
  try {
    await db.unifiedAuditLog.create({
      data: {
        userId: params.userId,
        companyId: params.companyId,
        tableName: params.tableName,
        recordId: params.recordId,
        action: params.action,
        oldValues: params.oldValues ?? undefined,
        newValues: params.newValues ?? undefined,
        summary: params.summary,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        source: params.source || 'APP',
      },
    });
  } catch (error) {
    // Audit logging NUNCA debe romper la operación principal
    console.error('[UnifiedAudit] Error logging audit:', error);
  }
}
```

### 3.4 Integración con `setAuditContext` en API routes

**Patrón de uso** en rutas que modifican datos financieros:

```typescript
// En cualquier API route que modifica datos
import { setAuditContext } from '@/lib/audit/audit-context';

export async function POST(req: NextRequest) {
  const { user, error } = await requirePermission('...');
  if (error) return error;

  // Setear contexto para que los triggers capturen el userId
  await setAuditContext(user!.id);

  // El resto de la lógica...
  // Los triggers automáticamente loguean a unified_audit_logs
}
```

**Nota**: NO se modificará el middleware global (`middleware.ts`) para setear el contexto, ya que el middleware de Next.js corre en Edge Runtime y no tiene acceso a `prisma.$executeRawUnsafe`. El `setAuditContext()` se llamará al inicio de cada API route que modifica datos.

Para simplificar, se creará un wrapper:

**Archivo nuevo**: `project/lib/audit/with-audit.ts`

```typescript
export async function withAuditContext<T>(
  userId: number,
  fn: () => Promise<T>
): Promise<T> {
  await setAuditContext(userId);
  return fn();
}
```

---

## Fase 4: API de Auditoría

### 4.1 GET endpoint para consulta

**Archivo nuevo**: `project/app/api/audit/route.ts`

```
GET /api/audit?page=1&limit=50&table=Sale&action=CREATE&userId=5&from=2024-01-01&to=2024-01-31&search=texto
```

**Funcionalidades**:
- Paginación (page + limit, max 100)
- Filtros: `tableName`, `action`, `userId`, `from`/`to` (rango de fechas)
- Búsqueda en `summary` (ILIKE)
- Siempre filtrado por `companyId` del usuario autenticado
- Permiso requerido: `audit.view`
- Incluye join con User para mostrar nombre

**Response**:
```json
{
  "data": [...],
  "pagination": { "page": 1, "limit": 50, "total": 1247, "pages": 25 },
  "stats": {
    "totalEvents": 1247,
    "activeUsers": 24,
    "criticalEvents": 3,
    "byAction": { "CREATE": 400, "UPDATE": 600, "DELETE": 47, ... }
  }
}
```

### 4.2 GET endpoint para detalle de un registro

**Archivo nuevo**: `project/app/api/audit/[id]/route.ts`

```
GET /api/audit/123
```

Retorna el log completo con `oldValues` y `newValues` desserializados para el diff viewer.

### 4.3 GET endpoint para exportar CSV

**Archivo nuevo**: `project/app/api/audit/export/route.ts`

```
GET /api/audit/export?table=Sale&from=2024-01-01&to=2024-01-31
```

- Permiso requerido: `audit.export`
- Genera CSV con headers: Fecha, Usuario, Tabla, Registro, Acción, Resumen, IP
- Streaming response para datasets grandes
- Limit: 10,000 registros por export

---

## Fase 5: UI de Auditoría

### 5.1 Reemplazar página placeholder

**Archivo**: `project/app/administracion/auditoria/page.tsx` (reescribir completo)

**Estructura de la página**:

```
┌──────────────────────────────────────────────────────────┐
│ Header: "Auditoría del Sistema"     [Exportar CSV]       │
│ Subtitle: "Registro de todos los cambios..."             │
├──────────────────────────────────────────────────────────┤
│ KPIs Row (4 cards):                                      │
│ [Total Eventos] [Usuarios Activos] [Deletes] [Hoy]      │
├──────────────────────────────────────────────────────────┤
│ Toolbar:                                                 │
│ [🔍 Buscar...] [Tabla ▼] [Acción ▼] [Usuario ▼]        │
│ [📅 Desde] [📅 Hasta] [Limpiar filtros]                 │
├──────────────────────────────────────────────────────────┤
│ Table:                                                   │
│ Fecha | Usuario | Tabla | Registro | Acción | Resumen    │
│ ─────────────────────────────────────────────────────    │
│ 2024-01-26 10:30 | Juan P. | Sale | #45 | CREATE | ...  │
│ 2024-01-26 10:25 | Ana G.  | User | #12 | UPDATE | ...  │
│ ...                                                      │
│ Click en fila → abre Sheet lateral con diff              │
├──────────────────────────────────────────────────────────┤
│ Pagination: [← Anterior] Página 1 de 25 [Siguiente →]   │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Componente Diff Viewer

**Archivo nuevo**: `project/components/audit/AuditDiffViewer.tsx`

Sheet lateral que se abre al hacer click en una fila. Muestra:

```
┌─────────────────────────────────────────┐
│ Detalle de Cambio                    [X]│
├─────────────────────────────────────────┤
│ Acción: UPDATE                          │
│ Tabla: Sale | Registro: #45             │
│ Usuario: Juan Pérez                     │
│ Fecha: 26/01/2024 10:30:00             │
│ IP: 192.168.1.100                       │
│ Origen: APP                             │
├─────────────────────────────────────────┤
│ Cambios:                                │
│                                         │
│ estado                                  │
│ ┌─────────┬──────────┐                 │
│ │ Antes   │ Después  │                 │
│ │BORRADOR │CONFIRMADA│                 │
│ └─────────┴──────────┘                 │
│                                         │
│ total                                   │
│ ┌──────────┬──────────┐                │
│ │ Antes    │ Después  │                │
│ │$15,000.00│$15,500.00│                │
│ └──────────┴──────────┘                │
│                                         │
│ (campos sin cambios colapsados)         │
└─────────────────────────────────────────┘
```

**Lógica del diff**:
- Comparar keys de `oldValues` vs `newValues`
- Mostrar solo campos que cambiaron (highlight)
- Campos sensibles (passwords, tokens) → mostrar como `[REDACTED]`
- Formato especial para: fechas (date-fns), montos ($), booleanos (Sí/No)

### 5.3 Hook de datos

**Archivo nuevo**: `project/hooks/use-audit-logs.ts`

```typescript
// TanStack Query hook
export function useAuditLogs(filters: AuditFilters) {
  return useQuery({
    queryKey: queryKeys.audit.list(filters),
    queryFn: () => fetchAuditLogs(filters),
    staleTime: STALE_TIMES.FREQUENT, // 30s - datos cambian frecuentemente
  });
}
```

### 5.4 Agregar query keys

**Archivo**: `project/lib/cache/query-keys.ts`

Agregar:
```typescript
audit: {
  all: ['audit'] as const,
  list: (filters: AuditFilters) => ['audit', 'list', filters] as const,
  detail: (id: number) => ['audit', 'detail', id] as const,
},
```

---

## Fase 6: Job de Retención y Archivado

### 6.1 Worker de archivado

**Archivo nuevo**: `project/lib/jobs/workers/audit-archiver.worker.ts`

**Lógica**:
1. Seleccionar registros de `unified_audit_logs` con `timestamp < NOW() - INTERVAL '90 days'`
2. INSERT INTO `archived_audit_logs` SELECT ... (en batches de 1000)
3. DELETE FROM `unified_audit_logs` WHERE id IN (batch archivado)
4. Log resultado: "Archivados X registros, eliminados de tabla principal"

### 6.2 Queue y scheduling

**Archivo**: `project/lib/jobs/queue-manager.ts`

Agregar nueva queue:
```typescript
AUDIT_ARCHIVAL: 'audit-archival'
```

### 6.3 Cron trigger

**Archivo nuevo**: `project/app/api/cron/audit-archive/route.ts`

```
GET /api/cron/audit-archive
Authorization: Bearer ${CRON_SECRET}
```

Ejecutar diariamente a las 3:00 AM. Encola job de archivado.

---

## Fase 7: Documentación

### 7.1 Documentación técnica

**Archivo nuevo**: `project/docs/AUDIT_SYSTEM.md`

Contenido:
- Arquitectura del sistema de auditoría
- Modelos de datos (UnifiedAuditLog, ArchivedAuditLog)
- Cómo agregar auditoría a una nueva tabla (trigger + app-level)
- Triggers PostgreSQL: función genérica, cómo agregar nuevas tablas
- API endpoints disponibles
- Política de retención (90 días activo, archivado indefinido)
- Permisos requeridos (`audit.view`, `audit.export`)
- Guía de compliance: qué se audita, qué no

---

## Orden de Implementación

| # | Tarea | Archivos | Dependencia |
|---|---|---|---|
| 1 | Modelos Prisma (UnifiedAuditLog + ArchivedAuditLog + enum AuditSource) | schema.prisma | Ninguna |
| 2 | Migración Prisma | prisma/migrations/ | Tarea 1 |
| 3 | Script SQL triggers (función + triggers por tabla) | prisma/sql/audit-triggers.sql | Tarea 2 |
| 4 | Audit context helper (setAuditContext + extractAuditContext) | lib/audit/*.ts (3 archivos) | Tarea 2 |
| 5 | Unified audit logger (logUnifiedAudit) | lib/audit/unified-audit-logger.ts | Tarea 2 |
| 6 | API endpoints (GET list + GET detail + GET export) | app/api/audit/ (3 archivos) | Tarea 4, 5 |
| 7 | Hook useAuditLogs + query keys | hooks/use-audit-logs.ts | Tarea 6 |
| 8 | UI: Página de auditoría completa | app/administracion/auditoria/page.tsx | Tarea 7 |
| 9 | UI: Diff Viewer component | components/audit/AuditDiffViewer.tsx | Tarea 8 |
| 10 | Job de archivado (worker + cron route) | lib/jobs/ + app/api/cron/ | Tarea 2 |
| 11 | Documentación | docs/AUDIT_SYSTEM.md | Todo anterior |

## Archivos Nuevos (11 archivos)
1. `project/lib/audit/audit-context.ts`
2. `project/lib/audit/request-context.ts`
3. `project/lib/audit/unified-audit-logger.ts`
4. `project/lib/audit/with-audit.ts`
5. `project/prisma/sql/audit-triggers.sql`
6. `project/app/api/audit/route.ts`
7. `project/app/api/audit/[id]/route.ts`
8. `project/app/api/audit/export/route.ts`
9. `project/components/audit/AuditDiffViewer.tsx`
10. `project/lib/jobs/workers/audit-archiver.worker.ts`
11. `project/app/api/cron/audit-archive/route.ts`
12. `project/docs/AUDIT_SYSTEM.md`

## Archivos Modificados (5 archivos)
1. `project/prisma/schema.prisma` - Agregar UnifiedAuditLog, ArchivedAuditLog, AuditSource enum
2. `project/app/administracion/auditoria/page.tsx` - Reescribir completo
3. `project/hooks/use-audit-logs.ts` - Nuevo hook
4. `project/lib/cache/query-keys.ts` - Agregar audit keys
5. `project/lib/jobs/queue-manager.ts` - Agregar AUDIT_ARCHIVAL queue

## Notas Importantes

1. **No duplicar auditoría existente**: Los módulos que ya tienen sus propios audit logs (ventas, compras, billing, payroll) seguirán usándolos. El `UnifiedAuditLog` es complementario vía triggers para tener una vista consolidada. Los helpers existentes NO se modifican.

2. **Triggers vs App-level**: Los triggers capturan TODOS los cambios (incluso los que vengan de migraciones o queries manuales). El app-level logging (`logUnifiedAudit`) se usa para agregar contexto adicional (summary, IP, userAgent) que el trigger no puede capturar.

3. **Performance**: Los triggers AFTER son async respecto a la transacción. El impacto en performance es mínimo (~1-2ms por operación auditada).

4. **Seguridad**: Los audit logs son INSERT-only desde la app. No hay endpoints de UPDATE o DELETE para audit logs. Solo el job de archivado puede mover/eliminar registros.

5. **Multi-tenancy**: Todo filtrado por `companyId`. Un usuario nunca puede ver audit logs de otra company.
