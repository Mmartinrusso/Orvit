# Plan: Segunda Base de Datos para T2

## Objetivo
Separar los datos T2 (documentos internos) a una base de datos física independiente para que solo el gerente tenga acceso mediante credenciales separadas.

---

## Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────────┐
│                        APLICACIÓN                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────┐          ┌──────────────────┐            │
│   │   prisma (T1)    │          │  prismaT2 (T2)   │            │
│   │ lib/prisma.ts    │          │ lib/prisma-t2.ts │            │
│   └────────┬─────────┘          └────────┬─────────┘            │
│            │                              │                      │
└────────────┼──────────────────────────────┼──────────────────────┘
             │                              │
             ▼                              ▼
    ┌────────────────┐            ┌────────────────┐
    │  BD Principal  │            │   BD T2        │
    │   (Neon #1)    │            │  (Neon #2)     │
    │                │            │                │
    │ - Suppliers    │◄──────────►│ - T2Receipts   │
    │ - Clients      │  (ID refs) │ - T2Movements  │
    │ - Items        │            │ - T2Payments   │
    │ - T1 docs      │            │ - etc.         │
    └────────────────┘            └────────────────┘
```

---

## Paso 1: Crear Segunda BD en Neon

1. Crear nuevo proyecto en Neon (o segunda BD en el mismo proyecto)
2. Obtener connection string
3. Agregar a `.env`:
```bash
DATABASE_URL_T2="postgresql://user:pass@host/t2db?sslmode=require"
```

---

## Paso 2: Crear Schema Prisma para T2

Crear `prisma/schema-t2.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/@prisma/client-t2"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL_T2")
}

// Solo modelos T2 - SIN relaciones FK a BD principal
// Guardamos IDs como Int normal (no @relation)

model T2PurchaseReceipt {
  id              Int      @id @default(autoincrement())
  companyId       Int      // FK virtual a Company (BD principal)
  supplierId      Int?     // FK virtual a Supplier (BD principal)

  numeroFactura   String
  tipo            String   @default("X")
  fecha           DateTime @default(now())
  neto            Decimal  @default(0)
  total           Decimal  @default(0)
  estado          String   @default("pendiente")
  observaciones   String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relaciones internas T2
  movements       T2SupplierAccountMovement[]
  stockMovements  T2StockMovement[]

  @@index([companyId])
  @@index([supplierId])
}

model T2SupplierAccountMovement {
  id              Int      @id @default(autoincrement())
  companyId       Int
  supplierId      Int
  receiptId       Int?

  fecha           DateTime @default(now())
  comprobante     String
  descripcion     String?
  debe            Decimal  @default(0)
  haber           Decimal  @default(0)
  saldo           Decimal  @default(0)

  createdAt       DateTime @default(now())

  receipt         T2PurchaseReceipt? @relation(fields: [receiptId], references: [id])

  @@index([companyId])
  @@index([supplierId])
}

model T2StockMovement {
  id              Int      @id @default(autoincrement())
  companyId       Int
  itemId          Int      // FK virtual a Item (BD principal)
  receiptId       Int?

  tipo            String
  cantidad        Decimal
  costoUnitario   Decimal  @default(0)
  fecha           DateTime @default(now())
  observaciones   String?

  createdAt       DateTime @default(now())

  receipt         T2PurchaseReceipt? @relation(fields: [receiptId], references: [id])

  @@index([companyId])
  @@index([itemId])
}

model T2PaymentOrder {
  id              Int      @id @default(autoincrement())
  companyId       Int
  supplierId      Int

  fecha           DateTime @default(now())
  monto           Decimal
  metodoPago      String
  estado          String   @default("pendiente")
  observaciones   String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([companyId])
  @@index([supplierId])
}

// ... más modelos T2 según necesidad
```

---

## Paso 3: Crear Cliente Prisma T2

Crear `lib/prisma-t2.ts`:

```typescript
import { PrismaClient as PrismaClientT2 } from '@prisma/client-t2';

const globalForPrismaT2 = globalThis as unknown as {
  prismaT2: PrismaClientT2 | undefined;
};

export const prismaT2 = globalForPrismaT2.prismaT2 ?? new PrismaClientT2({
  log: ['error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrismaT2.prismaT2 = prismaT2;
}

// Helper para verificar si T2 está habilitado
export function isT2Enabled(): boolean {
  return !!process.env.DATABASE_URL_T2;
}
```

---

## Paso 4: Modificar APIs

### Ejemplo: API de Comprobantes

Modificar `app/api/compras/comprobantes/route.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import { prismaT2, isT2Enabled } from '@/lib/prisma-t2';
import { getViewMode } from '@/lib/view-mode';

export async function GET(request: Request) {
  const mode = await getViewMode(request);
  const { companyId } = await getCompanyContext(request);

  // T1: Siempre de BD principal
  const t1Receipts = await prisma.purchaseReceipt.findMany({
    where: { companyId, docType: 'T1' },
    include: { supplier: true }
  });

  // T2: Solo si modo Extended Y BD T2 habilitada
  let t2Receipts = [];
  if (mode === 'E' && isT2Enabled()) {
    const t2Raw = await prismaT2.t2PurchaseReceipt.findMany({
      where: { companyId }
    });

    // Enriquecer con datos de BD principal (suppliers)
    const supplierIds = [...new Set(t2Raw.map(r => r.supplierId).filter(Boolean))];
    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: supplierIds } }
    });
    const supplierMap = new Map(suppliers.map(s => [s.id, s]));

    t2Receipts = t2Raw.map(r => ({
      ...r,
      docType: 'T2',
      supplier: r.supplierId ? supplierMap.get(r.supplierId) : null
    }));
  }

  return Response.json([...t1Receipts, ...t2Receipts]);
}
```

---

## Paso 5: Actualizar applyViewMode

El helper `applyViewMode` ya no filtrará T2 en la BD principal porque T2 estará en otra BD:

```typescript
// lib/view-mode/prisma-helper.ts

export function applyViewMode<T extends Record<string, any>>(
  where: T,
  mode: ViewMode,
): T {
  // En el nuevo modelo, la BD principal SOLO tiene T1
  // No necesitamos filtrar T2 porque no existe en esta BD
  return where;
}

// Nuevo helper para saber si consultar BD T2
export function shouldQueryT2(mode: ViewMode): boolean {
  return mode === MODE.EXTENDED && isT2Enabled();
}
```

---

## Paso 6: Scripts de Migración

### 6.1 Generar cliente T2
```bash
npx prisma generate --schema=prisma/schema-t2.prisma
```

### 6.2 Migrar schema T2
```bash
npx prisma db push --schema=prisma/schema-t2.prisma
```

### 6.3 Script para migrar datos T2 existentes

Crear `prisma/migrate-t2-data.ts`:

```typescript
import { prisma } from '../lib/prisma';
import { prismaT2 } from '../lib/prisma-t2';

async function migrateT2Data() {
  console.log('Migrando datos T2 a nueva BD...');

  // 1. Migrar PurchaseReceipts T2
  const t2Receipts = await prisma.purchaseReceipt.findMany({
    where: { docType: 'T2' }
  });

  for (const receipt of t2Receipts) {
    await prismaT2.t2PurchaseReceipt.create({
      data: {
        companyId: receipt.companyId,
        supplierId: receipt.supplierId,
        numeroFactura: receipt.numeroFactura,
        tipo: receipt.tipo,
        fecha: receipt.fecha,
        neto: receipt.neto,
        total: receipt.total,
        estado: receipt.estado,
        observaciones: receipt.observaciones,
      }
    });
  }

  console.log(`Migrados ${t2Receipts.length} comprobantes T2`);

  // 2. Migrar StockMovements T2
  // ... similar

  // 3. Eliminar T2 de BD principal (OPCIONAL - hacer después de verificar)
  // await prisma.purchaseReceipt.deleteMany({ where: { docType: 'T2' } });
}

migrateT2Data();
```

---

## Paso 7: Flujo de Acceso con Hotkey

### Cómo funciona:

```
┌─────────────────────────────────────────────────────────────────┐
│  Usuario normal (empleado)                                       │
│  - Ve solo datos T1 (BD principal)                              │
│  - No sabe que existe T2                                         │
│  - Si accede directo a BD: solo ve T1                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Gerente (con permiso view.extended)                            │
│  1. Presiona Hotkey (ej: Ctrl+Shift+E)                          │
│  2. Ingresa PIN                                                  │
│  3. App setea cookie _vm = 'E'                                  │
│  4. APIs detectan modo Extended                                  │
│  5. APIs consultan BD principal (T1) + BD T2                    │
│  6. Ve todo combinado en la interfaz                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Técnico con acceso a BD                                         │
│  - Tiene credenciales de BD principal (DATABASE_URL)            │
│  - NO tiene credenciales de BD T2 (DATABASE_URL_T2)             │
│  - Si accede directo: solo ve T1, T2 es invisible               │
└─────────────────────────────────────────────────────────────────┘
```

### Configuración en servidor

La app tiene ambas credenciales en `.env` (servidor):

```bash
# BD Principal - todos los técnicos pueden ver esta
DATABASE_URL="postgresql://..."

# BD T2 - SOLO en .env del servidor, nunca compartir
DATABASE_URL_T2="postgresql://..."
```

**Importante**:
- El técnico tiene acceso a `DATABASE_URL` para debugging
- El técnico NO tiene acceso a `DATABASE_URL_T2` (solo está en producción)
- La app usa `DATABASE_URL_T2` internamente cuando detecta modo Extended

### Sin cambios al flujo actual

El sistema de hotkey/PIN actual sigue funcionando igual:
1. `lib/view-mode/cookie.ts` - maneja la cookie `_vm`
2. `lib/view-mode/get-mode.ts` - detecta el modo del request
3. Solo cambia: en lugar de filtrar T2 en la misma BD, consulta otra BD

---

## Paso 8: Control de Acceso desde /superadmin

### Panel Superadmin

El superadmin puede habilitar/deshabilitar acceso a T2 por empresa:

```
/superadmin → ViewMode Config → Empresa X
┌─────────────────────────────────────────────┐
│  Configuración T2 - Empresa X               │
├─────────────────────────────────────────────┤
│  ☑ Habilitar modo T2                        │
│  Hotkey: Ctrl+Shift+E                       │
│  PIN: ****                                  │
│  Timeout sesión: 30 min                     │
│                                             │
│  ☑ Conectar a BD secundaria                 │
│    (si está deshabilitado, T2 no existe)   │
└─────────────────────────────────────────────┘
```

### Modelo actualizado

```prisma
model CompanyViewConfig {
  id              String   @id @default(uuid())
  companyId       Int      @unique
  enabled         Boolean  @default(false)  // Habilita ViewMode T2
  hotkey          String?
  pinHash         String?
  sessionTimeout  Int      @default(30)
  tiposT2         String[] @default([])

  // NUEVO: Control de BD T2
  t2DbEnabled     Boolean  @default(false)  // Si true, consulta BD T2

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Flujo con control de superadmin

```typescript
// lib/view-mode/should-query-t2.ts

export async function shouldQueryT2(
  companyId: number,
  mode: ViewMode
): Promise<boolean> {
  // 1. No está en modo Extended
  if (mode !== MODE.EXTENDED) return false;

  // 2. No hay BD T2 configurada en servidor
  if (!process.env.DATABASE_URL_T2) return false;

  // 3. Verificar si superadmin habilitó T2 para esta empresa
  const config = await prisma.companyViewConfig.findUnique({
    where: { companyId }
  });

  if (!config?.enabled || !config?.t2DbEnabled) return false;

  return true;
}
```

### API actualizada

```typescript
// app/api/compras/comprobantes/route.ts

export async function GET(request: Request) {
  const mode = await getViewMode(request);
  const { companyId } = await getCompanyContext(request);

  // T1: Siempre de BD principal
  const t1Receipts = await prisma.purchaseReceipt.findMany({
    where: { companyId, docType: { not: 'T2' } },  // Excluir T2 legacy
    include: { supplier: true }
  });

  // T2: Solo si permitido por superadmin
  let t2Receipts = [];
  if (await shouldQueryT2(companyId, mode)) {
    const t2Raw = await prismaT2.t2PurchaseReceipt.findMany({
      where: { companyId }
    });

    // Enriquecer con datos de BD principal
    t2Receipts = await enrichT2WithMasterData(t2Raw);
  }

  return Response.json([...t1Receipts, ...t2Receipts]);
}
```

### Si superadmin deshabilita T2

- El usuario con hotkey presiona la combinación
- El sistema verifica `config.t2DbEnabled`
- Si está deshabilitado: muestra mensaje "Modo extendido no disponible"
- Los datos T2 quedan en la BD secundaria pero inaccesibles desde la app

---

## Resumen de Archivos a Crear/Modificar

### Crear:
1. `prisma/schema-t2.prisma` - Schema de BD T2
2. `lib/prisma-t2.ts` - Cliente Prisma T2
3. `prisma/migrate-t2-data.ts` - Script migración

### Modificar:
4. `.env` - Agregar DATABASE_URL_T2
5. `lib/view-mode/prisma-helper.ts` - Actualizar helpers
6. APIs que manejan T2:
   - `app/api/compras/comprobantes/route.ts`
   - `app/api/compras/stock/route.ts`
   - `app/api/compras/ordenes-pago/route.ts`
   - `app/api/compras/cuenta-corriente/route.ts`
   - `app/api/ventas/facturas/route.ts`
   - `app/api/tesoreria/*`
   - etc.

---

## Consideraciones

### Ventajas:
- Separación física total
- Credenciales independientes
- Un técnico con acceso a BD principal no ve T2
- Backups separados posibles

### Desventajas:
- Más complejidad en código
- Queries más lentos (2 BDs + join manual)
- Costo adicional (segunda BD en Neon)
- Sincronización de entidades maestras

### Alternativa más simple:
Si solo querés que el técnico no vea T2 al conectarse directo, podrías:
- Crear un usuario PostgreSQL con permisos limitados
- Usar Row-Level Security policies
- Esto evita la complejidad de 2 BDs
