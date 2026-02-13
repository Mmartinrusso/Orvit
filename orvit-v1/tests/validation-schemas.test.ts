/**
 * Tests for lib/tesoreria/validation-schemas.ts
 *
 * Validates Zod schemas for bank reconciliation inputs.
 * Tests import from the actual module to verify no runtime crashes.
 */
import { describe, it, expect } from 'vitest';
import {
  importBankStatementSchema,
  bankStatementItemSchema,
  manualMatchSchema,
  closeConciliacionSchema,
  statementActionSchema,
  reconciliationMatchRequestSchema,
  conciliacionFilterSchema,
  chequeStateChangeSchema,
  createBankStatementSchema,
} from '@/lib/tesoreria/validation-schemas';

// ═══════════════════════════════════════════════════════════════════════════════
// Module import sanity check
// ═══════════════════════════════════════════════════════════════════════════════

describe('validation-schemas module import', () => {
  it('should import without crashing (chequeStateChangeSchema .refine() fix)', () => {
    // The .refine() was moved from inside discriminatedUnion member (ZodEffects)
    // to the union level, which is the correct approach.
    expect(chequeStateChangeSchema).toBeDefined();
  });

  it('should validate endosar requires endosadoA or endosadoPaymentOrderId', () => {
    const result = chequeStateChangeSchema.safeParse({
      accion: 'endosar',
      // Neither endosadoA nor endosadoPaymentOrderId provided
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid endosar with endosadoA', () => {
    const result = chequeStateChangeSchema.safeParse({
      accion: 'endosar',
      endosadoA: 'Proveedor XYZ',
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// importBankStatementSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('importBankStatementSchema', () => {
  const validItem = {
    lineNumber: 1,
    fecha: '2026-01-15T00:00:00.000Z',
    descripcion: 'Transferencia recibida',
    referencia: 'REF-001',
    debito: 0,
    credito: 15000,
    saldo: 115000,
  };

  const validPayload = {
    bankAccountId: 1,
    periodo: '2026-01',
    saldoInicial: 100000,
    saldoFinal: 115000,
    items: [validItem],
    toleranciaMonto: 0.01,
    toleranciaDias: 3,
    docType: 'T1',
  };

  it('should accept valid import payload', () => {
    const result = importBankStatementSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('should reject missing bankAccountId', () => {
    const { bankAccountId, ...rest } = validPayload;
    const result = importBankStatementSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should reject invalid periodo format', () => {
    const result = importBankStatementSchema.safeParse({
      ...validPayload,
      periodo: '2026/01',
    });
    expect(result.success).toBe(false);
  });

  it('should reject periodo with invalid month 13 (fixed regex)', () => {
    // The regex was updated to /^\d{4}-(0[1-9]|1[0-2])$/ which correctly rejects month 13
    const result = importBankStatementSchema.safeParse({
      ...validPayload,
      periodo: '2026-13',
    });
    expect(result.success).toBe(false);
  });

  it('should reject periodo with invalid month 00 (fixed regex)', () => {
    const result = importBankStatementSchema.safeParse({
      ...validPayload,
      periodo: '2026-00',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid months 01 through 12', () => {
    for (let m = 1; m <= 12; m++) {
      const month = m.toString().padStart(2, '0');
      const result = importBankStatementSchema.safeParse({
        ...validPayload,
        periodo: `2026-${month}`,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject empty items array', () => {
    const result = importBankStatementSchema.safeParse({
      ...validPayload,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it('should default toleranciaMonto to 0.01 when not provided', () => {
    const { toleranciaMonto, ...rest } = validPayload;
    const result = importBankStatementSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.toleranciaMonto).toBe(0.01);
    }
  });

  it('should default toleranciaDias to 3 when not provided', () => {
    const { toleranciaDias, ...rest } = validPayload;
    const result = importBankStatementSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.toleranciaDias).toBe(3);
    }
  });

  it('should reject negative toleranciaMonto', () => {
    const result = importBankStatementSchema.safeParse({
      ...validPayload,
      toleranciaMonto: -1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative toleranciaDias', () => {
    const result = importBankStatementSchema.safeParse({
      ...validPayload,
      toleranciaDias: -1,
    });
    expect(result.success).toBe(false);
  });

  it('should default docType to T1', () => {
    const { docType, ...rest } = validPayload;
    const result = importBankStatementSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.docType).toBe('T1');
    }
  });

  it('should coerce string bankAccountId to number', () => {
    const result = importBankStatementSchema.safeParse({
      ...validPayload,
      bankAccountId: '5',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bankAccountId).toBe(5);
    }
  });

  it('should reject bankAccountId = 0', () => {
    const result = importBankStatementSchema.safeParse({
      ...validPayload,
      bankAccountId: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// bankStatementItemSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('bankStatementItemSchema', () => {
  it('should accept valid item with both debito and credito', () => {
    const result = bankStatementItemSchema.safeParse({
      lineNumber: 1,
      fecha: '2026-01-15T00:00:00.000Z',
      descripcion: 'Test',
      debito: 1000,
      credito: 0,
      saldo: 99000,
    });
    expect(result.success).toBe(true);
  });

  it('should allow both debito and credito to be non-zero (no cross-validation)', () => {
    const result = bankStatementItemSchema.safeParse({
      lineNumber: 1,
      fecha: '2026-01-15T00:00:00.000Z',
      descripcion: 'Test',
      debito: 1000,
      credito: 500,
      saldo: 99500,
    });
    expect(result.success).toBe(true);
  });

  it('should default debito to 0', () => {
    const result = bankStatementItemSchema.safeParse({
      lineNumber: 1,
      fecha: '2026-01-15T00:00:00.000Z',
      descripcion: 'Test',
      credito: 500,
      saldo: 100500,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.debito).toBe(0);
    }
  });

  it('should accept null fechaValor', () => {
    const result = bankStatementItemSchema.safeParse({
      lineNumber: 1,
      fecha: '2026-01-15T00:00:00.000Z',
      fechaValor: null,
      descripcion: 'Test',
      debito: 0,
      credito: 500,
      saldo: 100500,
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative debito', () => {
    const result = bankStatementItemSchema.safeParse({
      lineNumber: 1,
      fecha: '2026-01-15T00:00:00.000Z',
      descripcion: 'Test',
      debito: -100,
      credito: 0,
      saldo: 100100,
    });
    expect(result.success).toBe(false);
  });

  it('should reject lineNumber = 0', () => {
    const result = bankStatementItemSchema.safeParse({
      lineNumber: 0,
      fecha: '2026-01-15T00:00:00.000Z',
      descripcion: 'Test',
      debito: 100,
      credito: 0,
      saldo: 99900,
    });
    expect(result.success).toBe(false);
  });

  it('should reject description over 500 chars', () => {
    const result = bankStatementItemSchema.safeParse({
      lineNumber: 1,
      fecha: '2026-01-15T00:00:00.000Z',
      descripcion: 'A'.repeat(501),
      debito: 100,
      credito: 0,
      saldo: 99900,
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// reconciliationMatchRequestSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('reconciliationMatchRequestSchema', () => {
  it('should accept valid match action', () => {
    const result = reconciliationMatchRequestSchema.safeParse({
      action: 'match',
      itemId: 1,
      movementId: 2,
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid unmatch action', () => {
    const result = reconciliationMatchRequestSchema.safeParse({
      action: 'unmatch',
      itemId: 1,
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid resolveSuspense action', () => {
    const result = reconciliationMatchRequestSchema.safeParse({
      action: 'resolveSuspense',
      itemId: 1,
      notas: 'Comisión bancaria',
    });
    expect(result.success).toBe(true);
  });

  it('should reject resolveSuspense without notas', () => {
    const result = reconciliationMatchRequestSchema.safeParse({
      action: 'resolveSuspense',
      itemId: 1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject resolveSuspense with empty notas', () => {
    const result = reconciliationMatchRequestSchema.safeParse({
      action: 'resolveSuspense',
      itemId: 1,
      notas: '',
    });
    expect(result.success).toBe(false);
  });

  it('should accept createMovement action', () => {
    const result = reconciliationMatchRequestSchema.safeParse({
      action: 'createMovement',
      itemId: 1,
      referenceType: 'COMISION_BANCARIA',
      descripcion: 'Comisión mantenimiento cuenta',
    });
    expect(result.success).toBe(true);
  });

  it('should reject createMovement without referenceType', () => {
    const result = reconciliationMatchRequestSchema.safeParse({
      action: 'createMovement',
      itemId: 1,
      descripcion: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('should reject match without movementId', () => {
    const result = reconciliationMatchRequestSchema.safeParse({
      action: 'match',
      itemId: 1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid action type', () => {
    const result = reconciliationMatchRequestSchema.safeParse({
      action: 'invalidAction',
      itemId: 1,
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// closeConciliacionSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('closeConciliacionSchema', () => {
  it('should accept minimal close payload', () => {
    const result = closeConciliacionSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.forzarCierre).toBe(false);
    }
  });

  it('should accept forzarCierre flag', () => {
    const result = closeConciliacionSchema.safeParse({
      forzarCierre: true,
    });
    expect(result.success).toBe(true);
  });

  it('should reject notas over 500 chars', () => {
    const result = closeConciliacionSchema.safeParse({
      notas: 'A'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// statementActionSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('statementActionSchema', () => {
  it('should accept close action', () => {
    const result = statementActionSchema.safeParse({ action: 'close' });
    expect(result.success).toBe(true);
  });

  it('should accept reopen action', () => {
    const result = statementActionSchema.safeParse({ action: 'reopen' });
    expect(result.success).toBe(true);
  });

  it('should accept updateTolerances with values', () => {
    const result = statementActionSchema.safeParse({
      action: 'updateTolerances',
      toleranciaMonto: 0.5,
      toleranciaDias: 5,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid action', () => {
    const result = statementActionSchema.safeParse({ action: 'delete' });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// manualMatchSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('manualMatchSchema', () => {
  it('should accept valid manual match', () => {
    const result = manualMatchSchema.safeParse({
      statementItemId: 1,
      treasuryMovementId: 2,
    });
    expect(result.success).toBe(true);
  });

  it('should accept match with optional notas', () => {
    const result = manualMatchSchema.safeParse({
      statementItemId: 1,
      treasuryMovementId: 2,
      notas: 'Matched manually',
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative IDs', () => {
    const result = manualMatchSchema.safeParse({
      statementItemId: -1,
      treasuryMovementId: 2,
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// conciliacionFilterSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('conciliacionFilterSchema', () => {
  it('should accept all valid filter values', () => {
    const result = conciliacionFilterSchema.safeParse({
      page: 1,
      limit: 20,
      bankAccountId: '5',
      periodo: '2026-01',
      estado: 'EN_PROCESO',
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty filters', () => {
    const result = conciliacionFilterSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should reject invalid estado', () => {
    const result = conciliacionFilterSchema.safeParse({
      estado: 'INVALID_STATE',
    });
    expect(result.success).toBe(false);
  });

  it('should reject limit > 100', () => {
    const result = conciliacionFilterSchema.safeParse({
      limit: 101,
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createBankStatementSchema periodo regex
// ═══════════════════════════════════════════════════════════════════════════════

describe('createBankStatementSchema periodo validation', () => {
  it('should reject invalid month 13', () => {
    const result = createBankStatementSchema.safeParse({
      bankAccountId: 1,
      periodo: '2026-13',
      saldoInicial: 100000,
      saldoFinal: 115000,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid month 00', () => {
    const result = createBankStatementSchema.safeParse({
      bankAccountId: 1,
      periodo: '2026-00',
      saldoInicial: 100000,
      saldoFinal: 115000,
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid month 12', () => {
    const result = createBankStatementSchema.safeParse({
      bankAccountId: 1,
      periodo: '2026-12',
      saldoInicial: 100000,
      saldoFinal: 115000,
    });
    expect(result.success).toBe(true);
  });
});
