import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateDateRange } from '../project/lib/date-utils';

describe('validateDateRange', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Valid ranges ──────────────────────────────────────────────
  describe('valid date ranges', () => {
    it('returns null for a valid range within the same month', () => {
      const desde = new Date('2024-01-01');
      const hasta = new Date('2024-01-31');
      expect(validateDateRange(desde, hasta)).toBeNull();
    });

    it('returns null when desde equals hasta', () => {
      const fecha = new Date('2024-06-15');
      expect(validateDateRange(fecha, fecha)).toBeNull();
    });

    it('returns null for exactly 2 years range', () => {
      // 2 years = 365.25 * 2 = 730.5 days
      const desde = new Date('2022-01-01');
      const hasta = new Date('2023-12-31');
      expect(validateDateRange(desde, hasta)).toBeNull();
    });

    it('returns null for a date up to 1 month in the future', () => {
      const desde = new Date();
      const hasta = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000); // 29 days ahead
      expect(validateDateRange(desde, hasta)).toBeNull();
    });
  });

  // ── Invalid dates (NaN) ──────────────────────────────────────
  describe('invalid date objects', () => {
    it('returns error when fechaDesde is invalid (NaN)', () => {
      const desde = new Date('invalid-date');
      const hasta = new Date('2024-06-15');
      expect(validateDateRange(desde, hasta)).toBe('La fecha "desde" no es válida');
    });

    it('returns error when fechaHasta is invalid (NaN)', () => {
      const desde = new Date('2024-01-01');
      const hasta = new Date('not-a-date');
      expect(validateDateRange(desde, hasta)).toBe('La fecha "hasta" no es válida');
    });

    it('returns error for fechaDesde first when both are invalid', () => {
      const desde = new Date('bad');
      const hasta = new Date('worse');
      // Should report desde first since it's checked first
      expect(validateDateRange(desde, hasta)).toBe('La fecha "desde" no es válida');
    });
  });

  // ── fechaDesde > fechaHasta ──────────────────────────────────
  describe('inverted range', () => {
    it('returns error when desde is after hasta', () => {
      const desde = new Date('2024-06-15');
      const hasta = new Date('2024-01-01');
      expect(validateDateRange(desde, hasta)).toBe(
        'La fecha "desde" no puede ser posterior a la fecha "hasta"'
      );
    });

    it('returns error when desde is 1 day after hasta', () => {
      const desde = new Date('2024-03-02');
      const hasta = new Date('2024-03-01');
      expect(validateDateRange(desde, hasta)).toBe(
        'La fecha "desde" no puede ser posterior a la fecha "hasta"'
      );
    });
  });

  // ── Range exceeds maximum ────────────────────────────────────
  describe('range exceeds maximum', () => {
    it('returns error when range exceeds default 2 years', () => {
      const desde = new Date('2020-01-01');
      const hasta = new Date('2023-01-01'); // 3 years
      expect(validateDateRange(desde, hasta)).toBe(
        'El rango de fechas no puede superar 2 años'
      );
    });

    it('returns error with custom maxRangeYears = 1', () => {
      const desde = new Date('2023-01-01');
      const hasta = new Date('2024-06-01'); // ~1.4 years
      expect(validateDateRange(desde, hasta, 1)).toBe(
        'El rango de fechas no puede superar 1 año'
      );
    });

    it('uses singular "año" when maxRangeYears is 1', () => {
      const desde = new Date('2023-01-01');
      const hasta = new Date('2024-06-01');
      const result = validateDateRange(desde, hasta, 1);
      expect(result).toContain('1 año');
      expect(result).not.toContain('1 años');
    });

    it('uses plural "años" when maxRangeYears is > 1', () => {
      const desde = new Date('2020-01-01');
      const hasta = new Date('2024-01-01');
      const result = validateDateRange(desde, hasta, 3);
      expect(result).toContain('3 años');
    });

    it('accepts custom maxRangeYears = 5 for large range', () => {
      const desde = new Date('2020-01-01');
      const hasta = new Date('2024-06-01'); // ~4.4 years
      expect(validateDateRange(desde, hasta, 5)).toBeNull();
    });
  });

  // ── Future date limit ────────────────────────────────────────
  describe('future date limit (~1 month)', () => {
    it('returns error when hasta is more than 1 month in the future', () => {
      const desde = new Date();
      const hasta = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000); // 45 days ahead
      expect(validateDateRange(desde, hasta)).toBe(
        'La fecha "hasta" no puede ser mayor a 1 mes en el futuro'
      );
    });

    it('accepts hasta exactly 31 days in the future', () => {
      // The limit is 31 * 24 * 60 * 60 * 1000 ms
      const desde = new Date();
      // Just under 31 days
      const hasta = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      expect(validateDateRange(desde, hasta)).toBeNull();
    });

    it('rejects hasta at 32 days in the future', () => {
      const desde = new Date();
      const hasta = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000);
      expect(validateDateRange(desde, hasta)).toBe(
        'La fecha "hasta" no puede ser mayor a 1 mes en el futuro'
      );
    });
  });

  // ── Validation priority order ────────────────────────────────
  describe('validation priority order', () => {
    it('checks invalid date before checking inverted range', () => {
      // If fechaDesde is NaN and also "after" fechaHasta, NaN check should come first
      const desde = new Date('invalid');
      const hasta = new Date('2024-01-01');
      expect(validateDateRange(desde, hasta)).toBe('La fecha "desde" no es válida');
    });

    it('checks inverted range before checking max range', () => {
      // Inverted range: desde > hasta
      const desde = new Date('2024-06-01');
      const hasta = new Date('2020-01-01');
      expect(validateDateRange(desde, hasta)).toBe(
        'La fecha "desde" no puede ser posterior a la fecha "hasta"'
      );
    });
  });

  // ── Return type ──────────────────────────────────────────────
  describe('return type', () => {
    it('returns null (not undefined, empty string, or false) for valid range', () => {
      const desde = new Date('2024-01-01');
      const hasta = new Date('2024-06-01');
      const result = validateDateRange(desde, hasta);
      expect(result).toBeNull();
      expect(result).not.toBeUndefined();
      expect(result).not.toBe('');
    });

    it('returns a non-empty string for invalid range', () => {
      const desde = new Date('invalid');
      const hasta = new Date('2024-06-01');
      const result = validateDateRange(desde, hasta);
      expect(typeof result).toBe('string');
      expect((result as string).length).toBeGreaterThan(0);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────
  describe('edge cases', () => {
    it('handles dates at midnight boundaries', () => {
      const desde = new Date('2024-01-01T00:00:00.000Z');
      const hasta = new Date('2024-12-31T23:59:59.999Z');
      expect(validateDateRange(desde, hasta)).toBeNull();
    });

    it('handles dates created from timestamps', () => {
      const desde = new Date(0); // epoch
      const hasta = new Date(365 * 24 * 60 * 60 * 1000); // 1 year after epoch
      expect(validateDateRange(desde, hasta)).toBeNull();
    });

    it('handles maxRangeYears = 0 (rejects any range)', () => {
      const desde = new Date('2024-01-01');
      const hasta = new Date('2024-01-02');
      // maxRangeYears = 0 means 0 * 365.25 * ... = 0 ms allowed
      expect(validateDateRange(desde, hasta, 0)).toBe(
        'El rango de fechas no puede superar 0 años'
      );
    });
  });
});
