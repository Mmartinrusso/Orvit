# 🚨 DESCUBRIMIENTO CRÍTICO: Módulo de Tesorería Completamente Roto

## Severidad: CATASTRÓFICA

**Status**: 🔴 BLOQUEANTE TOTAL
**Impacto**: El módulo de Tesorería NO FUNCIONA desde su creación
**Alcance**: 100% de funcionalidades de Tesorería afectadas

---

## El Problema

Se descubrió que **TODO el módulo de Tesorería** intenta usar un modelo `TreasuryMovement` que **NUNCA SE CREÓ** en la base de datos.

### Arquitectura Planeada vs Realidad

```typescript
// ═══════════════════════════════════════════════════════════════════════
// ARQUITECTURA PLANEADA (Nunca implementada)
// ═══════════════════════════════════════════════════════════════════════

model TreasuryMovement {
  id            Int      @id @default(autoincrement())
  fecha         DateTime
  tipo          TreasuryMovementType  // INGRESO | EGRESO
  medio         PaymentMedium
  monto         Decimal
  accountType   TreasuryAccountType   // CASH | BANK | CHECK_PORTFOLIO
  cashAccountId   Int?
  bankAccountId   Int?
  chequeId        Int?
  // ... campos unificados
}

// ❌ ESTE MODELO NO EXISTE EN schema.prisma


// ═══════════════════════════════════════════════════════════════════════
// ARQUITECTURA REAL (Lo que SÍ existe)
// ═══════════════════════════════════════════════════════════════════════

model CashMovement {
  id              Int      @id @default(autoincrement())
  cashAccountId   Int
  tipo            String   // INGRESO | EGRESO
  ingreso         Decimal
  egreso          Decimal
  saldoAnterior   Decimal
  saldoPosterior  Decimal
  fecha           DateTime
  descripcion     String?
  clientPaymentId Int?     // ✅ FK existe
  // ...
}

model BankMovement {
  id              Int      @id @default(autoincrement())
  bankAccountId   Int
  tipo            String
  ingreso         Decimal
  egreso          Decimal
  saldoAnterior   Decimal
  saldoPosterior  Decimal
  fecha           DateTime
  fechaValor      DateTime?
  descripcion     String?
  clientPaymentId Int?     // ✅ FK existe
  chequeId        Int?
  // ...
}
```

---

## Archivos Afectados (TODO EL MÓDULO)

### 1. Servicio Base (Completamente Inválido)

**`lib/tesoreria/treasury-movement-service.ts`**
- ❌ Línea 67: `await client.treasuryMovement.create({ ... })` - FALLA
- ❌ Línea 247: `await client.treasuryMovement.findUnique({ ... })` - FALLA
- ❌ Línea 263: `await client.treasuryMovement.create({ ... })` - FALLA
- ❌ Línea 293: `await client.treasuryMovement.update({ ... })` - FALLA
- ❌ Línea 331: `await client.treasuryMovement.findMany({ ... })` - FALLA

**Funciones Rotas**:
```typescript
✗ createTreasuryMovement()           // Crea movimiento (NO FUNCIONA)
✗ createPaymentMovements()           // Para pagos de clientes (NO FUNCIONA)
✗ reverseTreasuryMovement()          // Reversa movimientos (NO FUNCIONA)
✗ reversePaymentMovements()          // Reversa pagos (NO FUNCIONA)
✗ createCashDeposit()                // Depósitos (NO FUNCIONA)
✗ createCashClosing()                // Cierres de caja (NO FUNCIONA)
✗ approveCashClosingWithAdjustment() // Aprobación de cierres (NO FUNCIONA)
✗ getTreasuryPosition()              // Posición de tesorería (FUNCIONA - no usa TreasuryMovement)
```

### 2. API Routes (Todas Rotas)

| Archivo | Función | Status |
|---------|---------|--------|
| `app/api/tesoreria/movimientos/route.ts` | GET - Listar movimientos | ❌ FALLA (línea 71: `treasuryMovement.findMany`) |
| `app/api/tesoreria/movimientos/route.ts` | POST - Crear movimiento manual | ❌ FALLA (línea 147: `createTreasuryMovement`) |
| `app/api/tesoreria/movimientos/[id]/route.ts` | DELETE - Reversar movimiento | ❌ FALLA (usa `reverseTreasuryMovement`) |
| `app/api/tesoreria/depositos/route.ts` | POST - Crear depósito | ❌ FALLA (usa `createCashDeposit`) |
| `app/api/tesoreria/cierres/route.ts` | POST - Crear cierre de caja | ❌ FALLA (usa `createCashClosing`) |
| `app/api/tesoreria/cierres/[id]/route.ts` | POST - Aprobar cierre | ❌ FALLA (usa `approveCashClosingWithAdjustment`) |

### 3. Funcionalidades Afectadas

#### Completamente Inoperativas:
1. ✗ **Movimientos Manuales de Caja/Banco** - No se pueden crear
2. ✗ **Depósitos Bancarios** - No se pueden registrar
3. ✗ **Cierres de Caja (Arqueos)** - No se pueden crear ni aprobar
4. ✗ **Reversiones de Movimientos** - No funcionan
5. ✗ **Consulta de Movimientos** - La lista está vacía (no hay TreasuryMovement)
6. ✗ **Conciliación Bancaria** - No hay movimientos para conciliar
7. ✗ **Reportes de Tesorería** - Sin datos

#### Parcialmente Afectadas:
1. ⚠️ **Pagos de Clientes** - YA ARREGLADO en payment-service.ts
2. ⚠️ **Posición de Tesorería** - FUNCIONA (lee de CashAccount/BankAccount directamente)
3. ⚠️ **Gestión de Cheques** - FUNCIONA PARCIALMENTE (Cheque model existe, pero depositar falla)

---

## Impacto en Producción

### Errores del Usuario

```typescript
// Usuario intenta crear movimiento manual
POST /api/tesoreria/movimientos
{
  "fecha": "2026-02-06",
  "tipo": "INGRESO",
  "medio": "EFECTIVO",
  "monto": 10000,
  "accountType": "CASH",
  "cashAccountId": 1,
  "descripcion": "Venta mostrador"
}

// ❌ RESULTADO: Error 500
PrismaClientValidationError: Invalid `prisma.treasuryMovement.create()` invocation:
  Unknown arg `data` in data.treasuryMovement.create() for type treasuryMovement.
  Available args:
    - None (model does not exist)
```

```typescript
// Usuario intenta hacer depósito bancario
POST /api/tesoreria/depositos
{
  "fecha": "2026-02-06",
  "cashAccountId": 1,
  "bankAccountId": 2,
  "efectivo": 50000,
  "cheques": 0
}

// ❌ RESULTADO: Error 500
PrismaClientValidationError: Invalid `prisma.treasuryMovement.create()` invocation
```

```typescript
// Usuario intenta cerrar caja
POST /api/tesoreria/cierres
{
  "cashAccountId": 1,
  "fecha": "2026-02-06",
  "arqueoEfectivo": 48500,
  "arqueoCheques": 0
}

// ❌ RESULTADO: Error 500
PrismaClientValidationError: Invalid `prisma.treasuryMovement.create()` invocation
```

### Datos Perdidos

```sql
-- ✅ CashAccount y BankAccount existen y tienen saldos
SELECT * FROM cash_accounts;
-- id | nombre        | saldo_actual
-- 1  | Caja Principal| 25000.00

SELECT * FROM bank_accounts;
-- id | nombre      | saldo_contable
-- 2  | Banco Nación| 150000.00

-- ❌ Pero NO HAY movimientos en TreasuryMovement
SELECT * FROM treasury_movements;
-- ERROR: relation "treasury_movements" does not exist

-- ✅ SÍ HAY movimientos en CashMovement (desde pagos que arreglé)
SELECT * FROM cash_movements WHERE client_payment_id IS NOT NULL;
-- (Movimientos de pagos después del fix)

-- ❌ PERO NO HAY movimientos manuales/depósitos/cierres
SELECT * FROM cash_movements WHERE client_payment_id IS NULL;
-- (Vacío - nunca se pudieron crear)
```

---

## Causa Raíz: Diseño Nunca Completado

Parece que hubo un intento de crear una "arquitectura unificada" con un modelo `TreasuryMovement` que consolidaría todos los movimientos de tesorería, pero:

1. ❌ **Nunca se creó la migración de Prisma** para el modelo
2. ❌ **Se escribió el código asumiendo que existía**
3. ❌ **CashMovement y BankMovement se marcaron como "legacy"** (comentario en treasury-movement-service.ts línea 8)
4. ✅ **Pero CashMovement/BankMovement SON los únicos que existen**

**Comentario engañoso** en `lib/tesoreria/treasury-movement-service.ts`:
```typescript
/**
 * IMPORTANT: This is the source of truth for all treasury operations.
 * CashMovement and BankMovement are legacy - use this service instead.
 */
```

**Realidad**: Es al revés - TreasuryMovement nunca existió, CashMovement/BankMovement son la realidad.

---

## Soluciones Posibles

### Opción A: Crear Modelo TreasuryMovement (COMPLEJO)

**Ventajas**:
- Arquitectura "limpia" con un solo modelo unificado
- Cumple con la intención original del diseño

**Desventajas**:
- ❌ Requiere migración de Prisma compleja
- ❌ Necesita migrar datos existentes de CashMovement/BankMovement
- ❌ Cambios masivos en todo el código
- ❌ Riesgo de pérdida de datos
- ❌ Downtime en producción
- ❌ Relaciones FK deben reconfigurarse

**Estimación**: 2-3 días de trabajo + riesgo alto

### Opción B: Usar CashMovement/BankMovement (RECOMENDADO) ✅

**Ventajas**:
- ✅ Modelos ya existen y están probados
- ✅ Relaciones FK ya configuradas
- ✅ No requiere migración de datos
- ✅ Menos riesgoso
- ✅ Más específico (campos apropiados para cada tipo)
- ✅ Se puede hacer incrementalmente

**Desventajas**:
- Código duplicado entre cash y bank
- Dos tablas en lugar de una

**Estimación**: 4-6 horas de trabajo + bajo riesgo

---

## Recomendación: Opción B

Usar los modelos existentes `CashMovement` y `BankMovement` porque:

1. **Ya arreglé payment-service.ts** usando este approach
2. **Los modelos existen** y tienen todas las relaciones
3. **Cero riesgo** de pérdida de datos
4. **Más rápido** de implementar
5. **Campos específicos** (ej: `fechaValor` solo en BankMovement)

### Archivos a Modificar (Opción B)

1. **Eliminar o marcar como deprecated**:
   - `lib/tesoreria/treasury-movement-service.ts`

2. **Crear nuevo servicio correcto**:
   - `lib/tesoreria/cash-movement-service.ts` (basado en treasury-integration-helper.ts)
   - `lib/tesoreria/bank-movement-service.ts` (similar)

3. **Actualizar API routes** (5 archivos):
   - `app/api/tesoreria/movimientos/route.ts`
   - `app/api/tesoreria/movimientos/[id]/route.ts`
   - `app/api/tesoreria/depositos/route.ts`
   - `app/api/tesoreria/cierres/route.ts`
   - `app/api/tesoreria/cierres/[id]/route.ts`

4. **Actualizar validation schemas**:
   - `lib/tesoreria/validation-schemas.ts`

---

## Estado Actual

| Módulo | Status | Comentario |
|--------|--------|------------|
| **Pagos de Clientes (Ventas)** | ✅ ARREGLADO | Usa CashMovement/BankMovement |
| **Movimientos Manuales (Tesorería)** | ❌ ROTO | Intenta usar TreasuryMovement |
| **Depósitos (Tesorería)** | ❌ ROTO | Intenta usar TreasuryMovement |
| **Cierres de Caja (Tesorería)** | ❌ ROTO | Intenta usar TreasuryMovement |
| **Conciliación (Tesorería)** | ⚠️ PARCIAL | Lee de modelos correctos pero no puede crear |
| **Posición de Tesorería** | ✅ FUNCIONA | Lee saldos directos de CashAccount/BankAccount |

---

## Próximos Pasos Recomendados

### Fase 1: Decisión (AHORA)
- [ ] Usuario confirma Opción A o B
- [ ] Si Opción B → Continuar con fix

### Fase 2: Implementación Opción B (4-6 horas)
- [ ] Crear `lib/tesoreria/cash-movement-service.ts`
- [ ] Crear `lib/tesoreria/bank-movement-service.ts`
- [ ] Actualizar `/movimientos/route.ts` (POST, GET)
- [ ] Actualizar `/movimientos/[id]/route.ts` (DELETE)
- [ ] Actualizar `/depositos/route.ts`
- [ ] Actualizar `/cierres/route.ts` y `/cierres/[id]/route.ts`
- [ ] Actualizar validation schemas
- [ ] Marcar `treasury-movement-service.ts` como deprecated

### Fase 3: Testing
- [ ] Test movimientos manuales (cash, bank)
- [ ] Test depósitos bancarios
- [ ] Test cierres de caja
- [ ] Test conciliación bancaria
- [ ] Test reversiones

### Fase 4: Migración Frontend (si aplica)
- [ ] Verificar componentes UI de Tesorería
- [ ] Actualizar tipos TypeScript
- [ ] Test E2E del módulo

---

## Conclusión

Este es un **bug arquitectónico crítico** que afecta al 100% del módulo de Tesorería. El código fue escrito asumiendo que existía un modelo `TreasuryMovement` unificado que nunca se implementó en la base de datos.

**Recomendación FUERTE**: Opción B (usar CashMovement/BankMovement) por:
- ✅ Menor riesgo
- ✅ Más rápido
- ✅ Ya probado en payment-service.ts
- ✅ No requiere migración de datos
- ✅ Consistente con el schema actual

**Impacto si no se arregla**: El módulo de Tesorería permanecerá 100% inoperativo.
