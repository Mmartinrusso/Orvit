# 🚨 CRITICAL FIX: PENDIENTE Payments Treasury Integration

## Severidad: CRITICAL

**Status**: ✅ FIXED
**Date**: 2026-02-07
**Affected Module**: Ventas - Payment Service

---

## El Problema

### Comportamiento Incorrecto (Antes del Fix)

Cuando se creaba un pago con `estadoInicial='PENDIENTE'`:

1. ✅ Payment record created in `client_payments`
2. ✅ **Treasury movements CREATED immediately** (CashMovement/BankMovement)
3. ❌ Invoice balances **NOT updated** (conditional on CONFIRMADO)
4. ❌ Client balance **NOT updated** (conditional on CONFIRMADO)
5. ❌ Ledger entry **NOT created** (conditional on CONFIRMADO)

Cuando se aprobaba después con `approveClientPayment()`:

1. ✅ Payment status → CONFIRMADO
2. ✅ Invoice balances updated
3. ✅ Client balance updated
4. ✅ Ledger entry created
5. ❌ **NO treasury movements created** (ya existían)

### Consecuencia: Desincronización Treasury-Contabilidad

**Escenario de Bug**:
```typescript
// T0: Create PENDIENTE payment
await createClientPayment({
  medios: [{ tipo: 'EFECTIVO', monto: 10000, accountId: 1 }],
  estadoInicial: 'PENDIENTE',
  ...
});

// Estado del sistema:
CashAccount.saldoActual = +10000 ✅ (dinero en caja)
Client.currentDebt = sin cambios ❌ (cliente NO acreditado)
Invoice.saldoPendiente = sin cambios ❌ (factura NO cobrada)
ClientLedgerEntry = sin crear ❌ (NO hay asiento contable)

// T1: Approve payment (horas/días después)
await approveClientPayment(paymentId);

// Estado del sistema:
CashAccount.saldoActual = +10000 ✅ (sin cambios - ya estaba)
Client.currentDebt = -10000 ✅ (ahora sí acreditado)
Invoice.saldoPendiente = -10000 ✅ (ahora sí cobrada)
ClientLedgerEntry.haber = 10000 ✅ (asiento creado)
```

**Problema**: Entre T0 y T1, la tesorería muestra $10,000 de más, pero contablemente el cliente NO está acreditado. Reconciliación treasury-contabilidad rota.

---

## La Causa Raíz

### Código Problemático (payment-service.ts líneas 206-303)

```typescript
// ❌ ANTES DEL FIX:
// Treasury movements se creaban SIEMPRE (sin condicional)

const payment = await tx.clientPayment.create({ estado: estadoInicial, ... });

// Create treasury movements for each payment medium
for (const medio of medios) {
  if (medio.tipo === 'EFECTIVO' && medio.accountId) {
    await createCashMovementFromPayment({ paymentId: payment.id, ... });
  }
  // ... otros medios
}

// ⚠️ Pero los invoices/balance SOLO se actualizaban si CONFIRMADO
if (estadoInicial === 'CONFIRMADO') {
  // Update invoices, create ledger, update balance
}
```

### Por Qué Esto Es Crítico

1. **Pagos PENDIENTE son comunes** en estos escenarios:
   - Cheques que necesitan compensar
   - Transferencias pendientes de verificación
   - Pagos que requieren aprobación gerencial
   - Tarjetas con acreditación diferida

2. **Reconciliación rota**:
   - Posición de tesorería incorrecta durante días
   - Reportes de caja/banco muestran saldo inflado
   - Cuenta corriente cliente desincronizada

3. **Reversión complicada**:
   - Si el pago se rechaza, hay que reversar los movimientos de tesorería manualmente

---

## La Solución

### 1. Agregar Campo `mediosData` (JSON)

**Migración**: `prisma/migrations/add_payment_medios_json.sql`

```sql
ALTER TABLE client_payments ADD COLUMN medios_data JSONB;
CREATE INDEX idx_client_payments_medios_data ON client_payments USING GIN (medios_data);
```

**Schema Update** (`prisma/schema.prisma`):

```prisma
model ClientPayment {
  // ... existing fields

  notas String?

  // NEW: Store payment medium details
  mediosData Json? // [{ tipo, monto, accountId, accountType, numeroComprobante, fechaAcreditacion, chequeData }]

  docType DocType @default(T1)
  // ...
}
```

**Propósito**: Persistir los detalles de medios de pago (cuentas usadas, comprobantes, etc.) para poder crear movimientos de tesorería cuando se apruebe un pago PENDIENTE.

---

### 2. Modificar `createClientPayment()` (payment-service.ts)

#### 2.1 Guardar mediosData

```typescript
const payment = await tx.clientPayment.create({
  data: {
    // ... existing fields
    mediosData: medios as any, // ✅ NUEVO: Guardar array de medios
    estado: estadoInicial,
    // ...
  },
});
```

#### 2.2 Condicionar Creación de Movimientos de Tesorería

```typescript
// ✅ NUEVO: SOLO crear movimientos si CONFIRMADO
if (estadoInicial === 'CONFIRMADO') {
  // Create treasury movements for each payment medium
  for (const medio of medios) {
    if (medio.monto <= 0) continue;

    // EFECTIVO → CashMovement
    if (medio.tipo === 'EFECTIVO' && medio.accountId) {
      const { id } = await createCashMovementFromPayment({
        paymentId: payment.id,
        cashAccountId: medio.accountId,
        tipo: 'INGRESO',
        monto: medio.monto,
        fecha: fechaPago,
        descripcion: `Cobro ${sequence.formatted} - ${client.name || client.legalName}`,
        companyId,
        userId,
        tx,
      });
      cashMovementIds.push(id);
    }

    // TRANSFERENCIA → BankMovement
    if (medio.tipo === 'TRANSFERENCIA' && medio.accountId) {
      const { id } = await createBankMovementFromPayment({
        paymentId: payment.id,
        bankAccountId: medio.accountId,
        tipo: 'INGRESO',
        monto: medio.monto,
        fecha: fechaPago,
        fechaValor: medio.fechaAcreditacion || fechaPago,
        descripcion: `Transferencia ${sequence.formatted}...`,
        companyId,
        userId,
        tx,
      });
      bankMovementIds.push(id);
    }

    // ... TARJETA_CREDITO, TARJETA_DEBITO, etc.
  }
} // ✅ End if (estadoInicial === 'CONFIRMADO')

// Allocations y ledger entries siguen con su condicional existente
if (estadoInicial === 'CONFIRMADO') {
  // Update invoices, create ledger, update balance
}
```

---

### 3. Modificar `approveClientPayment()` (payment-service.ts)

**Agregar creación de treasury movements al aprobar**:

```typescript
export async function approveClientPayment(
  paymentId: number,
  userId: number,
  notas?: string
): Promise<void> {
  const payment = await prisma.clientPayment.findUnique({
    where: { id: paymentId },
    include: {
      allocations: { include: { invoice: true } },
      client: true,
    },
  });

  if (!payment) throw new Error('Pago no encontrado');
  if (payment.estado !== 'PENDIENTE') {
    throw new Error(`El pago ya está ${payment.estado}. Solo se pueden aprobar pagos PENDIENTES.`);
  }

  await prisma.$transaction(
    async (tx) => {
      // 1. Update payment to CONFIRMADO
      await tx.clientPayment.update({
        where: { id: paymentId },
        data: { estado: 'CONFIRMADO', notas: ..., updatedAt: new Date() },
      });

      // 2. Update allocated invoices
      for (const alloc of payment.allocations) {
        // ... existing code
      }

      // 3. Create ledger entry
      await tx.clientLedgerEntry.create({ ... });

      // 4. Update client balance
      await tx.client.update({
        where: { id: payment.clientId },
        data: { currentDebt: { decrement: Number(payment.totalPago) } },
      });

      // ✅ 5. NUEVO: Create treasury movements from mediosData
      if (payment.mediosData && Array.isArray(payment.mediosData)) {
        const medios = payment.mediosData as PaymentMedium[];

        for (const medio of medios) {
          if (medio.monto <= 0) continue;

          // EFECTIVO → CashMovement
          if (medio.tipo === 'EFECTIVO' && medio.accountId) {
            await createCashMovementFromPayment({
              paymentId: payment.id,
              cashAccountId: medio.accountId,
              tipo: 'INGRESO',
              monto: medio.monto,
              fecha: payment.fechaPago,
              descripcion: `Cobro ${payment.numero} (Aprobado) - ${payment.client.name || payment.client.legalName}`,
              companyId: payment.companyId,
              userId,
              tx,
            });
          }

          // TRANSFERENCIA → BankMovement
          if (medio.tipo === 'TRANSFERENCIA' && medio.accountId) {
            await createBankMovementFromPayment({
              paymentId: payment.id,
              bankAccountId: medio.accountId,
              tipo: 'INGRESO',
              monto: medio.monto,
              fecha: payment.fechaPago,
              fechaValor: medio.fechaAcreditacion || payment.fechaPago,
              descripcion: `Transferencia ${payment.numero} (Aprobado)...`,
              companyId: payment.companyId,
              userId,
              tx,
            });
          }

          // TARJETA_CREDITO → BankMovement
          if (medio.tipo === 'TARJETA_CREDITO' && medio.accountId) {
            await createBankMovementFromPayment({
              paymentId: payment.id,
              bankAccountId: medio.accountId,
              tipo: 'INGRESO',
              monto: medio.monto,
              fecha: payment.fechaPago,
              fechaValor: medio.fechaAcreditacion || undefined,
              descripcion: `Tarjeta Crédito ${payment.numero} (Aprobado)...`,
              companyId: payment.companyId,
              userId,
              tx,
            });
          }

          // TARJETA_DEBITO → BankMovement
          if (medio.tipo === 'TARJETA_DEBITO' && medio.accountId) {
            await createBankMovementFromPayment({
              paymentId: payment.id,
              bankAccountId: medio.accountId,
              tipo: 'INGRESO',
              monto: medio.monto,
              fecha: payment.fechaPago,
              descripcion: `Tarjeta Débito ${payment.numero} (Aprobado)...`,
              companyId: payment.companyId,
              userId,
              tx,
            });
          }

          // CHEQUE - NO crear movimientos aquí
          // Los cheques se rastrean via Cheque model
          // y se depositan via /api/tesoreria/cheques/[id]/acciones
        }
      }
    },
    { timeout: 15000 }
  );
}
```

---

## Comportamiento Correcto (Después del Fix)

### Escenario 1: Payment CONFIRMADO (inmediato)

```typescript
await createClientPayment({
  medios: [{ tipo: 'EFECTIVO', monto: 10000, accountId: 1 }],
  estadoInicial: 'CONFIRMADO', // ✅ Inmediato
  ...
});
```

**Resultado**:
1. ✅ ClientPayment created with estado=CONFIRMADO
2. ✅ **mediosData stored** (para auditoría)
3. ✅ **Treasury movements created** (CashMovement)
4. ✅ Invoice balances updated
5. ✅ Client balance updated
6. ✅ Ledger entry created

**Estado del sistema**:
```typescript
CashAccount.saldoActual = +10000 ✅
Client.currentDebt = -10000 ✅
Invoice.saldoPendiente = -10000 ✅
ClientLedgerEntry.haber = 10000 ✅
```

Todo sincronizado. ✅

---

### Escenario 2: Payment PENDIENTE (aprobación posterior)

#### T0: Create PENDIENTE

```typescript
await createClientPayment({
  medios: [{ tipo: 'TRANSFERENCIA', monto: 15000, accountId: 2, numeroComprobante: 'TR-12345' }],
  estadoInicial: 'PENDIENTE', // ⏳ Requiere aprobación
  ...
});
```

**Resultado**:
1. ✅ ClientPayment created with estado=PENDIENTE
2. ✅ **mediosData stored** (para usar al aprobar)
3. ❌ **NO treasury movements** (condicional)
4. ❌ **NO invoice updates** (condicional)
5. ❌ **NO balance updates** (condicional)
6. ❌ **NO ledger entry** (condicional)

**Estado del sistema**:
```typescript
BankAccount.saldoContable = sin cambios ✅ (dinero NO acreditado aún)
Client.currentDebt = sin cambios ✅ (cliente NO acreditado aún)
Invoice.saldoPendiente = sin cambios ✅ (factura NO cobrada aún)
ClientLedgerEntry = sin crear ✅ (NO hay asiento aún)
```

Todo CORRECTO - pendiente de aprobación. ✅

#### T1: Approve Payment

```typescript
await approveClientPayment(paymentId, userId, 'Transferencia verificada');
```

**Resultado**:
1. ✅ ClientPayment.estado → CONFIRMADO
2. ✅ **Treasury movements created** (desde mediosData)
3. ✅ Invoice balances updated
4. ✅ Client balance updated
5. ✅ Ledger entry created

**Estado del sistema**:
```typescript
BankAccount.saldoContable = +15000 ✅ (AHORA sí acreditado)
Client.currentDebt = -15000 ✅ (cliente acreditado)
Invoice.saldoPendiente = -15000 ✅ (factura cobrada)
ClientLedgerEntry.haber = 15000 ✅ (asiento creado)
```

Todo sincronizado. ✅

---

## Archivos Modificados

### 1. `prisma/schema.prisma`
- **Change**: Added `mediosData Json?` field to `ClientPayment` model
- **Purpose**: Store payment medium details for creating treasury movements on approval

### 2. `prisma/migrations/add_payment_medios_json.sql` (NEW)
- **SQL**: `ALTER TABLE client_payments ADD COLUMN medios_data JSONB;`
- **Index**: `CREATE INDEX idx_client_payments_medios_data ON client_payments USING GIN (medios_data);`

### 3. `lib/ventas/payment-service.ts`
- **Function**: `createClientPayment()`
  - Added `mediosData: medios` to payment creation
  - Wrapped treasury movement creation in `if (estadoInicial === 'CONFIRMADO')`

- **Function**: `approveClientPayment()`
  - Added treasury movement creation from `mediosData`
  - Creates CashMovement/BankMovement for EFECTIVO, TRANSFERENCIA, TARJETA_CREDITO, TARJETA_DEBITO

### 4. `CRITICAL_FIX_PENDIENTE_PAYMENTS.md` (NEW)
- **Purpose**: Comprehensive documentation of the bug and fix

---

## Testing Checklist

### Test Case 1: CONFIRMADO Payment (No Change)
```bash
# Should work exactly as before (treasury + contabilidad in sync)
POST /api/ventas/pagos
{
  "clientId": "CLI-001",
  "totalPago": 10000,
  "medios": [{ "tipo": "EFECTIVO", "monto": 10000, "accountId": 1 }],
  "estadoInicial": "CONFIRMADO",
  "allocations": [{ "invoiceId": 1, "monto": 10000 }]
}

# ✅ Verify:
# - CashMovement created immediately
# - Client.currentDebt decremented
# - Invoice.saldoPendiente = 0
# - ClientLedgerEntry created
```

### Test Case 2: PENDIENTE → Approved
```bash
# Step 1: Create PENDIENTE payment
POST /api/ventas/pagos
{
  "clientId": "CLI-002",
  "totalPago": 15000,
  "medios": [{ "tipo": "TRANSFERENCIA", "monto": 15000, "accountId": 2, "numeroComprobante": "TR-99" }],
  "estadoInicial": "PENDIENTE",
  "allocations": [{ "invoiceId": 2, "monto": 15000 }]
}

# ✅ Verify T0:
# - NO BankMovement created
# - Client.currentDebt unchanged
# - Invoice.saldoPendiente unchanged
# - mediosData stored in payment

# Step 2: Approve payment
POST /api/ventas/pagos/123/aprobar
{ "accion": "aprobar", "notas": "Transferencia verificada" }

# ✅ Verify T1:
# - BankMovement created NOW
# - Client.currentDebt decremented
# - Invoice.saldoPendiente = 0
# - ClientLedgerEntry created
```

### Test Case 3: PENDIENTE → Rejected
```bash
# Step 1: Create PENDIENTE payment
POST /api/ventas/pagos
{
  "clientId": "CLI-003",
  "totalPago": 5000,
  "medios": [{ "tipo": "EFECTIVO", "monto": 5000, "accountId": 1 }],
  "estadoInicial": "PENDIENTE",
  "allocations": [{ "invoiceId": 3, "monto": 5000 }]
}

# Step 2: Reject payment
POST /api/ventas/pagos/124/aprobar
{ "accion": "rechazar", "motivo": "Fondos insuficientes" }

# ✅ Verify:
# - NO CashMovement created (neither at creation nor rejection)
# - Client.currentDebt unchanged
# - Invoice.saldoPendiente unchanged
# - Payment.estado = RECHAZADO
```

### Test Case 4: Multiple Medios
```bash
POST /api/ventas/pagos
{
  "totalPago": 20000,
  "medios": [
    { "tipo": "EFECTIVO", "monto": 5000, "accountId": 1 },
    { "tipo": "TRANSFERENCIA", "monto": 10000, "accountId": 2, "numeroComprobante": "TR-100" },
    { "tipo": "TARJETA_CREDITO", "monto": 5000, "accountId": 3 }
  ],
  "estadoInicial": "PENDIENTE",
  "allocations": [{ "invoiceId": 4, "monto": 20000 }]
}

# Approve
POST /api/ventas/pagos/125/aprobar
{ "accion": "aprobar" }

# ✅ Verify:
# - 1 CashMovement created (EFECTIVO)
# - 2 BankMovements created (TRANSFERENCIA + TARJETA_CREDITO)
# - All movements reference paymentId=125
```

---

## Impacto en Producción

### Datos Existentes

**Pagos creados ANTES del fix con estado PENDIENTE**:
- ✅ Pueden tener treasury movements creados prematuramente
- ⚠️ **Acción requerida**: Verificar manualmente si hay desincronización
- 🔧 **Script de reconciliación** (opcional):

```sql
-- Find PENDIENTE payments with existing treasury movements
SELECT
  cp.id,
  cp.numero,
  cp.estado,
  cp.total_pago,
  COUNT(cm.id) as cash_movements,
  COUNT(bm.id) as bank_movements
FROM client_payments cp
LEFT JOIN cash_movements cm ON cm.client_payment_id = cp.id
LEFT JOIN bank_movements bm ON bm.client_payment_id = cp.id
WHERE cp.estado = 'PENDIENTE'
  AND (cm.id IS NOT NULL OR bm.id IS NOT NULL)
GROUP BY cp.id, cp.numero, cp.estado, cp.total_pago;

-- If any results: manually review and potentially reverse movements
```

**Pagos creados DESPUÉS del fix**:
- ✅ Comportamiento correcto garantizado
- ✅ No requiere acción

---

## Conclusión

Este fix garantiza la **sincronización treasury-contabilidad** para pagos PENDIENTE:

1. ✅ **CONFIRMADO payments**: Treasury movements creados inmediatamente (comportamiento existente)
2. ✅ **PENDIENTE payments**: Treasury movements creados AL APROBAR (nuevo comportamiento)
3. ✅ **RECHAZADO payments**: NO se crean treasury movements nunca
4. ✅ **Reconciliación**: Tesorería y contabilidad siempre sincronizadas
5. ✅ **Auditoría**: mediosData persistido para trazabilidad completa

**Resultado**: Sistema de pagos robusto con aprobación en dos pasos y reconciliación contable correcta. ✅
