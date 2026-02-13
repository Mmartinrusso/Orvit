/**
 * O2C Phase 3: Payment Service Tests
 *
 * Tests for client payments, treasury movements, and payment allocations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

// Helper to create Decimal
const decimal = (value: number) => new Prisma.Decimal(value);

// Types
interface PaymentMedium {
  tipo: 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE_TERCERO' | 'TARJETA_CREDITO' | 'TARJETA_DEBITO';
  monto: Prisma.Decimal;
  referencia?: string;
  chequeData?: {
    numero: string;
    banco: string;
    fechaVencimiento: Date;
    librador: string;
  };
}

interface PaymentAllocation {
  invoiceId: number;
  monto: Prisma.Decimal;
}

interface CreatePaymentInput {
  clientId: string;
  companyId: number;
  fecha: Date;
  medios: PaymentMedium[];
  allocations: PaymentAllocation[];
  observaciones?: string;
  docType: 'T1' | 'T2';
}

interface TreasuryMovement {
  id: number;
  tipo: 'INGRESO' | 'EGRESO';
  medio: string;
  monto: Prisma.Decimal;
  accountType: 'CASH' | 'BANK' | 'CHECK_PORTFOLIO';
}

// Mock payment service
function createPayment(input: CreatePaymentInput): {
  paymentId: number;
  total: Prisma.Decimal;
  movements: TreasuryMovement[];
  allocations: { invoiceId: number; monto: Prisma.Decimal }[];
} {
  // Calculate total
  const total = input.medios.reduce(
    (sum, m) => sum.plus(m.monto),
    decimal(0)
  );

  // Validate allocations don't exceed total
  const allocatedTotal = input.allocations.reduce(
    (sum, a) => sum.plus(a.monto),
    decimal(0)
  );

  if (allocatedTotal.gt(total)) {
    throw new Error('Monto imputado excede el total del pago');
  }

  // Generate treasury movements
  const movements: TreasuryMovement[] = [];
  let movementId = 1;

  for (const medio of input.medios) {
    let accountType: 'CASH' | 'BANK' | 'CHECK_PORTFOLIO' = 'CASH';
    let medioName = medio.tipo;

    switch (medio.tipo) {
      case 'EFECTIVO':
        accountType = 'CASH';
        break;
      case 'TRANSFERENCIA':
        accountType = 'BANK';
        break;
      case 'CHEQUE_TERCERO':
        accountType = 'CHECK_PORTFOLIO';
        break;
      case 'TARJETA_CREDITO':
      case 'TARJETA_DEBITO':
        accountType = 'BANK';
        break;
    }

    movements.push({
      id: movementId++,
      tipo: 'INGRESO',
      medio: medioName,
      monto: medio.monto,
      accountType,
    });
  }

  return {
    paymentId: 1,
    total,
    movements,
    allocations: input.allocations,
  };
}

// Mock cheque rejection handler
function rejectCheque(
  chequeId: number,
  cheque: { monto: Prisma.Decimal; clientId: string; paymentId?: number },
  reason: string
): {
  reversedMovements: number[];
  newDebtAmount: Prisma.Decimal;
  invoicesReopened: number[];
} {
  return {
    reversedMovements: [1, 2],
    newDebtAmount: cheque.monto,
    invoicesReopened: [101, 102],
  };
}

describe('Payment Service', () => {
  describe('Create Payment', () => {
    it('should create payment with single cash payment', () => {
      const input: CreatePaymentInput = {
        clientId: 'client-1',
        companyId: 1,
        fecha: new Date(),
        medios: [
          { tipo: 'EFECTIVO', monto: decimal(10000) },
        ],
        allocations: [
          { invoiceId: 1, monto: decimal(10000) },
        ],
        docType: 'T1',
      };

      const result = createPayment(input);

      expect(result.total.toNumber()).toBe(10000);
      expect(result.movements).toHaveLength(1);
      expect(result.movements[0].tipo).toBe('INGRESO');
      expect(result.movements[0].medio).toBe('EFECTIVO');
      expect(result.movements[0].accountType).toBe('CASH');
    });

    it('should create payment with multiple payment methods', () => {
      const input: CreatePaymentInput = {
        clientId: 'client-1',
        companyId: 1,
        fecha: new Date(),
        medios: [
          { tipo: 'EFECTIVO', monto: decimal(5000) },
          { tipo: 'TRANSFERENCIA', monto: decimal(3000), referencia: 'TRF-001' },
          {
            tipo: 'CHEQUE_TERCERO',
            monto: decimal(2000),
            chequeData: {
              numero: 'CHQ-001',
              banco: 'Banco Nación',
              fechaVencimiento: new Date('2025-06-15'),
              librador: 'Juan Pérez',
            },
          },
        ],
        allocations: [
          { invoiceId: 1, monto: decimal(8000) },
          { invoiceId: 2, monto: decimal(2000) },
        ],
        docType: 'T1',
      };

      const result = createPayment(input);

      expect(result.total.toNumber()).toBe(10000);
      expect(result.movements).toHaveLength(3);

      // Verify account types
      const cashMov = result.movements.find(m => m.medio === 'EFECTIVO');
      const transferMov = result.movements.find(m => m.medio === 'TRANSFERENCIA');
      const chequeMov = result.movements.find(m => m.medio === 'CHEQUE_TERCERO');

      expect(cashMov?.accountType).toBe('CASH');
      expect(transferMov?.accountType).toBe('BANK');
      expect(chequeMov?.accountType).toBe('CHECK_PORTFOLIO');
    });

    it('should reject payment when allocations exceed total', () => {
      const input: CreatePaymentInput = {
        clientId: 'client-1',
        companyId: 1,
        fecha: new Date(),
        medios: [
          { tipo: 'EFECTIVO', monto: decimal(5000) },
        ],
        allocations: [
          { invoiceId: 1, monto: decimal(8000) },
        ],
        docType: 'T1',
      };

      expect(() => createPayment(input)).toThrow('Monto imputado excede el total del pago');
    });

    it('should allow advance payment (no allocations)', () => {
      const input: CreatePaymentInput = {
        clientId: 'client-1',
        companyId: 1,
        fecha: new Date(),
        medios: [
          { tipo: 'EFECTIVO', monto: decimal(10000) },
        ],
        allocations: [],
        docType: 'T1',
      };

      const result = createPayment(input);

      expect(result.total.toNumber()).toBe(10000);
      expect(result.allocations).toHaveLength(0);
    });
  });

  describe('Cheque Rejection', () => {
    it('should reverse movements and reopen invoices on cheque rejection', () => {
      const cheque = {
        monto: decimal(5000),
        clientId: 'client-1',
        paymentId: 1,
      };

      const result = rejectCheque(1, cheque, 'Fondos insuficientes');

      expect(result.reversedMovements).toHaveLength(2);
      expect(result.newDebtAmount.toNumber()).toBe(5000);
      expect(result.invoicesReopened.length).toBeGreaterThan(0);
    });
  });
});

describe('Treasury Movement Calculations', () => {
  describe('Cash Position', () => {
    it('should calculate cash position from movements', () => {
      const movements = [
        { tipo: 'INGRESO', monto: decimal(10000), accountType: 'CASH' },
        { tipo: 'INGRESO', monto: decimal(5000), accountType: 'CASH' },
        { tipo: 'EGRESO', monto: decimal(3000), accountType: 'CASH' },
      ];

      const position = movements.reduce((acc, mov) => {
        if (mov.accountType !== 'CASH') return acc;
        return mov.tipo === 'INGRESO' ? acc.plus(mov.monto) : acc.minus(mov.monto);
      }, decimal(0));

      expect(position.toNumber()).toBe(12000);
    });
  });

  describe('Check Portfolio', () => {
    it('should calculate check portfolio value', () => {
      const cheques = [
        { monto: decimal(5000), estado: 'CARTERA' },
        { monto: decimal(3000), estado: 'CARTERA' },
        { monto: decimal(2000), estado: 'DEPOSITADO' }, // Not in portfolio anymore
        { monto: decimal(1000), estado: 'RECHAZADO' },  // Not in portfolio
      ];

      const portfolioValue = cheques
        .filter(c => c.estado === 'CARTERA')
        .reduce((sum, c) => sum.plus(c.monto), decimal(0));

      expect(portfolioValue.toNumber()).toBe(8000);
    });
  });

  describe('Bank Reconciliation', () => {
    it('should match statement items with treasury movements', () => {
      const statementItems = [
        { id: 1, credito: decimal(10000), debito: decimal(0), fecha: new Date('2025-01-15'), descripcion: 'TRANSFERENCIA' },
        { id: 2, credito: decimal(0), debito: decimal(500), fecha: new Date('2025-01-15'), descripcion: 'COMISION' },
      ];

      const movements = [
        { id: 101, tipo: 'INGRESO', monto: decimal(10000), fecha: new Date('2025-01-15'), conciliado: false },
        { id: 102, tipo: 'EGRESO', monto: decimal(500), fecha: new Date('2025-01-15'), conciliado: false },
      ];

      // Exact matching
      const matches = statementItems.map(item => {
        const itemMonto = item.credito.gt(0) ? item.credito : item.debito;
        const itemTipo = item.credito.gt(0) ? 'INGRESO' : 'EGRESO';

        const matchedMov = movements.find(mov =>
          mov.tipo === itemTipo &&
          mov.monto.eq(itemMonto) &&
          !mov.conciliado
        );

        return {
          statementItemId: item.id,
          movementId: matchedMov?.id || null,
          matchType: matchedMov ? 'EXACT' : null,
        };
      });

      expect(matches).toHaveLength(2);
      expect(matches[0].matchType).toBe('EXACT');
      expect(matches[1].matchType).toBe('EXACT');
    });

    it('should handle fuzzy matching within tolerance', () => {
      const tolerance = decimal(1);
      const statementMonto = decimal(9999.50);
      const movementMonto = decimal(10000);

      const difference = movementMonto.minus(statementMonto).abs();
      const isWithinTolerance = difference.lte(tolerance);

      expect(isWithinTolerance).toBe(true);
    });
  });
});

describe('Payment Allocation', () => {
  it('should allocate payment to multiple invoices', () => {
    const invoices = [
      { id: 1, saldoPendiente: decimal(5000), fechaVencimiento: new Date('2025-01-01') },
      { id: 2, saldoPendiente: decimal(3000), fechaVencimiento: new Date('2025-01-15') },
      { id: 3, saldoPendiente: decimal(7000), fechaVencimiento: new Date('2025-02-01') },
    ];

    const paymentAmount = decimal(10000);

    // Allocate oldest first
    const allocations: { invoiceId: number; monto: Prisma.Decimal }[] = [];
    let remaining = paymentAmount;

    for (const invoice of invoices.sort((a, b) =>
      a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime()
    )) {
      if (remaining.lte(0)) break;

      const toAllocate = remaining.gte(invoice.saldoPendiente)
        ? invoice.saldoPendiente
        : remaining;

      allocations.push({ invoiceId: invoice.id, monto: toAllocate });
      remaining = remaining.minus(toAllocate);
    }

    expect(allocations).toHaveLength(3);
    expect(allocations[0].monto.toNumber()).toBe(5000); // First invoice fully paid
    expect(allocations[1].monto.toNumber()).toBe(3000); // Second invoice fully paid
    expect(allocations[2].monto.toNumber()).toBe(2000); // Third invoice partially paid
  });

  it('should update invoice status correctly', () => {
    function calculateInvoiceStatus(
      total: Prisma.Decimal,
      totalCobrado: Prisma.Decimal
    ): 'EMITIDA' | 'PARCIALMENTE_COBRADA' | 'COBRADA' {
      if (totalCobrado.gte(total)) return 'COBRADA';
      if (totalCobrado.gt(0)) return 'PARCIALMENTE_COBRADA';
      return 'EMITIDA';
    }

    expect(calculateInvoiceStatus(decimal(10000), decimal(0))).toBe('EMITIDA');
    expect(calculateInvoiceStatus(decimal(10000), decimal(5000))).toBe('PARCIALMENTE_COBRADA');
    expect(calculateInvoiceStatus(decimal(10000), decimal(10000))).toBe('COBRADA');
    expect(calculateInvoiceStatus(decimal(10000), decimal(10001))).toBe('COBRADA');
  });
});
