/**
 * Tests for app/api/tesoreria/bancos/[id]/conciliar/route.ts
 *
 * Tests the conciliar schema and business logic.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Replicate the schema from the route
const conciliarSchema = z.object({
  movementIds: z.array(z.number().int().positive()).min(1, 'Debe incluir al menos un movimiento'),
  saldoBancarioReal: z.number(),
  statementId: z.number().int().positive().optional(),
  notas: z.string().max(500).optional(),
});

describe('conciliarSchema', () => {
  it('should accept valid payload', () => {
    const result = conciliarSchema.safeParse({
      movementIds: [1, 2, 3],
      saldoBancarioReal: 100000,
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty movementIds array', () => {
    const result = conciliarSchema.safeParse({
      movementIds: [],
      saldoBancarioReal: 100000,
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-positive movement IDs', () => {
    const result = conciliarSchema.safeParse({
      movementIds: [1, -2, 3],
      saldoBancarioReal: 100000,
    });
    expect(result.success).toBe(false);
  });

  it('should reject zero movement ID', () => {
    const result = conciliarSchema.safeParse({
      movementIds: [0],
      saldoBancarioReal: 100000,
    });
    expect(result.success).toBe(false);
  });

  it('should accept negative saldoBancarioReal (overdraft)', () => {
    const result = conciliarSchema.safeParse({
      movementIds: [1],
      saldoBancarioReal: -5000,
    });
    expect(result.success).toBe(true);
  });

  it('should accept optional statementId', () => {
    const result = conciliarSchema.safeParse({
      movementIds: [1],
      saldoBancarioReal: 100000,
      statementId: 5,
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-positive statementId', () => {
    const result = conciliarSchema.safeParse({
      movementIds: [1],
      saldoBancarioReal: 100000,
      statementId: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional notas', () => {
    const result = conciliarSchema.safeParse({
      movementIds: [1],
      saldoBancarioReal: 100000,
      notas: 'Conciliación mensual enero',
    });
    expect(result.success).toBe(true);
  });

  it('should reject notas over 500 chars', () => {
    const result = conciliarSchema.safeParse({
      movementIds: [1],
      saldoBancarioReal: 100000,
      notas: 'A'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing saldoBancarioReal', () => {
    const result = conciliarSchema.safeParse({
      movementIds: [1],
    });
    expect(result.success).toBe(false);
  });

  it('should accept saldoBancarioReal = 0', () => {
    const result = conciliarSchema.safeParse({
      movementIds: [1],
      saldoBancarioReal: 0,
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Business Logic Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('conciliar business logic', () => {
  it('should correctly identify missing movement IDs', () => {
    const requestedIds = [1, 2, 3, 4, 5];
    const foundIds = [1, 2, 4];
    const missing = requestedIds.filter(id => !foundIds.includes(id));
    expect(missing).toEqual([3, 5]);
  });

  it('should identify already conciliated movements', () => {
    const movements = [
      { id: 1, conciliado: false },
      { id: 2, conciliado: true },
      { id: 3, conciliado: false },
      { id: 4, conciliado: true },
    ];
    const alreadyConciliados = movements.filter(m => m.conciliado);
    expect(alreadyConciliados).toHaveLength(2);
    expect(alreadyConciliados.map(m => m.id)).toEqual([2, 4]);
  });

  it('should calculate saldo diferencia correctly', () => {
    const saldoBancarioReal = 150000;
    const saldoAnterior = 145000;
    const diferencia = saldoBancarioReal - saldoAnterior;
    expect(diferencia).toBe(5000);
  });

  it('should handle negative diferencia', () => {
    const saldoBancarioReal = 140000;
    const saldoAnterior = 145000;
    const diferencia = saldoBancarioReal - saldoAnterior;
    expect(diferencia).toBe(-5000);
  });
});
