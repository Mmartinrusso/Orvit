/**
 * Tests for lib/tesoreria/reconciliation-matcher.ts
 *
 * Tests the auto-match engine and manual reconciliation logic.
 * Since this module depends on Prisma, we mock it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The source uses named export: import { prisma } from '@/lib/prisma'
// So we mock the named export, not the default.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    bankStatement: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    bankStatementItem: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    treasuryMovement: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import {
  autoMatchStatementItems,
  manualMatch,
  unmatch,
  resolveSuspense,
  createMovementFromSuspense,
  getUnmatchedMovements,
  getReconciliationSummary,
} from '@/lib/tesoreria/reconciliation-matcher';
import { prisma } from '@/lib/prisma';

// Get typed reference to the mocked prisma
const mockPrisma = vi.mocked(prisma) as any;

// Helper to create Decimal-like objects
function decimal(value: number) {
  return {
    greaterThan: (other: number) => value > other,
    minus: (other: any) => decimal(value - (typeof other === 'number' ? other : Number(other))),
    plus: (other: any) => decimal(value + (typeof other === 'number' ? other : Number(other))),
    toNumber: () => value,
    toString: () => value.toString(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// autoMatchStatementItems
// ═══════════════════════════════════════════════════════════════════════════════

describe('autoMatchStatementItems', () => {
  // Helper to mock interactive transaction
  function mockInteractiveTransaction() {
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        bankStatement: mockPrisma.bankStatement,
        bankStatementItem: mockPrisma.bankStatementItem,
        treasuryMovement: mockPrisma.treasuryMovement,
      };
      return cb(tx);
    });
  }

  it('should throw when statement not found', async () => {
    mockPrisma.bankStatement.findUnique.mockResolvedValue(null);
    await expect(autoMatchStatementItems(999)).rejects.toThrow('Statement not found');
  });

  it('should return zero matches for statement with no unmatched items', async () => {
    mockPrisma.bankStatement.findUnique.mockResolvedValue({
      id: 1,
      bankAccountId: 10,
      toleranciaMonto: decimal(0.01),
      toleranciaDias: 3,
      docType: 'T1',
      companyId: 1,
      items: [],
    });
    mockInteractiveTransaction();
    mockPrisma.bankStatement.update.mockResolvedValue({});

    const result = await autoMatchStatementItems(1);

    expect(result.totalItems).toBe(0);
    expect(result.matched).toBe(0);
    expect(result.unmatched).toBe(0);
  });

  it('should match EXACT when amount and date are identical', async () => {
    const testDate = new Date('2026-01-15');
    mockPrisma.bankStatement.findUnique.mockResolvedValue({
      id: 1,
      bankAccountId: 10,
      toleranciaMonto: decimal(0.01),
      toleranciaDias: 3,
      docType: 'T1',
      companyId: 1,
      items: [
        {
          id: 100,
          fecha: testDate,
          debito: decimal(5000),
          credito: decimal(0),
          referencia: null,
          descripcion: 'Test debit',
        },
      ],
    });
    mockInteractiveTransaction();

    // EXACT match found
    mockPrisma.treasuryMovement.findFirst.mockResolvedValueOnce({ id: 200 });
    mockPrisma.bankStatementItem.update.mockResolvedValue({});
    mockPrisma.treasuryMovement.update.mockResolvedValue({});
    mockPrisma.bankStatement.update.mockResolvedValue({});

    const result = await autoMatchStatementItems(1);

    expect(result.matched).toBe(1);
    expect(result.results[0].matchType).toBe('EXACT');
    expect(result.results[0].confidence).toBe(1.0);
  });

  it('should fall through to FUZZY when EXACT fails', async () => {
    const testDate = new Date('2026-01-15');
    mockPrisma.bankStatement.findUnique.mockResolvedValue({
      id: 1,
      bankAccountId: 10,
      toleranciaMonto: decimal(10),
      toleranciaDias: 3,
      docType: 'T1',
      companyId: 1,
      items: [
        {
          id: 100,
          fecha: testDate,
          debito: decimal(5000),
          credito: decimal(0),
          referencia: null,
          descripcion: 'Test debit',
        },
      ],
    });
    mockInteractiveTransaction();

    // EXACT miss, FUZZY hit
    mockPrisma.treasuryMovement.findFirst
      .mockResolvedValueOnce(null) // EXACT miss
      .mockResolvedValueOnce({
        id: 201,
        monto: decimal(5005),
        fecha: new Date('2026-01-16'),
      }); // FUZZY hit

    mockPrisma.bankStatementItem.update.mockResolvedValue({});
    mockPrisma.treasuryMovement.update.mockResolvedValue({});
    mockPrisma.bankStatement.update.mockResolvedValue({});

    const result = await autoMatchStatementItems(1);

    expect(result.matched).toBe(1);
    expect(result.results[0].matchType).toBe('FUZZY');
    expect(result.results[0].confidence).toBeGreaterThan(0);
    expect(result.results[0].confidence).toBeLessThan(1);
  });

  it('should fall through to REFERENCE when EXACT and FUZZY fail', async () => {
    const testDate = new Date('2026-01-15');
    mockPrisma.bankStatement.findUnique.mockResolvedValue({
      id: 1,
      bankAccountId: 10,
      toleranciaMonto: decimal(0.01),
      toleranciaDias: 3,
      docType: 'T1',
      companyId: 1,
      items: [
        {
          id: 100,
          fecha: testDate,
          debito: decimal(5000),
          credito: decimal(0),
          referencia: 'REF-123',
          descripcion: 'Test debit',
        },
      ],
    });
    mockInteractiveTransaction();

    // EXACT miss, FUZZY miss, REFERENCE hit
    mockPrisma.treasuryMovement.findFirst
      .mockResolvedValueOnce(null) // EXACT
      .mockResolvedValueOnce(null) // FUZZY
      .mockResolvedValueOnce({ id: 202 }); // REFERENCE

    mockPrisma.bankStatementItem.update.mockResolvedValue({});
    mockPrisma.treasuryMovement.update.mockResolvedValue({});
    mockPrisma.bankStatement.update.mockResolvedValue({});

    const result = await autoMatchStatementItems(1);

    expect(result.matched).toBe(1);
    expect(result.results[0].matchType).toBe('REFERENCE');
    expect(result.results[0].confidence).toBe(0.7);
  });

  it('should mark as suspense when no match found', async () => {
    const testDate = new Date('2026-01-15');
    mockPrisma.bankStatement.findUnique.mockResolvedValue({
      id: 1,
      bankAccountId: 10,
      toleranciaMonto: decimal(0.01),
      toleranciaDias: 3,
      docType: 'T1',
      companyId: 1,
      items: [
        {
          id: 100,
          fecha: testDate,
          debito: decimal(5000),
          credito: decimal(0),
          referencia: null,
          descripcion: 'Unknown',
        },
      ],
    });
    mockInteractiveTransaction();

    // All misses
    mockPrisma.treasuryMovement.findFirst
      .mockResolvedValueOnce(null) // EXACT
      .mockResolvedValueOnce(null); // FUZZY (no reference to try)

    mockPrisma.bankStatementItem.update.mockResolvedValue({});
    mockPrisma.bankStatement.update.mockResolvedValue({});

    const result = await autoMatchStatementItems(1);

    expect(result.matched).toBe(0);
    expect(result.unmatched).toBe(1);
    expect(result.suspense).toBe(1);
    expect(result.results[0].matchType).toBeNull();
    expect(result.results[0].movementId).toBeNull();

    // Verify esSuspense was set
    expect(mockPrisma.bankStatementItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100 },
        data: expect.objectContaining({ esSuspense: true }),
      })
    );
  });

  it('should correctly update statement statistics', async () => {
    const testDate = new Date('2026-01-15');
    mockPrisma.bankStatement.findUnique.mockResolvedValue({
      id: 1,
      bankAccountId: 10,
      toleranciaMonto: decimal(0.01),
      toleranciaDias: 3,
      docType: 'T1',
      companyId: 1,
      items: [
        { id: 100, fecha: testDate, debito: decimal(5000), credito: decimal(0), referencia: null, descripcion: 'Test1' },
        { id: 101, fecha: testDate, debito: decimal(3000), credito: decimal(0), referencia: null, descripcion: 'Test2' },
      ],
    });
    mockInteractiveTransaction();

    // First item matches, second doesn't
    mockPrisma.treasuryMovement.findFirst
      .mockResolvedValueOnce({ id: 200 }) // First item EXACT hit
      .mockResolvedValueOnce(null) // Second item EXACT miss
      .mockResolvedValueOnce(null); // Second item FUZZY miss

    mockPrisma.bankStatementItem.update.mockResolvedValue({});
    mockPrisma.treasuryMovement.update.mockResolvedValue({});
    mockPrisma.bankStatement.update.mockResolvedValue({});

    const result = await autoMatchStatementItems(1);

    expect(result.totalItems).toBe(2);
    expect(result.matched).toBe(1);
    expect(result.unmatched).toBe(1);

    // Verify the statement update was called with correct stats
    expect(mockPrisma.bankStatement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          itemsConciliados: { increment: 1 },
          itemsPendientes: 1,
          itemsSuspense: 1,
          estado: 'EN_PROCESO',
        }),
      })
    );
  });

  it('should set estado to COMPLETADA when all items match', async () => {
    const testDate = new Date('2026-01-15');
    mockPrisma.bankStatement.findUnique.mockResolvedValue({
      id: 1,
      bankAccountId: 10,
      toleranciaMonto: decimal(0.01),
      toleranciaDias: 3,
      docType: 'T1',
      companyId: 1,
      items: [
        { id: 100, fecha: testDate, debito: decimal(5000), credito: decimal(0), referencia: null, descripcion: 'Test' },
      ],
    });
    mockInteractiveTransaction();

    mockPrisma.treasuryMovement.findFirst.mockResolvedValueOnce({ id: 200 });
    mockPrisma.bankStatementItem.update.mockResolvedValue({});
    mockPrisma.treasuryMovement.update.mockResolvedValue({});
    mockPrisma.bankStatement.update.mockResolvedValue({});

    await autoMatchStatementItems(1);

    expect(mockPrisma.bankStatement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'COMPLETADA',
        }),
      })
    );
  });

  it('should determine tipo based on debito vs credito', async () => {
    const testDate = new Date('2026-01-15');
    mockPrisma.bankStatement.findUnique.mockResolvedValue({
      id: 1,
      bankAccountId: 10,
      toleranciaMonto: decimal(0.01),
      toleranciaDias: 3,
      docType: 'T1',
      companyId: 1,
      items: [
        {
          id: 100,
          fecha: testDate,
          debito: decimal(0),
          credito: decimal(8000),
          referencia: null,
          descripcion: 'Credit entry',
        },
      ],
    });
    mockInteractiveTransaction();

    mockPrisma.treasuryMovement.findFirst.mockResolvedValueOnce({ id: 200 });
    mockPrisma.bankStatementItem.update.mockResolvedValue({});
    mockPrisma.treasuryMovement.update.mockResolvedValue({});
    mockPrisma.bankStatement.update.mockResolvedValue({});

    await autoMatchStatementItems(1);

    expect(mockPrisma.treasuryMovement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tipo: 'INGRESO',
        }),
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// manualMatch
// ═══════════════════════════════════════════════════════════════════════════════

describe('manualMatch', () => {
  it('should throw when item not found', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue(null);
    await expect(manualMatch(999, 100, 1)).rejects.toThrow('Statement item not found');
  });

  it('should throw when item already reconciled', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue({
      id: 100,
      conciliado: true,
    });
    await expect(manualMatch(100, 200, 1)).rejects.toThrow('Item already reconciled');
  });

  it('should throw when movement not found', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue({
      id: 100,
      conciliado: false,
    });
    mockPrisma.treasuryMovement.findUnique.mockResolvedValue(null);

    await expect(manualMatch(100, 999, 1)).rejects.toThrow('Treasury movement not found');
  });

  it('should throw when movement already reconciled', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue({
      id: 100,
      conciliado: false,
    });
    mockPrisma.treasuryMovement.findUnique.mockResolvedValue({
      id: 200,
      conciliado: true,
    });

    await expect(manualMatch(100, 200, 1)).rejects.toThrow('Movement already reconciled');
  });

  it('should execute transaction when both item and movement are valid', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue({
      id: 100,
      conciliado: false,
      statementId: 1,
      esSuspense: false,
    });
    mockPrisma.treasuryMovement.findUnique.mockResolvedValue({
      id: 200,
      conciliado: false,
    });
    mockPrisma.$transaction.mockResolvedValue(undefined);

    const result = await manualMatch(100, 200, 5);

    expect(result.matchType).toBe('MANUAL');
    expect(result.confidence).toBe(1.0);
    expect(result.reason).toBe('Conciliado manualmente');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('should handle suspense item by decrementing suspense count', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue({
      id: 100,
      conciliado: false,
      statementId: 1,
      esSuspense: true,
    });
    mockPrisma.treasuryMovement.findUnique.mockResolvedValue({
      id: 200,
      conciliado: false,
    });
    mockPrisma.$transaction.mockResolvedValue(undefined);

    await manualMatch(100, 200, 5);

    const transactionCall = mockPrisma.$transaction.mock.calls[0][0];
    expect(transactionCall).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// unmatch
// ═══════════════════════════════════════════════════════════════════════════════

describe('unmatch', () => {
  it('should throw when item not found', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue(null);
    await expect(unmatch(999)).rejects.toThrow('Statement item not found');
  });

  it('should throw when item is not reconciled', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue({
      id: 100,
      conciliado: false,
      statement: { id: 1 },
    });
    await expect(unmatch(100)).rejects.toThrow('Item is not reconciled');
  });

  it('should execute unmatch transaction for item with linked movement', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue({
      id: 100,
      conciliado: true,
      statementId: 1,
      treasuryMovementId: 200,
      statement: { id: 1 },
    });
    mockPrisma.$transaction.mockResolvedValue(undefined);

    await unmatch(100);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const transactionCall = mockPrisma.$transaction.mock.calls[0][0];
    expect(transactionCall).toHaveLength(3);
  });

  it('should execute unmatch transaction for item without linked movement', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue({
      id: 100,
      conciliado: true,
      statementId: 1,
      treasuryMovementId: null,
      statement: { id: 1 },
    });
    mockPrisma.$transaction.mockResolvedValue(undefined);

    await unmatch(100);

    const transactionCall = mockPrisma.$transaction.mock.calls[0][0];
    expect(transactionCall).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// resolveSuspense
// ═══════════════════════════════════════════════════════════════════════════════

describe('resolveSuspense', () => {
  it('should throw when item not found', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue(null);
    await expect(resolveSuspense(999, 'test', 1)).rejects.toThrow('Statement item not found');
  });

  it('should update item with suspense resolution and decrement statement suspense count', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue({
      id: 100,
      statementId: 1,
      esSuspense: true,
    });
    mockPrisma.$transaction.mockResolvedValue(undefined);

    await resolveSuspense(100, 'Comisión bancaria reconocida', 5);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    // Should include 2 operations: update item + update statement (decrement suspense)
    const transactionCall = mockPrisma.$transaction.mock.calls[0][0];
    expect(transactionCall).toHaveLength(2);
  });

  it('should not decrement statement suspense if item was not in suspense', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue({
      id: 100,
      statementId: 1,
      esSuspense: false,
    });
    mockPrisma.$transaction.mockResolvedValue(undefined);

    await resolveSuspense(100, 'Test', 5);

    const transactionCall = mockPrisma.$transaction.mock.calls[0][0];
    expect(transactionCall).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createMovementFromSuspense
// ═══════════════════════════════════════════════════════════════════════════════

describe('createMovementFromSuspense', () => {
  it('should throw when item not found', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue(null);
    await expect(createMovementFromSuspense(999, 'FEE', 'Comisión', 5)).rejects.toThrow(
      'Statement item not found'
    );
  });

  it('should create EGRESO movement for debit item', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue({
      id: 100,
      fecha: new Date('2026-01-15'),
      fechaValor: null,
      debito: decimal(500),
      credito: decimal(0),
      descripcion: 'COMISION MANTENIMIENTO CUENTA',
      statementId: 1,
      statement: {
        id: 1,
        bankAccountId: 10,
        docType: 'T1',
        companyId: 1,
      },
    });

    mockPrisma.treasuryMovement.create.mockResolvedValue({ id: 300 });
    mockPrisma.bankStatementItem.update.mockResolvedValue({});
    mockPrisma.bankStatement.update.mockResolvedValue({});

    const movementId = await createMovementFromSuspense(100, 'COMISION_BANCARIA', 'Comisión mantenimiento', 5);

    expect(movementId).toBe(300);
    expect(mockPrisma.treasuryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'EGRESO',
        medio: 'COMISION',
        conciliado: true,
      }),
    });
  });

  it('should create INGRESO movement for credit item', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue({
      id: 101,
      fecha: new Date('2026-01-15'),
      fechaValor: null,
      debito: decimal(0),
      credito: decimal(1000),
      descripcion: 'INTERES CUENTA CORRIENTE',
      statementId: 1,
      statement: {
        id: 1,
        bankAccountId: 10,
        docType: 'T1',
        companyId: 1,
      },
    });

    mockPrisma.treasuryMovement.create.mockResolvedValue({ id: 301 });
    mockPrisma.bankStatementItem.update.mockResolvedValue({});
    mockPrisma.bankStatement.update.mockResolvedValue({});

    await createMovementFromSuspense(101, 'INTERES', 'Interés cuenta', 5);

    expect(mockPrisma.treasuryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'INGRESO',
        medio: 'INTERES',
      }),
    });
  });

  it('should default to AJUSTE medio when description has no special keywords', async () => {
    mockPrisma.bankStatementItem.findUnique.mockResolvedValue({
      id: 102,
      fecha: new Date('2026-01-15'),
      fechaValor: null,
      debito: decimal(100),
      credito: decimal(0),
      descripcion: 'DEBITO AUTOMATICO SERVICIO',
      statementId: 1,
      statement: {
        id: 1,
        bankAccountId: 10,
        docType: 'T1',
        companyId: 1,
      },
    });

    mockPrisma.treasuryMovement.create.mockResolvedValue({ id: 302 });
    mockPrisma.bankStatementItem.update.mockResolvedValue({});
    mockPrisma.bankStatement.update.mockResolvedValue({});

    await createMovementFromSuspense(102, 'DEBITO_AUTO', 'Débito automático', 5);

    expect(mockPrisma.treasuryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        medio: 'AJUSTE',
      }),
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getUnmatchedMovements
// ═══════════════════════════════════════════════════════════════════════════════

describe('getUnmatchedMovements', () => {
  it('should query with correct default filters', async () => {
    mockPrisma.treasuryMovement.findMany.mockResolvedValue([]);

    await getUnmatchedMovements(10);

    expect(mockPrisma.treasuryMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bankAccountId: 10,
          conciliado: false,
        }),
        orderBy: { fecha: 'desc' },
      })
    );
  });

  it('should apply date and type filters', async () => {
    mockPrisma.treasuryMovement.findMany.mockResolvedValue([]);

    const desde = new Date('2026-01-01');
    const hasta = new Date('2026-01-31');

    await getUnmatchedMovements(10, {
      fechaDesde: desde,
      fechaHasta: hasta,
      tipo: 'EGRESO',
    });

    expect(mockPrisma.treasuryMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fecha: { gte: desde, lte: hasta },
          tipo: 'EGRESO',
        }),
      })
    );
  });

  it('should apply amount filters', async () => {
    mockPrisma.treasuryMovement.findMany.mockResolvedValue([]);

    await getUnmatchedMovements(10, {
      montoMin: 1000,
      montoMax: 5000,
    });

    expect(mockPrisma.treasuryMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          monto: { gte: 1000, lte: 5000 },
        }),
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getReconciliationSummary
// ═══════════════════════════════════════════════════════════════════════════════

describe('getReconciliationSummary', () => {
  it('should throw when statement not found', async () => {
    mockPrisma.bankStatement.findUnique.mockResolvedValue(null);
    await expect(getReconciliationSummary(999)).rejects.toThrow('Statement not found');
  });

  it('should correctly count match types', async () => {
    mockPrisma.bankStatement.findUnique.mockResolvedValue({
      id: 1,
      items: [
        { conciliado: true, matchType: 'EXACT', esSuspense: false, suspenseResuelto: false },
        { conciliado: true, matchType: 'EXACT', esSuspense: false, suspenseResuelto: false },
        { conciliado: true, matchType: 'FUZZY', esSuspense: false, suspenseResuelto: false },
        { conciliado: true, matchType: 'MANUAL', esSuspense: false, suspenseResuelto: false },
        { conciliado: false, matchType: null, esSuspense: true, suspenseResuelto: false },
        { conciliado: false, matchType: null, esSuspense: true, suspenseResuelto: true },
        { conciliado: false, matchType: null, esSuspense: false, suspenseResuelto: false },
      ],
    });

    const summary = await getReconciliationSummary(1);

    expect(summary.totalItems).toBe(7);
    expect(summary.matched).toBe(4);
    expect(summary.pending).toBe(3);
    expect(summary.suspense).toBe(1);
    expect(summary.suspenseResolved).toBe(1);
    expect(summary.matchBreakdown.EXACT).toBe(2);
    expect(summary.matchBreakdown.FUZZY).toBe(1);
    expect(summary.matchBreakdown.REFERENCE).toBe(0);
    expect(summary.matchBreakdown.MANUAL).toBe(1);
  });

  it('should handle empty statement', async () => {
    mockPrisma.bankStatement.findUnique.mockResolvedValue({
      id: 1,
      items: [],
    });

    const summary = await getReconciliationSummary(1);

    expect(summary.totalItems).toBe(0);
    expect(summary.matched).toBe(0);
    expect(summary.pending).toBe(0);
    expect(summary.suspense).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FUZZY confidence calculation
// ═══════════════════════════════════════════════════════════════════════════════

describe('FUZZY confidence calculation', () => {
  it('should calculate confidence correctly for fuzzy matches', async () => {
    const testDate = new Date('2026-01-15');
    mockPrisma.bankStatement.findUnique.mockResolvedValue({
      id: 1,
      bankAccountId: 10,
      toleranciaMonto: decimal(100),
      toleranciaDias: 5,
      docType: 'T1',
      companyId: 1,
      items: [
        {
          id: 100,
          fecha: testDate,
          debito: decimal(5000),
          credito: decimal(0),
          referencia: null,
          descripcion: 'Test',
        },
      ],
    });

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        bankStatement: mockPrisma.bankStatement,
        bankStatementItem: mockPrisma.bankStatementItem,
        treasuryMovement: mockPrisma.treasuryMovement,
      };
      return cb(tx);
    });

    // EXACT miss, FUZZY hit
    mockPrisma.treasuryMovement.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 201,
        monto: 5050,
        fecha: new Date('2026-01-17'),
      });

    mockPrisma.bankStatementItem.update.mockResolvedValue({});
    mockPrisma.treasuryMovement.update.mockResolvedValue({});
    mockPrisma.bankStatement.update.mockResolvedValue({});

    const result = await autoMatchStatementItems(1);

    expect(result.results[0].confidence).toBeGreaterThan(0.7);
    expect(result.results[0].confidence).toBeLessThan(1);
  });
});
