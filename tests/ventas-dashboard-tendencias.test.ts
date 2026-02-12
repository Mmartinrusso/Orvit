import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ════════════════════════════════════════════════════════════════════
// Ventas Dashboard Tendencias - Tests
//
// Covers:
//   1. calcularTendencia helper (unit tests - extracted logic)
//   2. Stats API route structure & period calculation
//   3. Grafico temporal API route (12-month map generation)
//   4. Frontend component logic (TrendIndicator, comparativaData, formatters)
//   5. Integration checks (file structure, imports, response shape)
// ════════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────────
// PART 1: calcularTendencia pure logic tests
// ────────────────────────────────────────────────────────────────────

// Re-implement the helper exactly as in the API route for isolated testing
function calcularTendencia(actual: number, anterior: number): { valor: number; variacion: number; tendencia: 'up' | 'down' | 'stable' } {
  let variacion = 0;
  let tendencia: 'up' | 'down' | 'stable' = 'stable';

  if (anterior > 0) {
    variacion = Math.round(((actual - anterior) / anterior) * 1000) / 10;
  } else if (actual > 0) {
    variacion = 100;
  }

  if (variacion > 1) tendencia = 'up';
  else if (variacion < -1) tendencia = 'down';
  else tendencia = 'stable';

  return { valor: actual, variacion, tendencia };
}

describe('calcularTendencia helper', () => {
  it('should return stable when both periods are zero', () => {
    const result = calcularTendencia(0, 0);
    expect(result).toEqual({ valor: 0, variacion: 0, tendencia: 'stable' });
  });

  it('should return up with 100% variacion when anterior is 0 and actual > 0', () => {
    const result = calcularTendencia(10, 0);
    expect(result).toEqual({ valor: 10, variacion: 100, tendencia: 'up' });
  });

  it('should return stable when actual is 0 and anterior is 0', () => {
    const result = calcularTendencia(0, 0);
    expect(result.tendencia).toBe('stable');
    expect(result.variacion).toBe(0);
  });

  it('should return down when actual drops significantly', () => {
    const result = calcularTendencia(50, 100);
    expect(result.tendencia).toBe('down');
    expect(result.variacion).toBe(-50);
  });

  it('should return up when actual increases significantly', () => {
    const result = calcularTendencia(150, 100);
    expect(result.tendencia).toBe('up');
    expect(result.variacion).toBe(50);
  });

  it('should return stable when variacion is exactly 1%', () => {
    // 101 / 100 = 1.0 => variacion = 1.0, NOT > 1, so stable
    const result = calcularTendencia(101, 100);
    expect(result.variacion).toBe(1);
    expect(result.tendencia).toBe('stable');
  });

  it('should return stable when variacion is exactly -1%', () => {
    const result = calcularTendencia(99, 100);
    expect(result.variacion).toBe(-1);
    expect(result.tendencia).toBe('stable');
  });

  it('should return up when variacion is just above 1%', () => {
    // 102 / 100 = 1.02 => variacion = 2.0 > 1
    const result = calcularTendencia(102, 100);
    expect(result.variacion).toBe(2);
    expect(result.tendencia).toBe('up');
  });

  it('should return down when variacion is just below -1%', () => {
    // 98 / 100 = 0.98 => variacion = -2.0 < -1
    const result = calcularTendencia(98, 100);
    expect(result.variacion).toBe(-2);
    expect(result.tendencia).toBe('down');
  });

  it('should round variacion to 1 decimal place', () => {
    // (33 - 100) / 100 = -0.67 => -0.67 * 1000 = -670 => round = -670 => /10 = -67.0
    const result = calcularTendencia(33, 100);
    expect(result.variacion).toBe(-67);
  });

  it('should handle fractional rounding correctly', () => {
    // (103 - 100) / 100 = 0.03 => 0.03 * 1000 = 30 => /10 = 3.0
    const result = calcularTendencia(103, 100);
    expect(result.variacion).toBe(3);
  });

  it('should handle large numbers without overflow', () => {
    const result = calcularTendencia(1_500_000, 1_000_000);
    expect(result.variacion).toBe(50);
    expect(result.tendencia).toBe('up');
  });

  it('should always set valor to the actual value', () => {
    const result = calcularTendencia(42, 100);
    expect(result.valor).toBe(42);
  });

  it('should handle case where actual is 0 and anterior > 0 (complete drop)', () => {
    const result = calcularTendencia(0, 100);
    expect(result.variacion).toBe(-100);
    expect(result.tendencia).toBe('down');
  });
});

// ────────────────────────────────────────────────────────────────────
// PART 2: Stats API route - period calculation & response structure
// ────────────────────────────────────────────────────────────────────

describe('Stats API route - period logic', () => {
  describe('period date calculations', () => {
    it('should calculate correct date ranges for 30d period', () => {
      const ahora = new Date('2025-06-15T12:00:00Z');
      const diasPeriodo = 30;
      const fechaDesde = new Date(ahora.getTime() - diasPeriodo * 24 * 60 * 60 * 1000);
      const fechaDesdeAnterior = new Date(fechaDesde.getTime() - diasPeriodo * 24 * 60 * 60 * 1000);
      const fechaHastaAnterior = fechaDesde;

      // Current period: May 16 to Jun 15
      expect(fechaDesde.getTime()).toBeLessThan(ahora.getTime());
      // Previous period: Apr 16 to May 16
      expect(fechaDesdeAnterior.getTime()).toBeLessThan(fechaDesde.getTime());
      expect(fechaHastaAnterior.getTime()).toBe(fechaDesde.getTime());

      // Both periods should be same length
      const currentPeriodMs = ahora.getTime() - fechaDesde.getTime();
      const previousPeriodMs = fechaHastaAnterior.getTime() - fechaDesdeAnterior.getTime();
      expect(currentPeriodMs).toBe(previousPeriodMs);
    });

    it('should parse periodo parameter correctly', () => {
      const periodoMap: Record<string, number> = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365,
      };

      for (const [param, expected] of Object.entries(periodoMap)) {
        let diasPeriodo: number;
        switch (param) {
          case '7d': diasPeriodo = 7; break;
          case '30d': diasPeriodo = 30; break;
          case '90d': diasPeriodo = 90; break;
          case '1y': diasPeriodo = 365; break;
          default: diasPeriodo = 30;
        }
        expect(diasPeriodo).toBe(expected);
      }
    });

    it('should default to 30d for unknown period param', () => {
      const periodoParam = 'invalid';
      let diasPeriodo: number;
      switch (periodoParam) {
        case '7d': diasPeriodo = 7; break;
        case '30d': diasPeriodo = 30; break;
        case '90d': diasPeriodo = 90; break;
        case '1y': diasPeriodo = 365; break;
        default: diasPeriodo = 30;
      }
      expect(diasPeriodo).toBe(30);
    });
  });

  describe('estadosMap construction', () => {
    it('should correctly build estadosMap from groupBy results', () => {
      const porEstadoResult = [
        { estado: 'ENVIADA', _count: 10, _sum: { total: 50000 } },
        { estado: 'ACEPTADA', _count: 5, _sum: { total: 30000 } },
        { estado: 'CONVERTIDA', _count: 3, _sum: { total: 20000 } },
        { estado: 'PERDIDA', _count: 2, _sum: { total: 10000 } },
      ];

      const estadosMap: Record<string, { count: number; total: number }> = {};
      for (const estado of porEstadoResult) {
        estadosMap[estado.estado] = {
          count: estado._count,
          total: Number(estado._sum.total || 0)
        };
      }

      expect(estadosMap['ENVIADA']?.count).toBe(10);
      expect(estadosMap['ACEPTADA']?.count).toBe(5);
      expect(estadosMap['CONVERTIDA']?.count).toBe(3);
      expect(estadosMap['PERDIDA']?.count).toBe(2);
      // Missing estados should be undefined
      expect(estadosMap['BORRADOR']).toBeUndefined();
    });

    it('should correctly calculate enviadas total (summing relevant statuses)', () => {
      const estadosMap: Record<string, { count: number; total: number }> = {
        'ENVIADA': { count: 10, total: 50000 },
        'EN_NEGOCIACION': { count: 3, total: 15000 },
        'ACEPTADA': { count: 5, total: 30000 },
        'CONVERTIDA': { count: 2, total: 12000 },
        'PERDIDA': { count: 4, total: 8000 },
      };

      const enviadas = (estadosMap['ENVIADA']?.count || 0) +
                       (estadosMap['EN_NEGOCIACION']?.count || 0) +
                       (estadosMap['ACEPTADA']?.count || 0) +
                       (estadosMap['CONVERTIDA']?.count || 0) +
                       (estadosMap['PERDIDA']?.count || 0);

      expect(enviadas).toBe(24); // 10 + 3 + 5 + 2 + 4
    });

    it('should correctly calculate aceptadas (ACEPTADA + CONVERTIDA)', () => {
      const estadosMap: Record<string, { count: number; total: number }> = {
        'ACEPTADA': { count: 5, total: 30000 },
        'CONVERTIDA': { count: 2, total: 12000 },
      };

      const aceptadas = (estadosMap['ACEPTADA']?.count || 0) + (estadosMap['CONVERTIDA']?.count || 0);
      expect(aceptadas).toBe(7);
    });

    it('should handle empty estadosMap gracefully', () => {
      const estadosMap: Record<string, { count: number; total: number }> = {};

      const enviadas = (estadosMap['ENVIADA']?.count || 0) +
                       (estadosMap['EN_NEGOCIACION']?.count || 0) +
                       (estadosMap['ACEPTADA']?.count || 0) +
                       (estadosMap['CONVERTIDA']?.count || 0) +
                       (estadosMap['PERDIDA']?.count || 0);

      expect(enviadas).toBe(0);
    });
  });

  describe('tasaAceptacion calculation', () => {
    it('should calculate correctly with valid data', () => {
      const enviadas = 20;
      const aceptadas = 8;
      const tasa = enviadas > 0 ? (aceptadas / enviadas) * 100 : 0;
      expect(tasa).toBe(40);
    });

    it('should return 0 when no enviadas', () => {
      const enviadas = 0;
      const aceptadas = 0;
      const tasa = enviadas > 0 ? (aceptadas / enviadas) * 100 : 0;
      expect(tasa).toBe(0);
    });
  });

  describe('response shape with tendencias', () => {
    it('should have correct TrendValue shape in totales', () => {
      // Simulate the response structure
      const totales = {
        cantidad: calcularTendencia(50, 40),
        montoTotal: calcularTendencia(500000, 400000),
        promedioMonto: calcularTendencia(10000, 10000),
      };

      // Each total should have valor, variacion, tendencia
      for (const key of ['cantidad', 'montoTotal', 'promedioMonto'] as const) {
        const trend = totales[key];
        expect(trend).toHaveProperty('valor');
        expect(trend).toHaveProperty('variacion');
        expect(trend).toHaveProperty('tendencia');
        expect(['up', 'down', 'stable']).toContain(trend.tendencia);
        expect(typeof trend.valor).toBe('number');
        expect(typeof trend.variacion).toBe('number');
      }
    });

    it('should have correct TrendValue shape in conversion', () => {
      const conversion = {
        enviadas: calcularTendencia(20, 15),
        aceptadas: calcularTendencia(8, 5),
        tasaAceptacion: calcularTendencia(40, 33.3),
      };

      for (const key of ['enviadas', 'aceptadas', 'tasaAceptacion'] as const) {
        const trend = conversion[key];
        expect(trend).toHaveProperty('valor');
        expect(trend).toHaveProperty('variacion');
        expect(trend).toHaveProperty('tendencia');
      }
    });
  });
});

// ────────────────────────────────────────────────────────────────────
// PART 3: Grafico temporal API route - 12-month map logic
// ────────────────────────────────────────────────────────────────────

describe('Grafico temporal API - 12-month map generation', () => {
  // Replicate the month-generation logic from the route
  function generate12MonthMap(ahora: Date) {
    const mesesMap = new Map<string, {
      mes: string;
      cotizaciones: number;
      cotizacionesMonto: number;
      ventas: number;
      ventasMonto: number;
      cobranzas: number;
      cobranzasMonto: number;
    }>();

    for (let i = 0; i < 12; i++) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - 11 + i, 1);
      const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      mesesMap.set(mesKey, {
        mes: mesKey,
        cotizaciones: 0,
        cotizacionesMonto: 0,
        ventas: 0,
        ventasMonto: 0,
        cobranzas: 0,
        cobranzasMonto: 0,
      });
    }

    return mesesMap;
  }

  it('should generate exactly 12 months', () => {
    const ahora = new Date('2025-06-15');
    const map = generate12MonthMap(ahora);
    expect(map.size).toBe(12);
  });

  it('should include current month and 11 previous months', () => {
    const ahora = new Date('2025-06-15');
    const map = generate12MonthMap(ahora);
    const keys = Array.from(map.keys());

    expect(keys[0]).toBe('2024-07');   // 11 months ago
    expect(keys[11]).toBe('2025-06');  // current month
  });

  it('should handle year boundary correctly (January)', () => {
    const ahora = new Date('2025-01-15');
    const map = generate12MonthMap(ahora);
    const keys = Array.from(map.keys());

    expect(keys[0]).toBe('2024-02');   // 11 months ago
    expect(keys[10]).toBe('2024-12');
    expect(keys[11]).toBe('2025-01');
  });

  it('should handle December correctly', () => {
    const ahora = new Date('2025-12-15');
    const map = generate12MonthMap(ahora);
    const keys = Array.from(map.keys());

    expect(keys[0]).toBe('2025-01');
    expect(keys[11]).toBe('2025-12');
  });

  it('should initialize all values to zero', () => {
    const ahora = new Date('2025-06-15');
    const map = generate12MonthMap(ahora);

    for (const entry of map.values()) {
      expect(entry.cotizaciones).toBe(0);
      expect(entry.cotizacionesMonto).toBe(0);
      expect(entry.ventas).toBe(0);
      expect(entry.ventasMonto).toBe(0);
      expect(entry.cobranzas).toBe(0);
      expect(entry.cobranzasMonto).toBe(0);
    }
  });

  it('should generate keys matching SQL TO_CHAR format (YYYY-MM)', () => {
    const ahora = new Date('2025-06-15');
    const map = generate12MonthMap(ahora);

    for (const key of map.keys()) {
      expect(key).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it('should fill SQL results into the map correctly', () => {
    const ahora = new Date('2025-06-15');
    const map = generate12MonthMap(ahora);

    // Simulate SQL results
    const cotizacionesResult = [
      { mes: '2025-03', cantidad: 15, monto: 50000 },
      { mes: '2025-06', cantidad: 22, monto: 80000 },
    ];

    for (const row of cotizacionesResult) {
      const entry = map.get(row.mes);
      if (entry) {
        entry.cotizaciones = Number(row.cantidad);
        entry.cotizacionesMonto = Number(row.monto);
      }
    }

    expect(map.get('2025-03')?.cotizaciones).toBe(15);
    expect(map.get('2025-03')?.cotizacionesMonto).toBe(50000);
    expect(map.get('2025-06')?.cotizaciones).toBe(22);
    // Months without data remain zero
    expect(map.get('2025-04')?.cotizaciones).toBe(0);
  });

  it('should ignore SQL results outside the 12-month window', () => {
    const ahora = new Date('2025-06-15');
    const map = generate12MonthMap(ahora);

    const staleResult = [
      { mes: '2024-01', cantidad: 99, monto: 999999 },
    ];

    for (const row of staleResult) {
      const entry = map.get(row.mes);
      if (entry) {
        entry.cotizaciones = Number(row.cantidad);
      }
    }

    // 2024-01 is outside the window (window starts 2024-07), so it shouldn't be in the map
    expect(map.has('2024-01')).toBe(false);
  });

  it('should produce fecha hace12Meses correctly', () => {
    const ahora = new Date('2025-06-15');
    const hace12Meses = new Date(ahora.getFullYear(), ahora.getMonth() - 11, 1);

    // Should be July 1, 2024
    expect(hace12Meses.getFullYear()).toBe(2024);
    expect(hace12Meses.getMonth()).toBe(6); // 0-indexed = July
    expect(hace12Meses.getDate()).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────
// PART 4: Frontend component logic
// ────────────────────────────────────────────────────────────────────

describe('Frontend - formatCurrency functions', () => {
  // Re-implement formatters from the component
  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  function formatCurrencyCompact(amount: number): string {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return formatCurrency(amount);
  }

  it('should format millions with M suffix', () => {
    expect(formatCurrencyCompact(1_500_000)).toBe('$1.5M');
    expect(formatCurrencyCompact(10_000_000)).toBe('$10.0M');
  });

  it('should format thousands with K suffix', () => {
    expect(formatCurrencyCompact(50_000)).toBe('$50K');
    expect(formatCurrencyCompact(1_000)).toBe('$1K');
  });

  it('should format small amounts with full currency format', () => {
    const result = formatCurrencyCompact(500);
    // Should contain the numeric value (locale-specific formatting)
    expect(result).toContain('500');
  });

  it('should handle zero', () => {
    const result = formatCurrencyCompact(0);
    // 0 < 1000 so goes through full format
    expect(result).toBeDefined();
  });

  it('should format exactly 1_000_000 as M', () => {
    expect(formatCurrencyCompact(1_000_000)).toBe('$1.0M');
  });

  it('should format 999_999 as K (not M)', () => {
    expect(formatCurrencyCompact(999_999)).toBe('$1000K');
  });
});

describe('Frontend - TrendIndicator logic', () => {
  // Test the logic that determines what the TrendIndicator renders
  interface TrendValue {
    valor: number;
    variacion: number;
    tendencia: 'up' | 'down' | 'stable';
  }

  function getTrendDisplay(trend: TrendValue) {
    if (trend.tendencia === 'stable') {
      return {
        icon: 'Minus',
        color: '#64748b', // kpiNeutral
        text: `${trend.variacion > 0 ? '+' : ''}${trend.variacion.toFixed(1)}%`,
      };
    }
    if (trend.tendencia === 'up') {
      return {
        icon: 'TrendingUp',
        color: '#10b981', // kpiPositive
        text: `+${trend.variacion.toFixed(1)}%`,
      };
    }
    return {
      icon: 'TrendingDown',
      color: '#ef4444', // kpiNegative
      text: `${trend.variacion.toFixed(1)}%`,
    };
  }

  it('should show up trend with positive color', () => {
    const display = getTrendDisplay({ valor: 50, variacion: 25, tendencia: 'up' });
    expect(display.icon).toBe('TrendingUp');
    expect(display.color).toBe('#10b981');
    expect(display.text).toBe('+25.0%');
  });

  it('should show down trend with negative color', () => {
    const display = getTrendDisplay({ valor: 30, variacion: -40, tendencia: 'down' });
    expect(display.icon).toBe('TrendingDown');
    expect(display.color).toBe('#ef4444');
    expect(display.text).toBe('-40.0%');
  });

  it('should show stable trend with neutral color', () => {
    const display = getTrendDisplay({ valor: 100, variacion: 0.5, tendencia: 'stable' });
    expect(display.icon).toBe('Minus');
    expect(display.color).toBe('#64748b');
    expect(display.text).toBe('+0.5%');
  });

  it('should show stable trend with no + sign when variacion is 0', () => {
    const display = getTrendDisplay({ valor: 100, variacion: 0, tendencia: 'stable' });
    expect(display.text).toBe('0.0%');
  });

  it('should show stable trend with negative variacion (between -1 and 0)', () => {
    const display = getTrendDisplay({ valor: 99, variacion: -0.5, tendencia: 'stable' });
    expect(display.text).toBe('-0.5%');
    expect(display.icon).toBe('Minus');
  });
});

describe('Frontend - comparativaData reverse-engineering', () => {
  // This tests the logic in the useMemo that reverses the "anterior" value
  // from the current value and variacion percentage

  interface TrendValue {
    valor: number;
    variacion: number;
    tendencia: 'up' | 'down' | 'stable';
  }

  function reverseEngineerAnterior(trend: TrendValue): number {
    return trend.variacion !== 0
      ? Math.round(trend.valor / (1 + trend.variacion / 100))
      : trend.valor;
  }

  it('should correctly reverse-engineer anterior for simple case', () => {
    // actual=150, anterior=100 => variacion = 50%
    // reverse: 150 / (1 + 50/100) = 150 / 1.5 = 100
    const trend = calcularTendencia(150, 100);
    const anterior = reverseEngineerAnterior(trend);
    expect(anterior).toBe(100);
  });

  it('should correctly reverse-engineer anterior for decrease', () => {
    // actual=50, anterior=100 => variacion = -50%
    // reverse: 50 / (1 + (-50)/100) = 50 / 0.5 = 100
    const trend = calcularTendencia(50, 100);
    const anterior = reverseEngineerAnterior(trend);
    expect(anterior).toBe(100);
  });

  it('should return same value when variacion is 0', () => {
    const trend = calcularTendencia(0, 0);
    const anterior = reverseEngineerAnterior(trend);
    expect(anterior).toBe(0);
  });

  // ┌──────────────────────────────────────────────────────┐
  // │ BUG: When anterior=0 and actual>0, variacion=100,   │
  // │ but reverse-engineering gives actual/2, not 0        │
  // └──────────────────────────────────────────────────────┘
  it('BUG: reverse-engineers incorrect anterior when actual>0 and original anterior was 0', () => {
    // actual=10, anterior=0 => variacion = 100 (special case in calcularTendencia)
    // But reverse: 10 / (1 + 100/100) = 10 / 2 = 5
    // The real anterior was 0, not 5!
    const trend = calcularTendencia(10, 0);
    expect(trend.variacion).toBe(100);

    const reversedAnterior = reverseEngineerAnterior(trend);
    // This SHOULD be 0 (the actual previous value), but it returns 5
    expect(reversedAnterior).toBe(5); // Actual behavior (bug)
    expect(reversedAnterior).not.toBe(0); // Demonstrates the bug: should be 0 but isn't
  });

  it('BUG: rounding in variacion causes imprecise reverse-engineering', () => {
    // actual=33, anterior=100 => variacion = -67.0 (rounded from -67.0)
    // reverse: 33 / (1 + (-67)/100) = 33 / 0.33 = 100 ← happens to be exact here
    const trend = calcularTendencia(33, 100);
    const anterior = reverseEngineerAnterior(trend);
    expect(anterior).toBe(100);

    // But for less clean numbers: actual=37, anterior=100
    // variacion = -63.0
    // reverse: 37 / (1 + (-63)/100) = 37 / 0.37 = 100 ← still exact
    // However: actual=103, anterior=97
    // variacion = Math.round(((103-97)/97)*1000)/10 = Math.round(61.855..)/10 = 6.2
    // reverse: 103 / (1 + 6.2/100) = 103 / 1.062 = 97.0 (approximately)
    const trend2 = calcularTendencia(103, 97);
    const anterior2 = reverseEngineerAnterior(trend2);
    // Due to rounding, this may not exactly equal 97
    // 103 / (1 + 6.2/100) = 103 / 1.062 = 97.0018... => Math.round = 97
    expect(anterior2).toBe(97); // Close enough due to rounding luck

    // Edge case: actual=7, anterior=3
    // variacion = Math.round(((7-3)/3)*1000)/10 = Math.round(1333.33)/10 = 133.3
    // reverse: 7 / (1 + 133.3/100) = 7 / 2.333 = 3.0004... => Math.round = 3
    const trend3 = calcularTendencia(7, 3);
    const anterior3 = reverseEngineerAnterior(trend3);
    expect(anterior3).toBe(3);
  });
});

// ────────────────────────────────────────────────────────────────────
// PART 5: Integration / file structure checks
// ────────────────────────────────────────────────────────────────────

describe('File structure and imports', () => {
  const projectRoot = path.resolve(__dirname, '..', 'project');

  describe('stats route file', () => {
    const filePath = path.join(projectRoot, 'app', 'api', 'ventas', 'cotizaciones', 'stats', 'route.ts');

    it('file exists', () => {
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('exports GET handler', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/export\s+async\s+function\s+GET/);
    });

    it('has force-dynamic export', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("export const dynamic = 'force-dynamic'");
    });

    it('defines calcularTendencia helper', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/function\s+calcularTendencia/);
    });

    it('requires COTIZACIONES_VIEW permission', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('VENTAS_PERMISSIONS.COTIZACIONES_VIEW');
    });

    it('returns tendencia fields in totales', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/totales:\s*\{/);
      expect(content).toContain('calcularTendencia(totalesResult._count');
    });

    it('calculates baseWhereAnterior from baseWhere', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/baseWhereAnterior.*Prisma\.QuoteWhereInput/);
      expect(content).toContain('fechaDesdeAnterior');
      expect(content).toContain('fechaHastaAnterior');
    });

    it('runs previous-period queries in parallel with current', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Both totalesAnteriorResult and porEstadoAnteriorResult should be in the Promise.all
      expect(content).toContain('totalesAnteriorResult');
      expect(content).toContain('porEstadoAnteriorResult');
      // Verify they are inside the Promise.all block
      expect(content).toContain('Promise.all([');
      // Both anterior queries declared as destructured results from the Promise.all
      expect(content).toMatch(/totalesAnteriorResult[\s\S]*porEstadoAnteriorResult[\s\S]*\]\s*=\s*await\s+Promise\.all/);
    });
  });

  describe('grafico-temporal route file', () => {
    const filePath = path.join(projectRoot, 'app', 'api', 'ventas', 'dashboard', 'grafico-temporal', 'route.ts');

    it('file exists', () => {
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('exports GET handler', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/export\s+async\s+function\s+GET/);
    });

    it('has force-dynamic export', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("export const dynamic = 'force-dynamic'");
    });

    it('requires DASHBOARD_VIEW permission', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('VENTAS_PERMISSIONS.DASHBOARD_VIEW');
    });

    it('queries 3 tables in parallel (quotes, sales, client_payments)', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('"quotes"');
      expect(content).toContain('"sales"');
      expect(content).toContain('"client_payments"');
      expect(content).toMatch(/Promise\.all\(\[/);
    });

    it('uses Prisma tagged template for SQL injection safety', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Should use prisma.$queryRaw with tagged template (backtick), not $queryRawUnsafe
      expect(content).toContain('prisma.$queryRaw`');
      expect(content).not.toContain('$queryRawUnsafe');
    });

    it('generates 12 month keys in the map', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('for (let i = 0; i < 12; i++)');
    });

    it('returns data array from mesesMap', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('Array.from(mesesMap.values())');
      expect(content).toMatch(/NextResponse\.json\(\s*\{\s*data\s*\}/);
    });
  });

  describe('cotizaciones-dashboard component file', () => {
    const filePath = path.join(projectRoot, 'components', 'ventas', 'cotizaciones-dashboard.tsx');

    it('file exists', () => {
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('is a client component', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content.startsWith("'use client'")).toBe(true);
    });

    it('defines TrendValue interface', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/interface\s+TrendValue/);
      expect(content).toContain("tendencia: 'up' | 'down' | 'stable'");
    });

    it('defines TrendIndicator component', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/function\s+TrendIndicator/);
    });

    it('defines DEFAULT_COLORS with all required color keys', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/const\s+DEFAULT_COLORS\s*=/);
      const requiredKeys = ['chart1', 'chart2', 'chart3', 'chart4', 'chart5', 'chart6', 'kpiPositive', 'kpiNegative', 'kpiNeutral'];
      for (const key of requiredKeys) {
        expect(content).toContain(key);
      }
    });

    it('fetches from /api/ventas/cotizaciones/stats', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('/api/ventas/cotizaciones/stats');
    });

    it('fetches from /api/ventas/dashboard/grafico-temporal', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('/api/ventas/dashboard/grafico-temporal');
    });

    it('has responsive grid classes', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('grid-cols-2 md:grid-cols-4');
      expect(content).toContain('grid-cols-1 lg:grid-cols-2');
    });

    it('uses Recharts LineChart for temporal evolution', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('<LineChart');
      expect(content).toContain('dataKey="cotizaciones"');
      expect(content).toContain('dataKey="ventas"');
      expect(content).toContain('dataKey="cobranzas"');
    });

    it('uses Recharts BarChart for period comparison', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('<BarChart');
      expect(content).toContain('dataKey="anterior"');
      expect(content).toContain('dataKey="actual"');
    });

    it('uses DashboardStats interface with TrendValue in totales', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/totales:\s*\{[\s\S]*?cantidad:\s*TrendValue/);
    });

    it('has GraficoTemporalData interface', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/interface\s+GraficoTemporalData/);
    });

    it('shows flex-wrap on header for responsive layout', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('flex-wrap');
    });

    it('shows loading spinner while data loads', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('animate-spin');
      expect(content).toContain('Cargando datos');
    });

    it('has error state with retry button', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('Error al cargar estadísticas');
      expect(content).toContain('Reintentar');
    });

    it('uses opacity pattern for icon backgrounds (e.g. chart1}15)', () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Check for the pattern: ${DEFAULT_COLORS.chartN}15 (opacity suffix)
      expect(content).toMatch(/DEFAULT_COLORS\.chart\d\}15/);
    });
  });
});

// ────────────────────────────────────────────────────────────────────
// PART 6: Edge cases and potential bugs
// ────────────────────────────────────────────────────────────────────

describe('Edge cases and potential bugs', () => {
  describe('baseWhereAnterior spread order', () => {
    it('should override createdAt from baseWhere correctly', () => {
      // Simulating the spread behavior
      const fechaDesde = new Date('2025-05-16');
      const fechaDesdeAnterior = new Date('2025-04-16');
      const fechaHastaAnterior = new Date('2025-05-16');

      const baseWhere = {
        companyId: 1,
        createdAt: { gte: fechaDesde },
      };

      const baseWhereAnterior = {
        ...baseWhere,
        createdAt: { gte: fechaDesdeAnterior, lt: fechaHastaAnterior },
      };

      // The spread should override createdAt - verify the last one wins
      expect(baseWhereAnterior.createdAt).toEqual({
        gte: fechaDesdeAnterior,
        lt: fechaHastaAnterior,
      });
      // Should NOT have the original gte from baseWhere
      expect(baseWhereAnterior.createdAt.gte).toBe(fechaDesdeAnterior);
    });
  });

  describe('bigint conversion from raw SQL', () => {
    it('should safely convert bigint to number', () => {
      // SQL COUNT returns bigint, the code uses Number() to convert
      const bigintValue = BigInt(42);
      expect(Number(bigintValue)).toBe(42);
    });

    it('should handle COALESCE null results', () => {
      // When SUM is null (no rows), COALESCE returns 0
      const nullValue = null;
      expect(Number(nullValue || 0)).toBe(0);
    });
  });

  describe('evolucionMensual reverse ordering', () => {
    it('should reverse SQL DESC order to get chronological ASC order', () => {
      // SQL returns DESC (newest first), code does .reverse()
      const sqlResult = [
        { mes: '2025-06' },
        { mes: '2025-05' },
        { mes: '2025-04' },
      ];

      const reversed = [...sqlResult].reverse();
      expect(reversed[0].mes).toBe('2025-04');
      expect(reversed[2].mes).toBe('2025-06');
    });
  });

  describe('porVencer diasRestantes calculation', () => {
    it('should calculate days remaining correctly', () => {
      const ahora = new Date('2025-06-15T12:00:00Z');
      const fechaValidez = new Date('2025-06-17T12:00:00Z');
      const diasRestantes = Math.ceil((fechaValidez.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
      expect(diasRestantes).toBe(2);
    });

    it('should return 0 for today', () => {
      const ahora = new Date('2025-06-15T12:00:00Z');
      const fechaValidez = new Date('2025-06-15T12:00:00Z');
      const diasRestantes = Math.ceil((fechaValidez.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
      expect(diasRestantes).toBe(0);
    });

    it('should return 1 for tomorrow even if just 1 hour ahead', () => {
      const ahora = new Date('2025-06-15T23:00:00Z');
      const fechaValidez = new Date('2025-06-16T00:00:00Z');
      const diasRestantes = Math.ceil((fechaValidez.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
      expect(diasRestantes).toBe(1);
    });
  });

  describe('temporalChartData date formatting', () => {
    // ┌────────────────────────────────────────────────────────────────┐
    // │ BUG: new Date('YYYY-MM-DD') is parsed as UTC midnight.       │
    // │ In negative-UTC timezones (e.g. UTC-3 Argentina), calling    │
    // │ getMonth()/getFullYear() returns LOCAL time, which is the    │
    // │ PREVIOUS day/month. This affects the month labels in the     │
    // │ temporal chart (cotizaciones-dashboard.tsx line 261):         │
    // │   format(new Date(item.mes + '-01'), 'MMM yy', {locale: es})│
    // │ date-fns format() also uses local time, so on UTC-3 the     │
    // │ label for '2025-06' shows 'may 25' instead of 'jun 25'.     │
    // │                                                               │
    // │ FIX: Use new Date(year, month-1, 1) or append 'T00:00:00'   │
    // │ to force local parsing, or use parseISO from date-fns.       │
    // └────────────────────────────────────────────────────────────────┘
    it('BUG: new Date("YYYY-MM-DD") is UTC, getMonth() returns local time - off by one on negative UTC offsets', () => {
      const mesKey = '2025-06';
      const date = new Date(mesKey + '-01'); // Parsed as 2025-06-01T00:00:00Z (UTC)
      const offsetMinutes = date.getTimezoneOffset(); // positive for negative-UTC

      if (offsetMinutes > 0) {
        // In negative UTC timezones (like Argentina UTC-3), getMonth() sees May 31 local
        expect(date.getMonth()).toBe(4); // May, NOT June - this is the bug
        expect(date.getMonth()).not.toBe(5); // June is what was intended
      } else {
        // In UTC or positive-UTC timezones, it works correctly
        expect(date.getMonth()).toBe(5);
      }
    });

    it('BUG: January date becomes December of previous year on negative UTC offsets', () => {
      const mesKey = '2025-01';
      const date = new Date(mesKey + '-01');
      const offsetMinutes = date.getTimezoneOffset();

      if (offsetMinutes > 0) {
        // In negative UTC timezones, this becomes 2024-12-31 local
        expect(date.getFullYear()).toBe(2024);
        expect(date.getMonth()).toBe(11); // December
      } else {
        expect(date.getFullYear()).toBe(2025);
        expect(date.getMonth()).toBe(0);
      }
    });

    it('CORRECT approach: using Date constructor with year/month avoids timezone issue', () => {
      // This is how it SHOULD be done to avoid the timezone bug
      const mesKey = '2025-06';
      const [year, month] = mesKey.split('-').map(Number);
      const date = new Date(year, month - 1, 1); // Local time, correct month
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(5); // June - always correct regardless of timezone
    });
  });

  describe('minimum data check for temporal chart', () => {
    it('should not render chart when less than 2 data points', () => {
      // The component checks: temporalChartData.length < 2
      const singlePoint = [{ mes: 'Jun 25', cotizaciones: 100, ventas: 50, cobranzas: 30 }];
      expect(singlePoint.length < 2).toBe(true);

      const twoPoints = [
        { mes: 'May 25', cotizaciones: 80, ventas: 40, cobranzas: 20 },
        { mes: 'Jun 25', cotizaciones: 100, ventas: 50, cobranzas: 30 },
      ];
      expect(twoPoints.length < 2).toBe(false);
    });
  });
});
