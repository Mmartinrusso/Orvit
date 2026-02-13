# Plan: Feature "Desarmar Máquina" (v2 - Corregido)

## Resumen Ejecutivo

El feature "Desarmar Máquina" permite convertir un **componente** de una máquina en una **máquina independiente**, **migrando todo su historial** (OTs, fallas, logs, documentos).

### Objetivo Real
No solo "convertir un componente en máquina", sino **reubicar correctamente todo el historial** ya cargado para que:
- La nueva máquina muestre el historial completo del componente (y su subárbol)
- La máquina origen conserve trazabilidad con un evento/nota (sin quedarse con datos "mal agrupados")

### Casos de Uso
- Un componente complejo se retira para reparación extensiva
- Se decide que un componente merece tracking independiente
- Se reorganiza la estructura de activos de la planta
- **Corregir datos históricos** ya cargados que deberían pertenecer a otra entidad

---

## Cambios Clave vs Plan Original

| Aspecto | Plan Original | Plan v2 (Corregido) |
|---------|---------------|---------------------|
| **Historial (OTs/Fallas)** | No se migraba | ✅ `migrateHistory: 'move'/'keep'` |
| **Documentos** | `componentId = null` al mover | ✅ Mantener `componentId` (no perder granularidad) |
| **Tracking estructural** | Solo nota/evento | ✅ Relación formal `originMachineId`, `derivedFromComponentId` |
| **Idempotencia** | No implementada | ✅ `operationId` + verificación |
| **Concurrencia** | No manejada | ✅ Advisory lock en transacción |
| **Árbol profundo** | Include 2 niveles | ✅ CTE recursivo para N niveles |
| **AssetCode** | Directo | ✅ Fallback si hay colisión |

---

## Flujo de Usuario Propuesto

### 1. Acceso al Feature
- Desde **ComponentDetailsModal** → menú de acciones → "Convertir en Máquina"
- Requiere permiso especial: `desarmar_maquina` o `gestionar_maquinas`

### 2. Modal de Confirmación y Configuración (Actualizado)
```
┌─────────────────────────────────────────────────────────────┐
│  🔧 Convertir Componente en Máquina                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Componente: [Motor Principal]                              │
│  Máquina origen: [Prensa Hidráulica #1]                     │
│                                                             │
│  📊 Se migrarán:                                            │
│  • 3 subcomponentes                                         │
│  • 842 órdenes de trabajo                                   │
│  • 311 registros de fallas                                  │
│  • 120 documentos                                           │
│                                                             │
│  ── Configuración de la Nueva Máquina ──                    │
│                                                             │
│  Nombre: [Motor Principal________________]                  │
│  Tipo:   [COMPONENT ▼]                                      │
│  Sector: [Sector A (heredado) ▼]                            │
│  Zona:   [Zona 1 (heredado) ▼]                              │
│                                                             │
│  ── Opciones de Migración ──                                │
│                                                             │
│  Historial (OTs y Fallas):                                  │
│  (●) Mover a la nueva máquina (recomendado)                 │
│  ( ) Mantener en máquina origen                             │
│                                                             │
│  Documentos:                                                │
│  (●) Mover (manteniendo vínculo al componente)              │
│  ( ) Copiar                                                 │
│  ( ) No migrar                                              │
│                                                             │
│  ☑ Crear nota en máquina origen                             │
│    (registrar que el componente fue removido)               │
│                                                             │
│  [Cancelar]                       [Confirmar Conversión]    │
└─────────────────────────────────────────────────────────────┘
```

### 3. Resultado
- Nueva máquina creada en el listado de máquinas
- Componente y sus subcomponentes pertenecen a la nueva máquina
- **Historial completo migrado** (OTs, fallas, logs)
- Documentos movidos manteniendo `componentId`
- Nota en la máquina origen con link a la nueva

---

## Modelo de Datos

### Nuevos Campos en Machine (para tracking)
```prisma
model Machine {
  // ... campos existentes ...

  // Tracking de promoción desde componente
  derivedFromComponentId  Int?      // ID del componente original
  originMachineId         Int?      // ID de la máquina de donde vino
  promotedAt              DateTime? // Cuándo se promovió

  // Relaciones
  originMachine           Machine?  @relation("MachineOrigin", fields: [originMachineId], references: [id])
  derivedMachines         Machine[] @relation("MachineOrigin")
}
```

### Component → Machine (Mapeo de Campos)

| Campo Component | Campo Machine | Transformación |
|-----------------|---------------|----------------|
| `name` | `name` | Directo |
| `code` | `assetCode` | Con fallback si colisiona |
| `type` | `type` | Mapear a `MachineType.COMPONENT` |
| `description` | `description` | Directo |
| `technicalInfo` | `technicalNotes` | Directo |
| `logo` | `logo` | Directo |
| `system` | `description` | Agregar al final |
| `criticality` | `criticalityProduction` | 1-10 scale |
| `isSafetyCritical` | `criticalitySafety` | true→10, false→1 |
| - | `companyId` | Heredar de máquina origen |
| - | `areaId` | Heredar de máquina origen |
| - | `sectorId` | Heredar o override |
| - | `plantZoneId` | Heredar o override |
| - | `status` | `ACTIVE` |
| `id` | `derivedFromComponentId` | **NUEVO: tracking** |
| `machineId` | `originMachineId` | **NUEVO: tracking** |

---

## API Endpoint (v2)

### `POST /api/components/[id]/promote-to-machine`

**Request Body:**
```typescript
interface PromoteToMachineRequest {
  // Configuración de la nueva máquina
  newMachineName?: string;      // Default: component.name
  machineType?: MachineType;    // Default: COMPONENT
  sectorId?: number;            // Override del heredado
  plantZoneId?: number;         // Override del heredado

  // Opciones de migración
  migrateHistory: 'move' | 'keep';       // NUEVO: mover OTs/fallas
  migrateDocuments: 'copy' | 'move' | 'none';
  keepHistoryInOrigin: boolean;          // Crear nota en máquina origen

  // Idempotencia
  operationId: string;          // NUEVO: UUID desde frontend
}
```

**Response:**
```typescript
interface PromoteToMachineResponse {
  success: true;
  newMachine: Machine;

  // Conteos de migración
  migratedComponents: number;
  migratedDocuments: number;
  migratedWorkOrders: number;   // NUEVO
  migratedFailures: number;     // NUEVO
  migratedLogs: number;         // NUEVO

  historyEventId: number;
}
```

**Error Responses:**
- `400` - Component no existe o ya es root sin máquina
- `403` - Sin permisos
- `409` - `operationId` ya usado (idempotencia) o componente bloqueado

---

## Lógica de Migración de Historial

### Scope de Migración
```typescript
// Todos los IDs que se van a migrar
const scopeComponentIds = [componentId, ...descendantIds];
```

### Entidades a Migrar (si `migrateHistory = 'move'`)

#### 1. Work Orders (OTs)
```sql
-- Migrar OTs que referencien componentes del scope
UPDATE "WorkOrder"
SET "machineId" = @newMachineId
WHERE "componentId" IN (@scopeComponentIds)
   OR "subcomponentId" IN (@scopeComponentIds);
```

#### 2. Failure Occurrences (Fallas)
```sql
-- Migrar fallas que referencien componentes del scope
UPDATE "FailureOccurrence"
SET "machineId" = @newMachineId
WHERE "componentId" IN (@scopeComponentIds)
   OR "subcomponentId" IN (@scopeComponentIds);

-- También actualizar affectedComponents JSON si contiene IDs del scope
-- (requiere lógica más compleja con jsonb_set)
```

#### 3. History Events / Logs
```sql
-- Migrar eventos de historial
UPDATE "HistoryEvent"
SET "machineId" = @newMachineId
WHERE "componentId" IN (@scopeComponentIds);
```

#### 4. Downtime Records
```sql
UPDATE "Downtime"
SET "machineId" = @newMachineId
WHERE "componentId" IN (@scopeComponentIds);
```

### Documentos (Corrección Importante)

**Problema del plan original:** Al hacer `componentId = null` se pierde granularidad.

**Solución v2:**
```sql
-- CORRECTO: Mantener componentId, solo actualizar machineId
UPDATE "Document"
SET "machineId" = @newMachineId
-- NO hacer: componentId = null
WHERE "componentId" IN (@scopeComponentIds);
```

---

## Implementación Técnica

### Obtener Descendientes (CTE Recursivo)
```typescript
async function getAllDescendantIds(componentId: number): Promise<number[]> {
  const result = await prisma.$queryRaw<{ id: number }[]>`
    WITH RECURSIVE descendants AS (
      -- Caso base: hijos directos
      SELECT id FROM "Component" WHERE "parentId" = ${componentId}
      UNION ALL
      -- Caso recursivo: hijos de hijos
      SELECT c.id FROM "Component" c
      INNER JOIN descendants d ON c."parentId" = d.id
    )
    SELECT id FROM descendants;
  `;
  return result.map(r => r.id);
}
```

### Idempotencia
```typescript
// Tabla para tracking de operaciones
model PromotionOperation {
  id            String   @id // UUID del frontend
  componentId   Int
  newMachineId  Int?
  status        String   // 'pending', 'completed', 'failed'
  createdAt     DateTime @default(now())
  completedAt   DateTime?
  error         String?
}

// En el endpoint:
const existing = await prisma.promotionOperation.findUnique({
  where: { id: body.operationId }
});

if (existing) {
  if (existing.status === 'completed') {
    // Retornar resultado anterior (idempotente)
    return { success: true, newMachineId: existing.newMachineId };
  }
  if (existing.status === 'pending') {
    return { error: 'Operación en progreso' }, { status: 409 };
  }
}
```

### Advisory Lock (Prevenir doble ejecución)
```typescript
await prisma.$transaction(async (tx) => {
  // Obtener lock exclusivo en el componente
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(${componentId});
  `;

  // ... resto de la transacción
});
```

### AssetCode con Fallback
```typescript
let assetCode = component.code;
if (assetCode) {
  // Verificar si ya existe
  const existing = await tx.machine.findFirst({
    where: { assetCode, companyId: component.machine.companyId }
  });
  if (existing) {
    // Agregar sufijo para evitar colisión
    assetCode = `${assetCode}-PROM-${Date.now()}`;
  }
}
```

---

## Código de Referencia Completo

### Estructura del Endpoint (v2)
```typescript
// app/api/components/[id]/promote-to-machine/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAuth, hasPermission } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Validar autenticación y permisos
  const user = await validateAuth(request);
  if (!user || !hasPermission(user, 'desarmar_maquina')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const componentId = Number(params.id);

  // 2. Verificar idempotencia
  const existingOp = await prisma.promotionOperation.findUnique({
    where: { id: body.operationId }
  });

  if (existingOp?.status === 'completed') {
    // Retornar resultado previo
    const machine = await prisma.machine.findUnique({
      where: { id: existingOp.newMachineId! }
    });
    return NextResponse.json({ success: true, newMachine: machine, cached: true });
  }

  // 3. Registrar operación como pendiente
  await prisma.promotionOperation.upsert({
    where: { id: body.operationId },
    create: { id: body.operationId, componentId, status: 'pending' },
    update: { status: 'pending' }
  });

  try {
    // 4. Obtener componente con máquina origen
    const component = await prisma.component.findUnique({
      where: { id: componentId },
      include: { machine: true }
    });

    if (!component || !component.machine) {
      throw new Error('Componente no encontrado o sin máquina asociada');
    }

    // 5. Obtener todos los descendientes (CTE recursivo)
    const descendantIds = await getAllDescendantIds(componentId);
    const scopeComponentIds = [componentId, ...descendantIds];

    // 6. Ejecutar transacción con lock
    const result = await prisma.$transaction(async (tx) => {
      // Lock exclusivo para evitar doble ejecución
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${componentId})`;

      // 6a. Generar assetCode único
      let assetCode = component.code;
      if (assetCode) {
        const existing = await tx.machine.findFirst({
          where: { assetCode, companyId: component.machine.companyId }
        });
        if (existing) {
          assetCode = `${assetCode}-PROM-${Date.now()}`;
        }
      }

      // 6b. Crear nueva máquina
      const newMachine = await tx.machine.create({
        data: {
          name: body.newMachineName || component.name,
          type: body.machineType || 'COMPONENT',
          description: component.description,
          technicalNotes: component.technicalInfo,
          assetCode,
          logo: component.logo,
          status: 'ACTIVE',
          companyId: component.machine.companyId,
          areaId: component.machine.areaId,
          sectorId: body.sectorId || component.machine.sectorId,
          plantZoneId: body.plantZoneId || component.machine.plantZoneId,
          criticalityProduction: component.criticality,
          criticalitySafety: component.isSafetyCritical ? 10 : 1,
          // Tracking de promoción
          derivedFromComponentId: componentId,
          originMachineId: component.machine.id,
          promotedAt: new Date(),
        }
      });

      // 6c. Actualizar componente raíz (ahora pertenece a nueva máquina)
      await tx.component.update({
        where: { id: componentId },
        data: { machineId: newMachine.id, parentId: null }
      });

      // 6d. Actualizar descendientes
      let migratedComponents = 1;
      if (descendantIds.length > 0) {
        await tx.component.updateMany({
          where: { id: { in: descendantIds } },
          data: { machineId: newMachine.id }
        });
        migratedComponents += descendantIds.length;
      }

      // 6e. Migrar historial (si se especificó)
      let migratedWorkOrders = 0;
      let migratedFailures = 0;
      let migratedLogs = 0;

      if (body.migrateHistory === 'move') {
        // Work Orders
        const woResult = await tx.workOrder.updateMany({
          where: {
            OR: [
              { componentId: { in: scopeComponentIds } },
              { subcomponentId: { in: scopeComponentIds } }
            ]
          },
          data: { machineId: newMachine.id }
        });
        migratedWorkOrders = woResult.count;

        // Failure Occurrences
        const failResult = await tx.failureOccurrence.updateMany({
          where: {
            OR: [
              { componentId: { in: scopeComponentIds } },
              { subcomponentId: { in: scopeComponentIds } }
            ]
          },
          data: { machineId: newMachine.id }
        });
        migratedFailures = failResult.count;

        // History Events / Logs
        const logResult = await tx.historyEvent.updateMany({
          where: { componentId: { in: scopeComponentIds } },
          data: { machineId: newMachine.id }
        });
        migratedLogs = logResult.count;
      }

      // 6f. Migrar documentos (MANTENIENDO componentId)
      let migratedDocuments = 0;
      if (body.migrateDocuments === 'move') {
        const docResult = await tx.document.updateMany({
          where: { componentId: { in: scopeComponentIds } },
          data: { machineId: newMachine.id }
          // NO hacer: componentId: null (mantener granularidad)
        });
        migratedDocuments = docResult.count;
      } else if (body.migrateDocuments === 'copy') {
        // Duplicar documentos
        const docs = await tx.document.findMany({
          where: { componentId: { in: scopeComponentIds } }
        });
        for (const doc of docs) {
          await tx.document.create({
            data: {
              ...doc,
              id: undefined, // nuevo ID
              machineId: newMachine.id,
              // Mantener componentId para granularidad
            }
          });
        }
        migratedDocuments = docs.length;
      }

      // 6g. Crear evento de historial en nueva máquina
      const historyEvent = await tx.historyEvent.create({
        data: {
          type: 'COMPONENT_PROMOTED',
          description: `Componente "${component.name}" promovido a máquina independiente`,
          itemId: newMachine.id,
          itemType: 'machine',
          machineId: newMachine.id,
          userId: user.id,
          companyId: component.machine.companyId,
          metadata: {
            originalMachineId: component.machine.id,
            originalMachineName: component.machine.name,
            originalComponentId: componentId,
            descendantsCount: descendantIds.length,
            migratedWorkOrders,
            migratedFailures,
            migratedDocuments,
          }
        }
      });

      // 6h. Crear nota en máquina origen (si se especificó)
      if (body.keepHistoryInOrigin) {
        await tx.historyEvent.create({
          data: {
            type: 'COMPONENT_REMOVED',
            description: `Componente "${component.name}" removido y convertido en máquina independiente (ID: ${newMachine.id})`,
            itemId: component.machine.id,
            itemType: 'machine',
            machineId: component.machine.id,
            userId: user.id,
            companyId: component.machine.companyId,
            metadata: {
              newMachineId: newMachine.id,
              newMachineName: newMachine.name,
              componentId,
              migratedWorkOrders,
              migratedFailures,
            }
          }
        });
      }

      return {
        newMachine,
        migratedComponents,
        migratedDocuments,
        migratedWorkOrders,
        migratedFailures,
        migratedLogs,
        historyEventId: historyEvent.id,
      };
    });

    // 7. Marcar operación como completada
    await prisma.promotionOperation.update({
      where: { id: body.operationId },
      data: {
        status: 'completed',
        newMachineId: result.newMachine.id,
        completedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, ...result });

  } catch (error: any) {
    // Marcar operación como fallida
    await prisma.promotionOperation.update({
      where: { id: body.operationId },
      data: { status: 'failed', error: error.message }
    });

    console.error('Error promoting component:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}

// Helper: obtener descendientes con CTE recursivo
async function getAllDescendantIds(componentId: number): Promise<number[]> {
  const result = await prisma.$queryRaw<{ id: number }[]>`
    WITH RECURSIVE descendants AS (
      SELECT id FROM "Component" WHERE "parentId" = ${componentId}
      UNION ALL
      SELECT c.id FROM "Component" c
      INNER JOIN descendants d ON c."parentId" = d.id
    )
    SELECT id FROM descendants;
  `;
  return result.map(r => r.id);
}
```

---

## Implementación por Fases

### Fase 1: Core (MVP para corregir datos)
1. **Migración de schema** - Agregar campos a Machine + tabla PromotionOperation
2. **API endpoint** con lógica completa
3. **Migración de historial** (OTs, fallas, logs)
4. **Migración de documentos** (manteniendo componentId)
5. **Idempotencia + Lock**

### Fase 2: UI
1. **Botón en ComponentDetailsModal** - "Convertir en Máquina"
2. **Dialog con preview** - Mostrar conteos antes de ejecutar
3. **Opciones de migración** - Radio buttons para historial/documentos
4. **Generación de operationId** - UUID en frontend
5. **Feedback de progreso** y resultado

### Fase 3: Refinamientos
1. **Reporte detallado** del cambio (qué se migró exactamente)
2. **Link bidireccional** en UI (ver máquina origen ↔ ver máquina derivada)
3. **Rollback capability** usando relación origen↔nuevo
4. **Bulk promote** - Múltiples componentes a la vez

### Fase 4: Avanzado (opcional)
1. **Re-integrar máquina como componente** (operación inversa)
2. **Mover componente entre máquinas** (sin promover)
3. **Merge machines** - Fusionar dos máquinas

---

## Validaciones

### Pre-Operación
1. ✅ Componente existe
2. ✅ Usuario tiene permiso `desarmar_maquina`
3. ✅ Componente pertenece a empresa del usuario
4. ✅ `operationId` no usado previamente (idempotencia)
5. ⚠️ Componente no tiene OTs en progreso (warning, no bloqueo)
6. ⚠️ Informar cantidad de entidades a migrar

### Durante Transacción
1. ✅ Advisory lock en componentId
2. ✅ AssetCode único (con fallback)
3. ✅ Validar que componente no fue eliminado/modificado

---

## UI Components

### PromoteToMachineDialog
```typescript
interface PromoteToMachineDialogProps {
  component: MachineComponent;
  originMachine: Machine;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: PromoteToMachineResponse) => void;
}

interface MigrationPreview {
  subcomponents: number;
  workOrders: number;
  failures: number;
  documents: number;
  logs: number;
}
```

### Endpoint de Preview (opcional)
```typescript
// GET /api/components/[id]/promote-preview
// Retorna conteos sin ejecutar la migración
```

---

## Defaults Recomendados

Para el caso de uso principal (corregir datos históricos):

```typescript
const defaultOptions = {
  migrateHistory: 'move',        // Mover todo el historial
  migrateDocuments: 'move',      // Mover documentos
  keepHistoryInOrigin: true,     // Crear nota en origen
};
```

---

## Testing Checklist

### Unit Tests
- [ ] Crear máquina desde componente simple
- [ ] Crear máquina desde componente con subcomponentes profundos
- [ ] Migrar OTs correctamente
- [ ] Migrar fallas correctamente
- [ ] Documentos mantienen componentId
- [ ] Idempotencia funciona (misma request = mismo resultado)
- [ ] Lock previene doble ejecución
- [ ] AssetCode fallback funciona

### Integration Tests
- [ ] Flujo completo UI → API → BD
- [ ] Verificar historial aparece en nueva máquina
- [ ] Verificar nota aparece en máquina origen
- [ ] Verificar links bidireccionales funcionan

### Manual QA
- [ ] Abrir ComponentDetailsModal
- [ ] Click en "Convertir en Máquina"
- [ ] Verificar preview de conteos
- [ ] Completar conversión con opciones por defecto
- [ ] Verificar nueva máquina tiene historial completo
- [ ] Verificar máquina origen tiene nota
- [ ] Verificar documentos tienen componentId

---

## Archivos a Crear/Modificar

### Crear
- `app/api/components/[id]/promote-to-machine/route.ts`
- `app/api/components/[id]/promote-preview/route.ts` (opcional)
- `components/maquinas/PromoteToMachineDialog.tsx`

### Modificar
- `prisma/schema.prisma`:
  - Agregar campos a Machine: `derivedFromComponentId`, `originMachineId`, `promotedAt`
  - Crear modelo `PromotionOperation`
- `components/maquinas/ComponentDetailsModal.tsx` (agregar botón)
- `lib/permissions.ts` (agregar permiso)

---

## Schema Changes

```prisma
// prisma/schema.prisma

model Machine {
  // ... campos existentes ...

  // Tracking de promoción
  derivedFromComponentId  Int?
  originMachineId         Int?
  promotedAt              DateTime?

  originMachine           Machine?  @relation("MachineOrigin", fields: [originMachineId], references: [id])
  derivedMachines         Machine[] @relation("MachineOrigin")
}

model PromotionOperation {
  id            String    @id
  componentId   Int
  newMachineId  Int?
  status        String    // 'pending', 'completed', 'failed'
  error         String?
  createdAt     DateTime  @default(now())
  completedAt   DateTime?

  @@index([componentId])
  @@index([status])
}
```

---

## Decisiones Tomadas

1. **¿Bloquear si hay OTs en progreso?** → Warning, no bloqueo
2. **¿Migrar historial por defecto?** → Sí, `migrateHistory: 'move'`
3. **¿Mantener componentId en documentos?** → Sí, para granularidad
4. **¿Tracking formal de relación?** → Sí, campos en Machine
5. **¿Idempotencia?** → Sí, con operationId y tabla tracking
