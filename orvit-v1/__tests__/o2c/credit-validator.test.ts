/**
 * O2C Phase 1: Credit Validator Tests
 *
 * Tests for credit limit validation, overdues, and client blocking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

// Mock types for testing
interface MockClient {
  id: string;
  name: string;
  creditLimit: Prisma.Decimal | null;
  currentDebt: Prisma.Decimal;
  isBlocked: boolean;
  blockedReason?: string;
}

interface MockInvoice {
  id: number;
  clientId: string;
  total: Prisma.Decimal;
  saldoPendiente: Prisma.Decimal;
  fechaVencimiento: Date;
  estado: string;
}

interface CreditValidationResult {
  canProceed: boolean;
  requiresOverride: boolean;
  warnings: string[];
  errors: string[];
  creditStatus: {
    limit: Prisma.Decimal;
    used: Prisma.Decimal;
    available: Prisma.Decimal;
    utilizationPercent: number;
  };
  overdueStatus: {
    hasOverdue: boolean;
    overdueAmount: Prisma.Decimal;
    oldestOverdueDays: number;
    overdueInvoices: MockInvoice[];
  };
}

// Helper to create Decimal
const decimal = (value: number) => new Prisma.Decimal(value);

// Mock credit validator function
function validateCredit(
  client: MockClient,
  orderAmount: Prisma.Decimal,
  invoices: MockInvoice[],
  config: { graceDays: number; alertThreshold: number }
): CreditValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if client is blocked
  if (client.isBlocked) {
    errors.push(`Cliente bloqueado: ${client.blockedReason || 'Sin razón especificada'}`);
  }

  // Calculate credit status
  const limit = client.creditLimit || decimal(0);
  const used = client.currentDebt;
  const projectedDebt = used.plus(orderAmount);
  const available = limit.minus(used);
  const utilizationPercent = limit.gt(0)
    ? used.div(limit).mul(100).toNumber()
    : 0;

  // Check credit limit
  if (limit.gt(0) && projectedDebt.gt(limit)) {
    errors.push(`Excede límite de crédito. Disponible: $${available.toFixed(2)}, Pedido: $${orderAmount.toFixed(2)}`);
  }

  // Check utilization threshold
  if (utilizationPercent >= config.alertThreshold) {
    warnings.push(`Utilización de crédito al ${utilizationPercent.toFixed(1)}%`);
  }

  // Calculate overdue status
  const today = new Date();
  const graceDate = new Date(today);
  graceDate.setDate(graceDate.getDate() - config.graceDays);

  const overdueInvoices = invoices.filter(inv => {
    const vencimiento = new Date(inv.fechaVencimiento);
    return vencimiento < graceDate &&
           inv.saldoPendiente.gt(0) &&
           ['EMITIDA', 'PARCIALMENTE_COBRADA'].includes(inv.estado);
  });

  const overdueAmount = overdueInvoices.reduce(
    (sum, inv) => sum.plus(inv.saldoPendiente),
    decimal(0)
  );

  let oldestOverdueDays = 0;
  if (overdueInvoices.length > 0) {
    const oldest = overdueInvoices.reduce((a, b) =>
      new Date(a.fechaVencimiento) < new Date(b.fechaVencimiento) ? a : b
    );
    oldestOverdueDays = Math.floor(
      (today.getTime() - new Date(oldest.fechaVencimiento).getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  const hasOverdue = overdueInvoices.length > 0;
  if (hasOverdue) {
    errors.push(`Cliente tiene ${overdueInvoices.length} factura(s) vencida(s) por $${overdueAmount.toFixed(2)}`);
  }

  return {
    canProceed: errors.length === 0,
    requiresOverride: errors.length > 0 && !client.isBlocked,
    warnings,
    errors,
    creditStatus: {
      limit,
      used,
      available,
      utilizationPercent,
    },
    overdueStatus: {
      hasOverdue,
      overdueAmount,
      oldestOverdueDays,
      overdueInvoices,
    },
  };
}

describe('Credit Validator', () => {
  const defaultConfig = { graceDays: 0, alertThreshold: 80 };

  describe('Credit Limit Validation', () => {
    it('should allow order within credit limit', () => {
      const client: MockClient = {
        id: 'client-1',
        name: 'Test Client',
        creditLimit: decimal(100000),
        currentDebt: decimal(50000),
        isBlocked: false,
      };

      const result = validateCredit(client, decimal(30000), [], defaultConfig);

      expect(result.canProceed).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.creditStatus.available.toNumber()).toBe(50000);
    });

    it('should reject order exceeding credit limit', () => {
      const client: MockClient = {
        id: 'client-1',
        name: 'Test Client',
        creditLimit: decimal(100000),
        currentDebt: decimal(80000),
        isBlocked: false,
      };

      const result = validateCredit(client, decimal(30000), [], defaultConfig);

      expect(result.canProceed).toBe(false);
      expect(result.requiresOverride).toBe(true);
      expect(result.errors.some(e => e.includes('Excede límite de crédito'))).toBe(true);
    });

    it('should warn when utilization is high', () => {
      const client: MockClient = {
        id: 'client-1',
        name: 'Test Client',
        creditLimit: decimal(100000),
        currentDebt: decimal(85000),
        isBlocked: false,
      };

      const result = validateCredit(client, decimal(5000), [], defaultConfig);

      expect(result.canProceed).toBe(true);
      expect(result.warnings.some(w => w.includes('Utilización de crédito'))).toBe(true);
      expect(result.creditStatus.utilizationPercent).toBeGreaterThanOrEqual(80);
    });

    it('should allow unlimited credit when limit is null', () => {
      const client: MockClient = {
        id: 'client-1',
        name: 'Test Client',
        creditLimit: null,
        currentDebt: decimal(1000000),
        isBlocked: false,
      };

      const result = validateCredit(client, decimal(500000), [], defaultConfig);

      expect(result.canProceed).toBe(true);
    });
  });

  describe('Blocked Client Validation', () => {
    it('should reject order for blocked client', () => {
      const client: MockClient = {
        id: 'client-1',
        name: 'Test Client',
        creditLimit: decimal(100000),
        currentDebt: decimal(0),
        isBlocked: true,
        blockedReason: 'Mora de 90 días',
      };

      const result = validateCredit(client, decimal(10000), [], defaultConfig);

      expect(result.canProceed).toBe(false);
      expect(result.requiresOverride).toBe(false); // Can't override blocked
      expect(result.errors.some(e => e.includes('Cliente bloqueado'))).toBe(true);
    });
  });

  describe('Overdue Invoice Validation', () => {
    it('should detect overdue invoices', () => {
      const client: MockClient = {
        id: 'client-1',
        name: 'Test Client',
        creditLimit: decimal(100000),
        currentDebt: decimal(50000),
        isBlocked: false,
      };

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      const invoices: MockInvoice[] = [
        {
          id: 1,
          clientId: 'client-1',
          total: decimal(10000),
          saldoPendiente: decimal(10000),
          fechaVencimiento: pastDate,
          estado: 'EMITIDA',
        },
      ];

      const result = validateCredit(client, decimal(10000), invoices, defaultConfig);

      expect(result.canProceed).toBe(false);
      expect(result.overdueStatus.hasOverdue).toBe(true);
      expect(result.overdueStatus.overdueAmount.toNumber()).toBe(10000);
      expect(result.overdueStatus.oldestOverdueDays).toBeGreaterThanOrEqual(30);
    });

    it('should respect grace days', () => {
      const client: MockClient = {
        id: 'client-1',
        name: 'Test Client',
        creditLimit: decimal(100000),
        currentDebt: decimal(50000),
        isBlocked: false,
      };

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const invoices: MockInvoice[] = [
        {
          id: 1,
          clientId: 'client-1',
          total: decimal(10000),
          saldoPendiente: decimal(10000),
          fechaVencimiento: pastDate,
          estado: 'EMITIDA',
        },
      ];

      // With 7 grace days, 5-day overdue should pass
      const result = validateCredit(client, decimal(10000), invoices, { ...defaultConfig, graceDays: 7 });

      expect(result.overdueStatus.hasOverdue).toBe(false);
      expect(result.canProceed).toBe(true);
    });

    it('should ignore paid invoices', () => {
      const client: MockClient = {
        id: 'client-1',
        name: 'Test Client',
        creditLimit: decimal(100000),
        currentDebt: decimal(0),
        isBlocked: false,
      };

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      const invoices: MockInvoice[] = [
        {
          id: 1,
          clientId: 'client-1',
          total: decimal(10000),
          saldoPendiente: decimal(0), // Paid
          fechaVencimiento: pastDate,
          estado: 'COBRADA',
        },
      ];

      const result = validateCredit(client, decimal(10000), invoices, defaultConfig);

      expect(result.overdueStatus.hasOverdue).toBe(false);
      expect(result.canProceed).toBe(true);
    });
  });
});

describe('Balance Rebuilder', () => {
  it('should calculate balance from ledger entries', () => {
    // Mock ledger entries
    const ledgerEntries = [
      { tipo: 'FACTURA', debe: decimal(10000), haber: decimal(0) },
      { tipo: 'PAGO', debe: decimal(0), haber: decimal(5000) },
      { tipo: 'FACTURA', debe: decimal(8000), haber: decimal(0) },
      { tipo: 'NC', debe: decimal(0), haber: decimal(1000) },
    ];

    // Calculate balance
    const balance = ledgerEntries.reduce((acc, entry) => {
      return acc.plus(entry.debe).minus(entry.haber);
    }, decimal(0));

    expect(balance.toNumber()).toBe(12000); // 10000 + 8000 - 5000 - 1000
  });

  it('should detect discrepancy between ledger and cached balance', () => {
    const cachedDebt = decimal(15000);
    const ledgerBalance = decimal(12000);

    const difference = cachedDebt.minus(ledgerBalance);
    const hasDiscrepancy = difference.abs().gt(decimal(0.01));

    expect(hasDiscrepancy).toBe(true);
    expect(difference.toNumber()).toBe(3000);
  });
});
