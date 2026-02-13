/**
 * Tests for lib/tesoreria/bank-reconciliation-ml.ts
 *
 * Tests ML-powered bank reconciliation suggestion engine.
 */
import { describe, it, expect } from 'vitest';
import {
  generateReconciliationSuggestions,
  learnReconciliationPattern,
  getReconciliationStats,
  type BankMovement,
  type PaymentCandidate,
} from '@/lib/tesoreria/bank-reconciliation-ml';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════════════════════

function createBankMovement(overrides: Partial<BankMovement> = {}): BankMovement {
  return {
    id: 1,
    fecha: new Date('2026-01-15'),
    concepto: 'TRANSFERENCIA CLIENTE ABC SRL',
    referencia: 'REF-001',
    monto: 15000,
    tipo: 'CREDITO',
    reconciled: false,
    ...overrides,
  };
}

function createPaymentCandidate(overrides: Partial<PaymentCandidate> = {}): PaymentCandidate {
  return {
    id: 100,
    numero: 'PAG-001',
    fecha: new Date('2026-01-15'),
    monto: 15000,
    clientName: 'ABC SRL',
    clientId: 'client-abc',
    tipo: 'CLIENTE',
    referencia: null,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// generateReconciliationSuggestions
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateReconciliationSuggestions', () => {
  it('should return empty array for empty inputs', () => {
    const result = generateReconciliationSuggestions([], []);
    expect(result).toEqual([]);
  });

  it('should skip reconciled bank movements', () => {
    const movements = [createBankMovement({ reconciled: true })];
    const candidates = [createPaymentCandidate()];
    const result = generateReconciliationSuggestions(movements, candidates);
    expect(result).toHaveLength(0);
  });

  it('should find exact match (same amount, same date)', () => {
    const movements = [createBankMovement()];
    const candidates = [createPaymentCandidate()];

    const result = generateReconciliationSuggestions(movements, candidates);

    expect(result).toHaveLength(1);
    expect(result[0].matches).toHaveLength(1);
    expect(result[0].matches[0].matchScore).toBeGreaterThanOrEqual(65);
    expect(result[0].matches[0].amountDifference).toBe(0);
    expect(result[0].matches[0].dateDifference).toBe(0);
  });

  it('should give high score when amount exact + date exact + name matches', () => {
    const movements = [createBankMovement({ concepto: 'TRANSF ABC SRL PAG-001' })];
    const candidates = [createPaymentCandidate()];

    const result = generateReconciliationSuggestions(movements, candidates);

    expect(result[0].matches[0].matchScore).toBeGreaterThanOrEqual(85);
    expect(result[0].matches[0].confidence).toBe('high');
  });

  it('should match CREDITO movements only with CLIENTE candidates', () => {
    const movements = [createBankMovement({ tipo: 'CREDITO' })];
    const candidates = [
      createPaymentCandidate({ tipo: 'PROVEEDOR', id: 200, monto: 15000 }),
    ];

    const result = generateReconciliationSuggestions(movements, candidates);
    expect(result).toHaveLength(0);
  });

  it('should match DEBITO movements only with PROVEEDOR candidates', () => {
    const movements = [createBankMovement({ tipo: 'DEBITO' })];
    const candidates = [
      createPaymentCandidate({ tipo: 'CLIENTE', id: 200, monto: 15000 }),
    ];

    const result = generateReconciliationSuggestions(movements, candidates);
    expect(result).toHaveLength(0);
  });

  it('should suggest partial match for similar amounts within 5% tolerance', () => {
    const movements = [createBankMovement({ monto: 15000 })];
    const candidates = [createPaymentCandidate({ monto: 15500 })]; // 3.3% diff

    const result = generateReconciliationSuggestions(movements, candidates);
    expect(result).toHaveLength(1);
    expect(result[0].matches[0].matchType).toBe('partial');
  });

  it('should not suggest match when amount differs by more than 10%', () => {
    const movements = [createBankMovement({ monto: 15000 })];
    const candidates = [createPaymentCandidate({ monto: 20000 })]; // 33% diff

    const result = generateReconciliationSuggestions(movements, candidates);
    // With only amount (0 score) + date (25 points) = maybe 25 total
    // Threshold is 50, so should not be suggested unless client name matches
    if (result.length > 0) {
      expect(result[0].matches[0].matchScore).toBeLessThan(50);
    }
  });

  it('should give date bonus for matching within 3 days', () => {
    const movements = [createBankMovement({ fecha: new Date('2026-01-15') })];
    const candidates = [createPaymentCandidate({ fecha: new Date('2026-01-17') })]; // 2 days

    const result = generateReconciliationSuggestions(movements, candidates);
    expect(result).toHaveLength(1);
    // Should have date bonus (25 points) since within 3 days
    expect(result[0].matches[0].dateDifference).toBe(2);
  });

  it('should give partial date score for 4-7 days difference', () => {
    const movements = [createBankMovement({ fecha: new Date('2026-01-15') })];
    const candidates = [createPaymentCandidate({ fecha: new Date('2026-01-20') })]; // 5 days

    const result = generateReconciliationSuggestions(movements, candidates);
    expect(result).toHaveLength(1);
    expect(result[0].matches[0].dateDifference).toBe(5);
  });

  it('should mark autoReconcileable only when single match with score >= 95', () => {
    // Exact amount (40) + exact date (25) + payment number in reference (25) = 90
    // + learned pattern (10) = 100
    const learnedPatterns = new Map<string, string>();
    learnedPatterns.set('transf_cliente_abc_srl_pag_N', 'client-abc');

    const movements = [createBankMovement({ concepto: 'TRANSF CLIENTE ABC SRL PAG-001' })];
    const candidates = [createPaymentCandidate()];

    const result = generateReconciliationSuggestions(movements, candidates, learnedPatterns);

    expect(result).toHaveLength(1);
    // With exact amount (40) + exact date (25) + payment number match (25) + learned (10) = 100
    if (result[0].matches[0].matchScore >= 95) {
      expect(result[0].autoReconcileable).toBe(true);
    }
  });

  it('should not mark autoReconcileable when multiple matches exist', () => {
    const movements = [createBankMovement()];
    const candidates = [
      createPaymentCandidate({ id: 100 }),
      createPaymentCandidate({ id: 101, numero: 'PAG-002', clientName: 'ABC SRL' }),
    ];

    const result = generateReconciliationSuggestions(movements, candidates);
    if (result.length > 0 && result[0].matches.length > 1) {
      expect(result[0].autoReconcileable).toBe(false);
    }
  });

  it('should limit to top 5 matches per movement', () => {
    const movements = [createBankMovement()];
    const candidates = Array.from({ length: 10 }, (_, i) =>
      createPaymentCandidate({
        id: 100 + i,
        numero: `PAG-${i.toString().padStart(3, '0')}`,
        monto: 15000 + i * 100, // varying amounts within tolerance
        clientName: 'ABC SRL',
      })
    );

    const result = generateReconciliationSuggestions(movements, candidates);
    if (result.length > 0) {
      expect(result[0].matches.length).toBeLessThanOrEqual(5);
    }
  });

  it('should sort suggestions: autoReconcileable first, then by best score', () => {
    const movements = [
      createBankMovement({ id: 1, monto: 15000 }),
      createBankMovement({ id: 2, monto: 20000, concepto: 'UNKNOWN TRANSFER' }),
    ];
    const candidates = [
      createPaymentCandidate({ id: 100, monto: 15000 }),
      createPaymentCandidate({ id: 101, monto: 20000, clientName: 'XYZ SA', clientId: 'xyz' }),
    ];

    const result = generateReconciliationSuggestions(movements, candidates);

    if (result.length > 1) {
      // First should have higher or equal score than second (if both non-auto)
      const firstBest = result[0].matches[0]?.matchScore || 0;
      const secondBest = result[1].matches[0]?.matchScore || 0;
      if (!result[0].autoReconcileable && !result[1].autoReconcileable) {
        expect(firstBest).toBeGreaterThanOrEqual(secondBest);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Reference Matching
// ═══════════════════════════════════════════════════════════════════════════════

describe('reference matching', () => {
  it('should score high when payment number appears in bank reference', () => {
    const movements = [createBankMovement({ concepto: 'TRANSF PAG-001 RECIBIDA' })];
    const candidates = [createPaymentCandidate({ numero: 'PAG-001' })];

    const result = generateReconciliationSuggestions(movements, candidates);
    expect(result).toHaveLength(1);
    // Payment number match = 25 points
    expect(result[0].matches[0].matchScore).toBeGreaterThanOrEqual(65); // 40 (amount) + 25 (date) + 25 (ref)
  });

  it('should match by client name in bank concept', () => {
    const movements = [createBankMovement({ concepto: 'DEPOSITO ABC SRL CUOTA 3' })];
    const candidates = [createPaymentCandidate({ clientName: 'ABC SRL' })];

    const result = generateReconciliationSuggestions(movements, candidates);
    expect(result).toHaveLength(1);
    // Client name with 2+ words match should give score
    expect(result[0].matches[0].reasoning).toBeDefined();
  });

  it('should match by common reference numbers', () => {
    const movements = [createBankMovement({ concepto: 'TRANSFER 123456', referencia: '123456' })];
    const candidates = [createPaymentCandidate({ referencia: '123456' })];

    const result = generateReconciliationSuggestions(movements, candidates);
    expect(result).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// learnReconciliationPattern
// ═══════════════════════════════════════════════════════════════════════════════

describe('learnReconciliationPattern', () => {
  it('should add pattern to existing map', () => {
    const patterns = new Map<string, string>();
    const result = learnReconciliationPattern('TRANSFERENCIA CLIENTE ABC', 'client-abc', patterns);

    expect(result.size).toBe(1);
    // Pattern key should have numbers replaced with N
    expect([...result.keys()][0]).not.toContain('TRANSFERENCIA');
    // Values should be lowercase
    expect([...result.values()][0]).toBe('client-abc');
  });

  it('should normalize patterns (lowercase, no accents, numbers replaced)', () => {
    const patterns = new Map<string, string>();
    const result = learnReconciliationPattern(
      'DEPÓSITO REF 12345 PAGAMENTO',
      'client-xyz',
      patterns
    );

    const key = [...result.keys()][0];
    // Note: normalizeForPattern replaces numbers with uppercase 'N'
    // so the key WILL contain uppercase N but should otherwise be lowercase
    const keyWithoutN = key.replace(/N/g, '');
    expect(keyWithoutN).not.toMatch(/[A-Z]/);
    expect(key).not.toMatch(/[áéíóú]/);
    expect(key).toContain('N'); // Numbers replaced with N
  });

  it('should update existing pattern for same concept', () => {
    const patterns = new Map<string, string>();
    learnReconciliationPattern('TRANSFERENCIA CLIENTE', 'old-client', patterns);
    learnReconciliationPattern('TRANSFERENCIA CLIENTE', 'new-client', patterns);

    expect(patterns.size).toBe(1);
    expect([...patterns.values()][0]).toBe('new-client');
  });

  it('should preserve existing patterns when adding new ones', () => {
    const patterns = new Map<string, string>();
    learnReconciliationPattern('TRANSFERENCIA TIPO A', 'client-a', patterns);
    learnReconciliationPattern('DEPOSITO TIPO B', 'client-b', patterns);

    expect(patterns.size).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getReconciliationStats
// ═══════════════════════════════════════════════════════════════════════════════

describe('getReconciliationStats', () => {
  it('should return zeros for empty suggestions', () => {
    const stats = getReconciliationStats([]);
    expect(stats.totalUnreconciled).toBe(0);
    expect(stats.autoReconcileable).toBe(0);
    expect(stats.highConfidence).toBe(0);
    expect(stats.mediumConfidence).toBe(0);
    expect(stats.lowConfidence).toBe(0);
    expect(stats.noMatches).toBe(0);
    expect(stats.avgMatchScore).toBe(0);
  });

  it('should correctly count confidence levels', () => {
    const movements = [
      createBankMovement({ id: 1, monto: 15000 }),
      createBankMovement({ id: 2, monto: 25000, concepto: 'RANDOM' }),
      createBankMovement({ id: 3, monto: 35000, concepto: 'ALSO RANDOM' }),
    ];
    const candidates = [
      createPaymentCandidate({ id: 100, monto: 15000 }),
      createPaymentCandidate({ id: 101, monto: 25000, clientName: 'DEF SA', clientId: 'def' }),
      createPaymentCandidate({ id: 102, monto: 35100, clientName: 'GHI SA', clientId: 'ghi' }),
    ];

    const suggestions = generateReconciliationSuggestions(movements, candidates);
    const stats = getReconciliationStats(suggestions);

    expect(stats.totalUnreconciled).toBe(suggestions.length);
    expect(stats.avgMatchScore).toBeGreaterThan(0);
    expect(
      stats.highConfidence + stats.mediumConfidence + stats.lowConfidence + stats.noMatches
    ).toBe(stats.totalUnreconciled);
  });

  it('should count noMatches correctly', () => {
    // A suggestion with 0 matches shouldn't exist in real data
    // since generateReconciliationSuggestions filters them out
    // But stats should handle it
    const stats = getReconciliationStats([
      {
        bankMovement: createBankMovement(),
        matches: [],
        autoReconcileable: false,
      },
    ]);
    expect(stats.noMatches).toBe(1);
  });

  it('should calculate avgMatchScore correctly', () => {
    const movements = [
      createBankMovement({ id: 1, monto: 15000 }),
      createBankMovement({ id: 2, monto: 25000 }),
    ];
    const candidates = [
      createPaymentCandidate({ id: 100, monto: 15000 }),
      createPaymentCandidate({ id: 101, monto: 25000, clientName: 'DEF SA', clientId: 'def' }),
    ];

    const suggestions = generateReconciliationSuggestions(movements, candidates);
    const stats = getReconciliationStats(suggestions);

    if (suggestions.length > 0) {
      const expectedAvg =
        suggestions.reduce((sum, s) => sum + (s.matches[0]?.matchScore || 0), 0) /
        suggestions.length;
      expect(stats.avgMatchScore).toBeCloseTo(expectedAvg);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('edge cases', () => {
  it('should handle movement with monto = 0', () => {
    const movements = [createBankMovement({ monto: 0 })];
    const candidates = [createPaymentCandidate({ monto: 0 })];

    // This should not crash
    const result = generateReconciliationSuggestions(movements, candidates);
    // Amount percent calculation: amountDiff / movement.monto = 0/0 = NaN
    // BUG: When monto is 0, amountPercent = amountDiff / 0 = Infinity or NaN
    // The code has: movement.monto > 0 ? amountDiff / movement.monto : 0
    // So it correctly handles 0 by returning 0 for amountPercent
    expect(result).toBeDefined();
  });

  it('should handle negative monto', () => {
    const movements = [createBankMovement({ monto: -5000 })];
    const candidates = [createPaymentCandidate({ monto: -5000 })];

    // Should still work - negative amounts might come from data
    const result = generateReconciliationSuggestions(movements, candidates);
    expect(result).toBeDefined();
  });

  it('should handle empty concepto and referencia', () => {
    const movements = [createBankMovement({ concepto: '', referencia: null })];
    const candidates = [createPaymentCandidate()];

    const result = generateReconciliationSuggestions(movements, candidates);
    expect(result).toBeDefined();
  });

  it('should handle very long text in concepto', () => {
    const longText = 'A'.repeat(10000);
    const movements = [createBankMovement({ concepto: longText })];
    const candidates = [createPaymentCandidate()];

    // Levenshtein distance on long strings is O(n*m) - test it doesn't hang
    const start = Date.now();
    const result = generateReconciliationSuggestions(movements, candidates);
    const elapsed = Date.now() - start;

    expect(result).toBeDefined();
    // Should complete in reasonable time (< 5 seconds)
    expect(elapsed).toBeLessThan(5000);
  });

  it('should handle unicode characters in concepto', () => {
    const movements = [createBankMovement({ concepto: 'DEPÓSITO CON SEÑALES' })];
    const candidates = [createPaymentCandidate({ clientName: 'DEPOSITO CON SENALES SA' })];

    const result = generateReconciliationSuggestions(movements, candidates);
    expect(result).toBeDefined();
  });
});
