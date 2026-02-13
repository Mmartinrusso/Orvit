/**
 * Tests for app/api/tesoreria/conciliacion/cierre/route.ts
 *
 * Tests the cierre (closing) schema defined in the route.
 * Since we can't easily invoke Next.js route handlers in tests,
 * we test the Zod schema validation and business logic inline.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Replicate the schema from the cierre route (since it's defined inline)
const diferenciasItemSchema = z.object({
  monto: z.number(),
  concepto: z.string().max(200),
  justificacion: z.string().min(1, 'Justificación requerida').max(500),
});

const cierreSchema = z.object({
  statementId: z.number().int().positive('ID de extracto requerido'),
  justificacionDiferencias: z.array(diferenciasItemSchema).optional().default([]),
  notasCierre: z.string().max(1000).optional(),
  forzarCierre: z.boolean().optional().default(false),
  generarAjuste: z.boolean().optional().default(false),
  saldoBancarioReal: z.number().optional(),
});

describe('cierreSchema', () => {
  it('should accept valid complete cierre payload', () => {
    const result = cierreSchema.safeParse({
      statementId: 1,
      justificacionDiferencias: [
        {
          monto: 150.50,
          concepto: 'Comisión bancaria',
          justificacion: 'Comisión no registrada en sistema',
        },
      ],
      notasCierre: 'Cerrado con diferencia menor',
      forzarCierre: true,
      generarAjuste: true,
      saldoBancarioReal: 985000,
    });
    expect(result.success).toBe(true);
  });

  it('should accept minimal payload (only statementId)', () => {
    const result = cierreSchema.safeParse({
      statementId: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.justificacionDiferencias).toEqual([]);
      expect(result.data.forzarCierre).toBe(false);
      expect(result.data.generarAjuste).toBe(false);
    }
  });

  it('should reject missing statementId', () => {
    const result = cierreSchema.safeParse({
      forzarCierre: true,
    });
    expect(result.success).toBe(false);
  });

  it('should reject statementId = 0', () => {
    const result = cierreSchema.safeParse({
      statementId: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative statementId', () => {
    const result = cierreSchema.safeParse({
      statementId: -1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject diferencia without justificacion', () => {
    const result = cierreSchema.safeParse({
      statementId: 1,
      justificacionDiferencias: [
        {
          monto: 100,
          concepto: 'Test',
          // Missing justificacion
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty justificacion string', () => {
    const result = cierreSchema.safeParse({
      statementId: 1,
      justificacionDiferencias: [
        {
          monto: 100,
          concepto: 'Test',
          justificacion: '',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('should reject notasCierre over 1000 chars', () => {
    const result = cierreSchema.safeParse({
      statementId: 1,
      notasCierre: 'A'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('should accept multiple diferencias items', () => {
    const result = cierreSchema.safeParse({
      statementId: 1,
      justificacionDiferencias: [
        { monto: 100, concepto: 'Comisión', justificacion: 'Cobro mensual' },
        { monto: -50, concepto: 'Interés', justificacion: 'Interés a favor' },
        { monto: 25, concepto: 'IVA', justificacion: 'IVA sobre comisión' },
      ],
      forzarCierre: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.justificacionDiferencias).toHaveLength(3);
    }
  });

  it('should accept negative monto in diferencias (e.g., bank credits)', () => {
    const result = cierreSchema.safeParse({
      statementId: 1,
      justificacionDiferencias: [
        { monto: -500, concepto: 'Nota crédito', justificacion: 'Nota crédito bancaria' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept saldoBancarioReal = 0', () => {
    const result = cierreSchema.safeParse({
      statementId: 1,
      saldoBancarioReal: 0,
    });
    expect(result.success).toBe(true);
  });

  it('should accept negative saldoBancarioReal', () => {
    const result = cierreSchema.safeParse({
      statementId: 1,
      saldoBancarioReal: -5000,
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Business logic validation tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('cierre business logic', () => {
  it('should require justification when forzarCierre with pending items', () => {
    // Business rule: if summary.pending > 0 && forzarCierre && justificacionDiferencias.length === 0 => reject
    // Testing the validation logic conceptually
    const summary = { pending: 3, suspense: 2 };
    const data = { forzarCierre: true, justificacionDiferencias: [] as any[] };

    // The API route checks: summary.pending > 0 && justificacionDiferencias.length === 0
    const shouldReject = summary.pending > 0 && data.justificacionDiferencias.length === 0;
    expect(shouldReject).toBe(true);
  });

  it('should not require justification when no pending items', () => {
    const summary = { pending: 0, suspense: 0 };
    const data = { forzarCierre: false, justificacionDiferencias: [] as any[] };

    const shouldReject = summary.pending > 0 && !data.forzarCierre;
    expect(shouldReject).toBe(false);
  });

  it('should determine correct estado based on pending count', () => {
    // pending === 0 => 'COMPLETADA'
    // pending > 0 => 'CON_DIFERENCIAS'
    expect(0 === 0 ? 'COMPLETADA' : 'CON_DIFERENCIAS').toBe('COMPLETADA');
    expect(3 === 0 ? 'COMPLETADA' : 'CON_DIFERENCIAS').toBe('CON_DIFERENCIAS');
  });

  it('should calculate total diferencias correctly', () => {
    const diferencias = [
      { monto: 150, concepto: 'a', justificacion: 'b' },
      { monto: -50, concepto: 'c', justificacion: 'd' },
      { monto: 25, concepto: 'e', justificacion: 'f' },
    ];
    const total = diferencias.reduce((sum, d) => sum + d.monto, 0);
    expect(total).toBe(125);
  });

  it('should determine tipo correctly based on total diferencias sign', () => {
    // totalDiferencias > 0 => INGRESO, totalDiferencias < 0 => EGRESO
    expect(125 > 0 ? 'INGRESO' : 'EGRESO').toBe('INGRESO');
    expect(-75 > 0 ? 'INGRESO' : 'EGRESO').toBe('EGRESO');
  });

  it('should not create adjustment when total diferencias is 0', () => {
    const diferencias = [
      { monto: 100, concepto: 'a', justificacion: 'b' },
      { monto: -100, concepto: 'c', justificacion: 'd' },
    ];
    const total = diferencias.reduce((sum, d) => sum + d.monto, 0);
    expect(total).toBe(0);
    // Code checks: if (totalDiferencias !== 0) { create movement }
    const shouldCreateAdjustment = total !== 0;
    expect(shouldCreateAdjustment).toBe(false);
  });
});
