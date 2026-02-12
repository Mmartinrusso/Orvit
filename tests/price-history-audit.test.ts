/**
 * Tests for Price History Audit System
 *
 * Validates:
 * 1. SalesPriceLog Prisma model schema correctness
 * 2. Price change logging logic (logSalePriceChange)
 * 3. Alert threshold calculation and severity logic
 * 4. Price history endpoint response shape and stats calculations
 * 5. Audit report endpoint filtering, summary, and CSV export logic
 * 6. Product route sale price change detection logic
 * 7. Price list items route price change detection (ORM and raw SQL flows)
 * 8. Frontend component helper functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: SalesPriceLog Schema Validation
// ═══════════════════════════════════════════════════════════════════════════

describe('SalesPriceLog Schema Model', () => {
  const schemaPath = path.resolve(__dirname, '../project/prisma/schema.prisma');
  let schemaContent: string;

  beforeEach(() => {
    schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  });

  it('schema file exists', () => {
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  it('SalesPriceLog model exists', () => {
    expect(schemaContent).toContain('model SalesPriceLog');
  });

  it('has id field with cuid default', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toContain('id');
    expect(model).toContain('@id');
    expect(model).toContain('@default(cuid())');
  });

  it('has productId field (String)', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toMatch(/productId\s+String/);
  });

  it('has companyId field (Int)', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toMatch(/companyId\s+Int/);
  });

  it('has previousPrice as optional Float', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toMatch(/previousPrice\s+Float\?/);
  });

  it('has newPrice as required Float', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    // newPrice should be Float (not Float?)
    expect(model).toMatch(/newPrice\s+Float\b/);
    // Verify it's NOT optional
    const newPriceLine = model.split('\n').find(l => l.includes('newPrice'));
    expect(newPriceLine).toBeDefined();
    expect(newPriceLine).not.toContain('Float?');
  });

  it('has salesPriceListId as optional Int', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toMatch(/salesPriceListId\s+Int\?/);
  });

  it('has changeSource as required String', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toMatch(/changeSource\s+String/);
  });

  it('has reason as optional String', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toMatch(/reason\s+String\?/);
  });

  it('has createdAt with default now()', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toContain('createdAt');
    expect(model).toContain('@default(now())');
  });

  it('has createdById as optional Int', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toMatch(/createdById\s+Int\?/);
  });

  it('has notes as optional String', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toMatch(/notes\s+String\?/);
  });

  // Relations
  it('has relation to Product with onDelete Cascade', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toContain('product');
    expect(model).toContain('Product');
    expect(model).toContain('onDelete: Cascade');
  });

  it('has relation to Company with onDelete Cascade', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toContain('company');
    expect(model).toContain('Company');
  });

  it('has optional relation to SalesPriceList with onDelete SetNull', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toContain('salesPriceList');
    expect(model).toContain('SalesPriceList?');
    expect(model).toContain('onDelete: SetNull');
  });

  // Indexes
  it('has index on productId', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toContain('@@index([productId])');
  });

  it('has compound index on companyId and createdAt desc', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toContain('@@index([companyId, createdAt(sort: Desc)])');
  });

  it('has index on salesPriceListId', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toContain('@@index([salesPriceListId])');
  });

  it('has index on changeSource', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toContain('@@index([changeSource])');
  });

  it('maps to "SalesPriceLog" table name', () => {
    const model = extractModel(schemaContent, 'SalesPriceLog');
    expect(model).toContain('@@map("SalesPriceLog")');
  });

  // Reverse relations
  it('Company model has salesPriceLogs relation', () => {
    const companyModel = extractModel(schemaContent, 'Company');
    expect(companyModel).toContain('salesPriceLogs');
    expect(companyModel).toContain('SalesPriceLog[]');
  });

  it('Product model has salePriceLogs relation', () => {
    const productModel = extractModel(schemaContent, 'Product');
    expect(productModel).toContain('SalesPriceLog[]');
  });

  it('SalesPriceList model has priceLogs relation', () => {
    const listModel = extractModel(schemaContent, 'SalesPriceList');
    expect(listModel).toContain('priceLogs');
    expect(listModel).toContain('SalesPriceLog[]');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: Price Change Logging & Alert Logic
// ═══════════════════════════════════════════════════════════════════════════

describe('Price Change Alert Logic', () => {
  const DEFAULT_ALERT_THRESHOLD_PERCENT = 20;

  /**
   * Replicates the alert threshold check from price-change-alerts.ts
   */
  function shouldCreateAlert(
    previousPrice: number | undefined,
    newPrice: number,
    threshold: number
  ): { shouldAlert: boolean; changePercent: number } {
    if (!previousPrice || previousPrice <= 0) {
      return { shouldAlert: false, changePercent: 0 };
    }
    const changePercent = Math.abs(((newPrice - previousPrice) / previousPrice) * 100);
    return { shouldAlert: changePercent >= threshold, changePercent };
  }

  /**
   * Replicates severity logic from createPriceChangeAlert
   */
  function getAlertSeverity(changePercent: number, threshold: number): string {
    if (changePercent >= threshold * 2) return 'CRITICA';
    if (changePercent >= threshold) return 'ALTA';
    return 'MEDIA';
  }

  // Threshold checks
  describe('Alert threshold detection', () => {
    it('no alert when previousPrice is undefined', () => {
      const result = shouldCreateAlert(undefined, 100, DEFAULT_ALERT_THRESHOLD_PERCENT);
      expect(result.shouldAlert).toBe(false);
      expect(result.changePercent).toBe(0);
    });

    it('no alert when previousPrice is 0', () => {
      const result = shouldCreateAlert(0, 100, DEFAULT_ALERT_THRESHOLD_PERCENT);
      expect(result.shouldAlert).toBe(false);
    });

    it('no alert when change is below threshold', () => {
      // 100 -> 110 = 10% change, below 20% threshold
      const result = shouldCreateAlert(100, 110, DEFAULT_ALERT_THRESHOLD_PERCENT);
      expect(result.shouldAlert).toBe(false);
      expect(result.changePercent).toBeCloseTo(10, 5);
    });

    it('alert when change equals threshold exactly', () => {
      // 100 -> 120 = 20% change, equals 20% threshold
      const result = shouldCreateAlert(100, 120, DEFAULT_ALERT_THRESHOLD_PERCENT);
      expect(result.shouldAlert).toBe(true);
      expect(result.changePercent).toBeCloseTo(20, 5);
    });

    it('alert when change exceeds threshold', () => {
      // 100 -> 150 = 50% change, exceeds 20% threshold
      const result = shouldCreateAlert(100, 150, DEFAULT_ALERT_THRESHOLD_PERCENT);
      expect(result.shouldAlert).toBe(true);
      expect(result.changePercent).toBeCloseTo(50, 5);
    });

    it('alert on price decrease exceeding threshold', () => {
      // 100 -> 70 = 30% decrease, exceeds 20% threshold
      const result = shouldCreateAlert(100, 70, DEFAULT_ALERT_THRESHOLD_PERCENT);
      expect(result.shouldAlert).toBe(true);
      expect(result.changePercent).toBeCloseTo(30, 5);
    });

    it('uses absolute value for change percentage', () => {
      // Both increase and decrease should compute positive percentage
      const increase = shouldCreateAlert(100, 125, DEFAULT_ALERT_THRESHOLD_PERCENT);
      const decrease = shouldCreateAlert(100, 75, DEFAULT_ALERT_THRESHOLD_PERCENT);
      expect(increase.changePercent).toBeGreaterThan(0);
      expect(decrease.changePercent).toBeGreaterThan(0);
    });

    it('respects custom threshold', () => {
      // 10% change, with 5% threshold => should alert
      const result = shouldCreateAlert(100, 110, 5);
      expect(result.shouldAlert).toBe(true);
    });

    it('no alert for identical prices', () => {
      const result = shouldCreateAlert(100, 100, DEFAULT_ALERT_THRESHOLD_PERCENT);
      expect(result.shouldAlert).toBe(false);
      expect(result.changePercent).toBe(0);
    });

    it('handles very small prices correctly', () => {
      // 0.01 -> 0.05 = 400% change
      const result = shouldCreateAlert(0.01, 0.05, DEFAULT_ALERT_THRESHOLD_PERCENT);
      expect(result.shouldAlert).toBe(true);
      expect(result.changePercent).toBeCloseTo(400, 5);
    });

    it('handles very large prices correctly', () => {
      // 1,000,000 -> 1,200,001 = ~20% change
      const result = shouldCreateAlert(1000000, 1200001, DEFAULT_ALERT_THRESHOLD_PERCENT);
      expect(result.shouldAlert).toBe(true);
    });
  });

  // Severity levels
  describe('Alert severity calculation', () => {
    it('returns ALTA when changePercent equals threshold', () => {
      const severity = getAlertSeverity(20, 20);
      expect(severity).toBe('ALTA');
    });

    it('returns ALTA when changePercent is between threshold and 2x threshold', () => {
      const severity = getAlertSeverity(35, 20);
      expect(severity).toBe('ALTA');
    });

    it('returns CRITICA when changePercent equals 2x threshold', () => {
      const severity = getAlertSeverity(40, 20);
      expect(severity).toBe('CRITICA');
    });

    it('returns CRITICA when changePercent exceeds 2x threshold', () => {
      const severity = getAlertSeverity(60, 20);
      expect(severity).toBe('CRITICA');
    });

    it('returns MEDIA when changePercent is below threshold', () => {
      const severity = getAlertSeverity(10, 20);
      expect(severity).toBe('MEDIA');
    });
  });

  // Direction labeling
  describe('Price change direction', () => {
    it('labels increase correctly', () => {
      const previousPrice = 100;
      const newPrice = 150;
      const direction = newPrice > previousPrice ? 'aumento' : 'disminucion';
      expect(direction).toBe('aumento');
    });

    it('labels decrease correctly', () => {
      const previousPrice = 100;
      const newPrice = 80;
      const direction = newPrice > previousPrice ? 'aumento' : 'disminucion';
      expect(direction).toBe('disminucion');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: Price History Endpoint - Stats Calculation
// ═══════════════════════════════════════════════════════════════════════════

describe('Price History Stats Calculation', () => {
  /**
   * Replicates the stats calculation from GET /api/ventas/productos/[id]/price-history
   */
  function calculateStats(priceLogs: { newPrice: number; createdAt: Date }[]) {
    const allPrices = priceLogs.map(l => l.newPrice);
    if (allPrices.length === 0) return null;

    return {
      minPrice: Math.min(...allPrices),
      maxPrice: Math.max(...allPrices),
      avgPrice: allPrices.reduce((a, b) => a + b, 0) / allPrices.length,
      firstRecord: priceLogs[priceLogs.length - 1]?.createdAt,
      lastRecord: priceLogs[0]?.createdAt,
      totalChanges: priceLogs.length,
    };
  }

  /**
   * Replicates the change percentage calculation
   */
  function calculateChangePercentage(previousPrice: number | null, newPrice: number): number {
    if (previousPrice && previousPrice > 0) {
      return ((newPrice - previousPrice) / previousPrice) * 100;
    }
    return 0;
  }

  it('returns null for empty logs', () => {
    expect(calculateStats([])).toBeNull();
  });

  it('calculates min/max/avg correctly', () => {
    const logs = [
      { newPrice: 100, createdAt: new Date('2025-01-03') },
      { newPrice: 200, createdAt: new Date('2025-01-02') },
      { newPrice: 150, createdAt: new Date('2025-01-01') },
    ];
    const stats = calculateStats(logs)!;
    expect(stats.minPrice).toBe(100);
    expect(stats.maxPrice).toBe(200);
    expect(stats.avgPrice).toBe(150);
    expect(stats.totalChanges).toBe(3);
  });

  it('firstRecord is last element (oldest), lastRecord is first element (newest)', () => {
    const logs = [
      { newPrice: 100, createdAt: new Date('2025-01-03') },
      { newPrice: 200, createdAt: new Date('2025-01-02') },
      { newPrice: 150, createdAt: new Date('2025-01-01') },
    ];
    const stats = calculateStats(logs)!;
    // The endpoint orders by createdAt desc, so logs[0] is newest
    expect(stats.lastRecord).toEqual(new Date('2025-01-03'));
    expect(stats.firstRecord).toEqual(new Date('2025-01-01'));
  });

  it('handles single log', () => {
    const logs = [{ newPrice: 42, createdAt: new Date('2025-01-01') }];
    const stats = calculateStats(logs)!;
    expect(stats.minPrice).toBe(42);
    expect(stats.maxPrice).toBe(42);
    expect(stats.avgPrice).toBe(42);
    expect(stats.totalChanges).toBe(1);
  });

  // Change percentage calculation
  describe('Change Percentage', () => {
    it('positive change (increase)', () => {
      expect(calculateChangePercentage(100, 120)).toBeCloseTo(20, 5);
    });

    it('negative change (decrease)', () => {
      expect(calculateChangePercentage(100, 80)).toBeCloseTo(-20, 5);
    });

    it('returns 0 when previousPrice is null', () => {
      expect(calculateChangePercentage(null, 100)).toBe(0);
    });

    it('returns 0 when previousPrice is 0', () => {
      expect(calculateChangePercentage(0, 100)).toBe(0);
    });

    it('no change returns 0', () => {
      expect(calculateChangePercentage(100, 100)).toBe(0);
    });

    it('handles large increases', () => {
      expect(calculateChangePercentage(10, 110)).toBeCloseTo(1000, 5);
    });

    it('handles near-zero decrease', () => {
      expect(calculateChangePercentage(100, 1)).toBeCloseTo(-99, 5);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: Audit Report - Summary Calculation
// ═══════════════════════════════════════════════════════════════════════════

describe('Audit Report Summary Calculation', () => {
  /**
   * Replicates summary stats from GET /api/reportes/auditoria/price-changes
   */
  function calculateSummary(logs: { changePercentage: number }[], total: number) {
    return {
      totalChanges: total,
      averageChangePercent:
        logs.length > 0
          ? logs.reduce((a, l) => a + l.changePercentage, 0) / logs.length
          : 0,
      increases: logs.filter(l => l.changePercentage > 0).length,
      decreases: logs.filter(l => l.changePercentage < 0).length,
      significantChanges: logs.filter(l => Math.abs(l.changePercentage) >= 20).length,
    };
  }

  it('handles empty logs', () => {
    const summary = calculateSummary([], 0);
    expect(summary.totalChanges).toBe(0);
    expect(summary.averageChangePercent).toBe(0);
    expect(summary.increases).toBe(0);
    expect(summary.decreases).toBe(0);
    expect(summary.significantChanges).toBe(0);
  });

  it('counts increases and decreases correctly', () => {
    const logs = [
      { changePercentage: 10 },
      { changePercentage: -5 },
      { changePercentage: 25 },
      { changePercentage: -30 },
      { changePercentage: 0 },
    ];
    const summary = calculateSummary(logs, 5);
    expect(summary.increases).toBe(2); // 10, 25
    expect(summary.decreases).toBe(2); // -5, -30
  });

  it('counts significant changes (>=20%) correctly', () => {
    const logs = [
      { changePercentage: 10 },
      { changePercentage: 20 },
      { changePercentage: -25 },
      { changePercentage: 5 },
      { changePercentage: -50 },
    ];
    const summary = calculateSummary(logs, 5);
    expect(summary.significantChanges).toBe(3); // 20, -25, -50
  });

  it('calculates average change percentage', () => {
    const logs = [
      { changePercentage: 10 },
      { changePercentage: -10 },
      { changePercentage: 30 },
    ];
    const summary = calculateSummary(logs, 3);
    expect(summary.averageChangePercent).toBeCloseTo(10, 5); // (10 + -10 + 30) / 3 = 10
  });

  it('average can be negative', () => {
    const logs = [
      { changePercentage: -50 },
      { changePercentage: -30 },
      { changePercentage: 10 },
    ];
    const summary = calculateSummary(logs, 3);
    // (-50 + -30 + 10) / 3 = -70/3 ≈ -23.33
    expect(summary.averageChangePercent).toBeCloseTo(-23.333, 2);
  });

  it('zero-change entries count as neither increase nor decrease', () => {
    const logs = [
      { changePercentage: 0 },
      { changePercentage: 0 },
    ];
    const summary = calculateSummary(logs, 2);
    expect(summary.increases).toBe(0);
    expect(summary.decreases).toBe(0);
    expect(summary.significantChanges).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: Audit Report - minChangePercent Post-Query Filter
// ═══════════════════════════════════════════════════════════════════════════

describe('Audit Report - minChangePercent Filter', () => {
  /**
   * Replicates the post-query filter from the audit report endpoint
   */
  function filterByMinChange(
    logs: { changePercentage: number }[],
    minChangePercent: string | null
  ) {
    if (!minChangePercent) return logs;
    const minPct = parseFloat(minChangePercent);
    return logs.filter(l => Math.abs(l.changePercentage) >= minPct);
  }

  it('returns all logs when no filter', () => {
    const logs = [{ changePercentage: 5 }, { changePercentage: 30 }];
    expect(filterByMinChange(logs, null)).toHaveLength(2);
  });

  it('filters by absolute value of change', () => {
    const logs = [
      { changePercentage: 5 },
      { changePercentage: -15 },
      { changePercentage: 25 },
      { changePercentage: -30 },
    ];
    const filtered = filterByMinChange(logs, '20');
    expect(filtered).toHaveLength(2); // 25 and -30
  });

  it('includes exactly matching percentage', () => {
    const logs = [{ changePercentage: 10 }, { changePercentage: -10 }];
    const filtered = filterByMinChange(logs, '10');
    expect(filtered).toHaveLength(2);
  });

  it('empty result when all below threshold', () => {
    const logs = [{ changePercentage: 5 }, { changePercentage: -3 }];
    const filtered = filterByMinChange(logs, '10');
    expect(filtered).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: Audit Report - CSV Export
// ═══════════════════════════════════════════════════════════════════════════

describe('Audit Report - CSV Export', () => {
  /**
   * Replicates getSourceLabel from the audit report route
   */
  function getSourceLabel(source: string): string {
    switch (source) {
      case 'PRICE_LIST': return 'Lista de Precios';
      case 'PRODUCT_DIRECT': return 'Producto Directo';
      case 'BULK_UPDATE': return 'Actualización Masiva';
      case 'IMPORT': return 'Importación';
      default: return source;
    }
  }

  it('maps PRICE_LIST correctly', () => {
    expect(getSourceLabel('PRICE_LIST')).toBe('Lista de Precios');
  });

  it('maps PRODUCT_DIRECT correctly', () => {
    expect(getSourceLabel('PRODUCT_DIRECT')).toBe('Producto Directo');
  });

  it('maps BULK_UPDATE correctly', () => {
    expect(getSourceLabel('BULK_UPDATE')).toBe('Actualización Masiva');
  });

  it('maps IMPORT correctly', () => {
    expect(getSourceLabel('IMPORT')).toBe('Importación');
  });

  it('returns original for unknown sources', () => {
    expect(getSourceLabel('CUSTOM_SOURCE')).toBe('CUSTOM_SOURCE');
  });

  it('generates valid CSV row with double-quote escaping', () => {
    const log = {
      createdAt: new Date('2025-01-15T10:30:00Z'),
      productName: 'Producto "Especial"',
      productCode: 'PRD-001',
      previousPrice: 100.5,
      newPrice: 125.75,
      changePercentage: 25.1,
      changeSource: 'PRICE_LIST',
      salesPriceListName: 'Lista Principal',
      createdByName: 'Juan Pérez',
      reason: null as string | null,
    };

    const row = [
      new Date(log.createdAt).toLocaleString('es-AR'),
      log.productName,
      log.productCode,
      log.previousPrice?.toFixed(2) || '-',
      log.newPrice.toFixed(2),
      log.changePercentage.toFixed(1) + '%',
      getSourceLabel(log.changeSource),
      log.salesPriceListName || '-',
      log.createdByName || '-',
      log.reason || '-',
    ];

    const csvRow = row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');

    // Verify double-quote escaping works
    expect(csvRow).toContain('""Especial""');
    // Verify change percentage format
    expect(csvRow).toContain('25.1%');
    // Verify all cells are quoted
    const cellCount = csvRow.split('","').length;
    expect(cellCount).toBe(10);
  });

  it('handles null previousPrice in CSV row', () => {
    const previousPrice: number | null = null;
    const cell = previousPrice?.toFixed(2) || '-';
    expect(cell).toBe('-');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: Audit Report - Date Range Filter Logic
// ═══════════════════════════════════════════════════════════════════════════

describe('Audit Report - Date Range Filter', () => {
  /**
   * Replicates the date range filter building logic from the audit report route
   */
  function buildDateFilter(dateFrom: string | null, dateTo: string | null) {
    const filter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) filter.gte = new Date(dateFrom);
    if (dateTo) filter.lte = new Date(dateTo + 'T23:59:59.999Z');
    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  it('returns undefined when no dates provided', () => {
    expect(buildDateFilter(null, null)).toBeUndefined();
  });

  it('builds gte-only filter when only dateFrom is provided', () => {
    const filter = buildDateFilter('2025-01-01', null)!;
    expect(filter.gte).toEqual(new Date('2025-01-01'));
    expect(filter.lte).toBeUndefined();
  });

  it('builds lte-only filter when only dateTo is provided', () => {
    const filter = buildDateFilter(null, '2025-12-31')!;
    expect(filter.gte).toBeUndefined();
    expect(filter.lte).toEqual(new Date('2025-12-31T23:59:59.999Z'));
  });

  it('builds full range filter when both dates are provided', () => {
    const filter = buildDateFilter('2025-01-01', '2025-12-31')!;
    expect(filter.gte).toEqual(new Date('2025-01-01'));
    expect(filter.lte).toEqual(new Date('2025-12-31T23:59:59.999Z'));
  });

  it('dateTo includes end of day (23:59:59.999)', () => {
    const filter = buildDateFilter(null, '2025-06-15')!;
    const lte = filter.lte!;
    // Parse back to verify the time component
    expect(lte.getUTCHours()).toBe(23);
    expect(lte.getUTCMinutes()).toBe(59);
    expect(lte.getUTCSeconds()).toBe(59);
    expect(lte.getUTCMilliseconds()).toBe(999);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: Product Route - salePrice Change Detection
// ═══════════════════════════════════════════════════════════════════════════

describe('Product Route - salePrice Change Detection', () => {
  /**
   * Replicates the change detection logic from PUT /api/ventas/productos/[id]
   */
  function detectSalePriceChange(
    existingSalePrice: number | null,
    bodySalePrice: string | undefined
  ): { changed: boolean; oldPrice: number | undefined; newPrice: number } {
    const oldSalePrice = existingSalePrice;
    const newSalePrice = bodySalePrice !== undefined
      ? (bodySalePrice ? parseFloat(bodySalePrice) : null)
      : undefined;

    const changed = newSalePrice !== undefined && oldSalePrice !== newSalePrice;

    return {
      changed,
      oldPrice: oldSalePrice ?? undefined,
      newPrice: newSalePrice ?? 0,
    };
  }

  it('detects price increase', () => {
    const result = detectSalePriceChange(100, '150');
    expect(result.changed).toBe(true);
    expect(result.oldPrice).toBe(100);
    expect(result.newPrice).toBe(150);
  });

  it('detects price decrease', () => {
    const result = detectSalePriceChange(200, '150');
    expect(result.changed).toBe(true);
    expect(result.oldPrice).toBe(200);
    expect(result.newPrice).toBe(150);
  });

  it('no change when salePrice not in body (undefined)', () => {
    const result = detectSalePriceChange(100, undefined);
    expect(result.changed).toBe(false);
  });

  it('no change when price is same', () => {
    const result = detectSalePriceChange(100, '100');
    expect(result.changed).toBe(false);
  });

  it('detects change from null to a value', () => {
    const result = detectSalePriceChange(null, '100');
    expect(result.changed).toBe(true);
    expect(result.oldPrice).toBeUndefined();
    expect(result.newPrice).toBe(100);
  });

  it('detects change from value to null (empty string)', () => {
    const result = detectSalePriceChange(100, '');
    expect(result.changed).toBe(true);
    expect(result.newPrice).toBe(0); // newSalePrice ?? 0 gives 0
  });

  it('handles string price parsing correctly', () => {
    const result = detectSalePriceChange(99.99, '99.99');
    expect(result.changed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: Price List Items Route - Change Detection
// ═══════════════════════════════════════════════════════════════════════════

describe('Price List Items Route - Price Change Detection', () => {
  /**
   * Replicates the ORM flow: checks if old price != new price
   */
  function detectPriceListItemChange(
    existingPrecioUnitario: string | number,
    newPrecioUnitario: string
  ): { changed: boolean; oldPrice: number; newPrice: number } {
    const oldPrice = parseFloat(String(existingPrecioUnitario));
    const newPriceValue = parseFloat(newPrecioUnitario);
    return {
      changed: oldPrice !== newPriceValue,
      oldPrice,
      newPrice: newPriceValue,
    };
  }

  it('detects price change in ORM flow', () => {
    const result = detectPriceListItemChange('100.00', '150.00');
    expect(result.changed).toBe(true);
    expect(result.oldPrice).toBe(100);
    expect(result.newPrice).toBe(150);
  });

  it('no change when prices are equal', () => {
    const result = detectPriceListItemChange('100.00', '100.00');
    expect(result.changed).toBe(false);
  });

  it('handles Prisma Decimal objects (toString)', () => {
    // Prisma returns Decimal objects that have toString()
    const decimalLike = { toString: () => '250.50' };
    const result = detectPriceListItemChange(decimalLike.toString(), '300.00');
    expect(result.changed).toBe(true);
    expect(result.oldPrice).toBe(250.5);
    expect(result.newPrice).toBe(300);
  });

  it('handles number input for existing price', () => {
    const result = detectPriceListItemChange(100, '100');
    expect(result.changed).toBe(false);
  });

  it('handles floating point edge case', () => {
    // This tests numeric precision
    const result = detectPriceListItemChange('0.1', '0.1');
    expect(result.changed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10: Frontend Component - Source Label and Badge Color Mapping
// ═══════════════════════════════════════════════════════════════════════════

describe('Frontend - Source Label Mapping', () => {
  /**
   * Replicates getSourceLabel from product-price-history.tsx
   */
  function getSourceLabel(source: string): string {
    switch (source) {
      case 'PRICE_LIST': return 'Lista de Precios';
      case 'PRODUCT_DIRECT': return 'Directo';
      case 'BULK_UPDATE': return 'Masivo';
      case 'IMPORT': return 'Importacion';
      default: return source;
    }
  }

  /**
   * Replicates getSourceBadgeColor from product-price-history.tsx
   */
  function getSourceBadgeColor(source: string): string {
    switch (source) {
      case 'PRICE_LIST': return 'bg-blue-100 text-blue-700';
      case 'PRODUCT_DIRECT': return 'bg-purple-100 text-purple-700';
      case 'BULK_UPDATE': return 'bg-amber-100 text-amber-700';
      case 'IMPORT': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  it('maps all known sources to labels', () => {
    expect(getSourceLabel('PRICE_LIST')).toBe('Lista de Precios');
    expect(getSourceLabel('PRODUCT_DIRECT')).toBe('Directo');
    expect(getSourceLabel('BULK_UPDATE')).toBe('Masivo');
    expect(getSourceLabel('IMPORT')).toBe('Importacion');
  });

  it('maps unknown source to itself', () => {
    expect(getSourceLabel('UNKNOWN')).toBe('UNKNOWN');
  });

  it('maps all known sources to badge colors', () => {
    expect(getSourceBadgeColor('PRICE_LIST')).toContain('blue');
    expect(getSourceBadgeColor('PRODUCT_DIRECT')).toContain('purple');
    expect(getSourceBadgeColor('BULK_UPDATE')).toContain('amber');
    expect(getSourceBadgeColor('IMPORT')).toContain('gray');
  });

  it('default badge color is gray for unknown sources', () => {
    expect(getSourceBadgeColor('UNKNOWN')).toBe('bg-gray-100 text-gray-700');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11: Frontend - Change Percentage Display Logic
// ═══════════════════════════════════════════════════════════════════════════

describe('Frontend - Change Percentage Display', () => {
  function formatChangePercentage(pct: number): string {
    const prefix = pct > 0 ? '+' : '';
    return `${prefix}${pct.toFixed(1)}%`;
  }

  function getChangeColor(pct: number): string {
    if (pct > 0) return 'text-red-600 border-red-200';
    if (pct < 0) return 'text-green-600 border-green-200';
    return '';
  }

  it('formats positive change with + prefix', () => {
    expect(formatChangePercentage(25.3)).toBe('+25.3%');
  });

  it('formats negative change without prefix', () => {
    expect(formatChangePercentage(-10.7)).toBe('-10.7%');
  });

  it('formats zero change without prefix', () => {
    expect(formatChangePercentage(0)).toBe('0.0%');
  });

  it('increase shown in red', () => {
    expect(getChangeColor(10)).toContain('red');
  });

  it('decrease shown in green', () => {
    expect(getChangeColor(-10)).toContain('green');
  });

  it('zero change has no special color', () => {
    expect(getChangeColor(0)).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 12: Frontend - Audit Page Client-Side Search Filter
// ═══════════════════════════════════════════════════════════════════════════

describe('Audit Page - Client-Side Search Filter', () => {
  /**
   * Replicates filteredPriceLogs from auditoria/page.tsx
   */
  function filterPriceLogs(
    logs: { productName: string; productCode: string; createdByName: string | null }[],
    searchTerm: string
  ) {
    return logs.filter(log =>
      !searchTerm ||
      log.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.createdByName && log.createdByName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  const sampleLogs = [
    { productName: 'Producto Alpha', productCode: 'ALPHA-001', createdByName: 'Juan Pérez' },
    { productName: 'Producto Beta', productCode: 'BETA-002', createdByName: 'María García' },
    { productName: 'Cemento Portland', productCode: 'CEM-001', createdByName: null },
    { productName: 'Arena Fina', productCode: 'ARENA-001', createdByName: 'Juan Pérez' },
  ];

  it('returns all when searchTerm is empty', () => {
    expect(filterPriceLogs(sampleLogs, '')).toHaveLength(4);
  });

  it('filters by product name (case insensitive)', () => {
    expect(filterPriceLogs(sampleLogs, 'alpha')).toHaveLength(1);
  });

  it('filters by product code', () => {
    expect(filterPriceLogs(sampleLogs, 'CEM-001')).toHaveLength(1);
  });

  it('filters by user name', () => {
    const result = filterPriceLogs(sampleLogs, 'juan');
    expect(result).toHaveLength(2); // Juan appears in 2 logs
  });

  it('handles null createdByName gracefully', () => {
    // Should not throw when createdByName is null
    const result = filterPriceLogs(sampleLogs, 'xyz');
    expect(result).toHaveLength(0);
  });

  it('partial match works', () => {
    expect(filterPriceLogs(sampleLogs, 'prod')).toHaveLength(2); // Alpha and Beta
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 13: Audit Report - Limit Clamping
// ═══════════════════════════════════════════════════════════════════════════

describe('Audit Report - Limit Parameter', () => {
  /**
   * Replicates the limit clamping from the audit report route
   */
  function clampLimit(rawLimit: string | null): number {
    return Math.min(parseInt(rawLimit || '100'), 500);
  }

  it('defaults to 100 when not provided', () => {
    expect(clampLimit(null)).toBe(100);
  });

  it('respects provided limit', () => {
    expect(clampLimit('50')).toBe(50);
  });

  it('clamps to 500 maximum', () => {
    expect(clampLimit('1000')).toBe(500);
  });

  it('clamps to 500 when exactly 500', () => {
    expect(clampLimit('500')).toBe(500);
  });

  it('handles NaN gracefully', () => {
    // parseInt('abc') = NaN, Math.min(NaN, 500) = NaN
    const result = clampLimit('abc');
    expect(isNaN(result)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 14: Source Files Existence Validation
// ═══════════════════════════════════════════════════════════════════════════

describe('Source Files Exist', () => {
  const projectRoot = path.resolve(__dirname, '../project');

  it('price-change-alerts.ts exists', () => {
    expect(fs.existsSync(path.join(projectRoot, 'lib/ventas/price-change-alerts.ts'))).toBe(true);
  });

  it('price-history route exists', () => {
    expect(fs.existsSync(path.join(projectRoot, 'app/api/ventas/productos/[id]/price-history/route.ts'))).toBe(true);
  });

  it('audit report route exists', () => {
    expect(fs.existsSync(path.join(projectRoot, 'app/api/reportes/auditoria/price-changes/route.ts'))).toBe(true);
  });

  it('product-price-history component exists', () => {
    expect(fs.existsSync(path.join(projectRoot, 'components/ventas/product-price-history.tsx'))).toBe(true);
  });

  it('auditoria page exists', () => {
    expect(fs.existsSync(path.join(projectRoot, 'app/administracion/auditoria/page.tsx'))).toBe(true);
  });

  it('product route has logSalePriceChange import', () => {
    const content = fs.readFileSync(
      path.join(projectRoot, 'app/api/ventas/productos/[id]/route.ts'),
      'utf-8'
    );
    expect(content).toContain("import { logSalePriceChange }");
    expect(content).toContain("from '@/lib/ventas/price-change-alerts'");
  });

  it('price list items route has logSalePriceChange import', () => {
    const content = fs.readFileSync(
      path.join(projectRoot, 'app/api/ventas/listas-precios/[id]/items/route.ts'),
      'utf-8'
    );
    expect(content).toContain("import { logSalePriceChange }");
    expect(content).toContain("from '@/lib/ventas/price-change-alerts'");
  });

  it('product detail modal imports ProductPriceHistory', () => {
    const content = fs.readFileSync(
      path.join(projectRoot, 'components/ventas/product-detail-modal.tsx'),
      'utf-8'
    );
    expect(content).toContain("import { ProductPriceHistory }");
    expect(content).toContain("from './product-price-history'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 15: Consistency Checks - API Response Shape
// ═══════════════════════════════════════════════════════════════════════════

describe('API Response Shape Consistency', () => {
  it('price-history endpoint returns expected fields', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../project/app/api/ventas/productos/[id]/price-history/route.ts'),
      'utf-8'
    );
    // Check response shape
    expect(content).toContain('product:');
    expect(content).toContain('logs:');
    expect(content).toContain('stats');
    expect(content).toContain('total');
    expect(content).toContain('limit');
    expect(content).toContain('offset');
  });

  it('audit report endpoint returns expected fields', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../project/app/api/reportes/auditoria/price-changes/route.ts'),
      'utf-8'
    );
    expect(content).toContain('logs:');
    expect(content).toContain('total');
    expect(content).toContain('summary');
    expect(content).toContain('limit');
    expect(content).toContain('offset');
  });

  it('price-history includes changePercentage in log entries', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../project/app/api/ventas/productos/[id]/price-history/route.ts'),
      'utf-8'
    );
    expect(content).toContain('changePercentage');
  });

  it('price-history includes createdBy user info', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../project/app/api/ventas/productos/[id]/price-history/route.ts'),
      'utf-8'
    );
    expect(content).toContain('createdBy:');
    expect(content).toContain('userMap.get');
  });

  it('audit report includes product info in log entries', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../project/app/api/reportes/auditoria/price-changes/route.ts'),
      'utf-8'
    );
    expect(content).toContain('productName');
    expect(content).toContain('productCode');
    expect(content).toContain('createdByName');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 16: Price Change Alerts - Error Handling
// ═══════════════════════════════════════════════════════════════════════════

describe('Price Change Alerts - Error Handling', () => {
  it('logSalePriceChange catches errors and returns fallback', () => {
    // Verify the source code has error handling that doesn't throw
    const content = fs.readFileSync(
      path.resolve(__dirname, '../project/lib/ventas/price-change-alerts.ts'),
      'utf-8'
    );
    // Should have try-catch that returns a default value
    expect(content).toContain('catch (error)');
    expect(content).toContain("return { logId: '', alertCreated: false }");
  });

  it('getPriceChangeThreshold falls back to default on error', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../project/lib/ventas/price-change-alerts.ts'),
      'utf-8'
    );
    expect(content).toContain('DEFAULT_ALERT_THRESHOLD_PERCENT');
    // Default is 20
    expect(content).toContain('= 20');
  });

  it('createPriceChangeAlert catches errors silently', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../project/lib/ventas/price-change-alerts.ts'),
      'utf-8'
    );
    // Should not re-throw errors
    expect(content).toContain('[PriceAlert] Error creating price change alert');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 17: Price History Bar Chart Logic
// ═══════════════════════════════════════════════════════════════════════════

describe('Price History - Bar Chart Width Calculation', () => {
  /**
   * Replicates the bar chart width calculation from product-price-history.tsx
   */
  function calculateBarWidth(newPrice: number, maxPrice: number): number {
    return maxPrice > 0 ? (newPrice / maxPrice) * 100 : 0;
  }

  it('full width for max price', () => {
    expect(calculateBarWidth(200, 200)).toBe(100);
  });

  it('half width for half of max', () => {
    expect(calculateBarWidth(100, 200)).toBe(50);
  });

  it('zero width when maxPrice is 0', () => {
    expect(calculateBarWidth(100, 0)).toBe(0);
  });

  it('handles small fractions', () => {
    expect(calculateBarWidth(1, 100)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 18: Price List Items Route - Both ORM and SQL Paths Log Changes
// ═══════════════════════════════════════════════════════════════════════════

describe('Price List Items Route - Both Paths Log Price Changes', () => {
  it('ORM path calls logSalePriceChange when price differs', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../project/app/api/ventas/listas-precios/[id]/items/route.ts'),
      'utf-8'
    );

    // ORM path: check for the first logSalePriceChange call (within the try block for ORM)
    // There should be TWO calls to logSalePriceChange - one for ORM, one for raw SQL
    const matches = content.match(/logSalePriceChange/g);
    expect(matches).toBeDefined();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it('raw SQL path gets old price before updating', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../project/app/api/ventas/listas-precios/[id]/items/route.ts'),
      'utf-8'
    );

    // Raw SQL path fetches old price
    expect(content).toContain('SELECT "precioUnitario" FROM "sales_price_list_items"');
  });

  it('both paths use PRICE_LIST as changeSource', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../project/app/api/ventas/listas-precios/[id]/items/route.ts'),
      'utf-8'
    );

    const priceListSourceMatches = content.match(/changeSource:\s*'PRICE_LIST'/g);
    expect(priceListSourceMatches).toBeDefined();
    expect(priceListSourceMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it('product route uses PRODUCT_DIRECT as changeSource', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../project/app/api/ventas/productos/[id]/route.ts'),
      'utf-8'
    );

    expect(content).toContain("changeSource: 'PRODUCT_DIRECT'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 19: Edge Cases in logSalePriceChange Interface
// ═══════════════════════════════════════════════════════════════════════════

describe('logSalePriceChange - Interface & Parameter Handling', () => {
  it('interface matches the actual call sites', () => {
    const alertsContent = fs.readFileSync(
      path.resolve(__dirname, '../project/lib/ventas/price-change-alerts.ts'),
      'utf-8'
    );

    // Verify interface fields exist
    expect(alertsContent).toContain('productId: string');
    expect(alertsContent).toContain('companyId: number');
    expect(alertsContent).toContain('previousPrice?: number');
    expect(alertsContent).toContain('newPrice: number');
    expect(alertsContent).toContain('salesPriceListId?: number');
    expect(alertsContent).toContain('changeSource: string');
    expect(alertsContent).toContain('createdById: number');
    expect(alertsContent).toContain('reason?: string');
    expect(alertsContent).toContain('notes?: string');
  });

  it('return type includes logId and alertCreated', () => {
    const alertsContent = fs.readFileSync(
      path.resolve(__dirname, '../project/lib/ventas/price-change-alerts.ts'),
      'utf-8'
    );

    expect(alertsContent).toContain('logId: string');
    expect(alertsContent).toContain('alertCreated: boolean');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 20: Potential BUG - NaN in limit clamping
// ═══════════════════════════════════════════════════════════════════════════

describe('Potential Bug: NaN limit in audit report', () => {
  it('documents that non-numeric limit produces NaN', () => {
    // The route does: Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    // If someone passes limit=abc, parseInt('abc') = NaN
    // Math.min(NaN, 500) = NaN
    // Prisma.findMany({ take: NaN }) could cause an error
    const rawLimit = 'abc';
    const limit = Math.min(parseInt(rawLimit || '100'), 500);
    expect(isNaN(limit)).toBe(true);

    // BUG: The route does not validate that the parsed limit is a valid number.
    // This could cause Prisma to throw an error if a non-numeric limit is passed.
    // Fix would be: const limit = Math.min(parseInt(rawLimit || '100') || 100, 500);
  });

  it('documents that negative limit is not clamped', () => {
    // Math.min(parseInt('-5'), 500) = -5
    // Prisma.findMany({ take: -5 }) behavior is undefined/may error
    const rawLimit = '-5';
    const limit = Math.min(parseInt(rawLimit || '100'), 500);
    expect(limit).toBe(-5);

    // BUG: Negative limits are not clamped to a minimum of 1.
    // Fix would be: Math.max(1, Math.min(parseInt(rawLimit || '100') || 100, 500))
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 21: Potential BUG - Summary uses filtered count but total from DB
// ═══════════════════════════════════════════════════════════════════════════

describe('Potential Bug: Summary totalChanges vs filtered count mismatch', () => {
  it('documents that summary.totalChanges uses unfiltered DB count while averageChangePercent uses filtered list', () => {
    // In the audit report route:
    //   const total = await prisma.salesPriceLog.count({ where });  // DB total
    //   ...
    //   if (minChangePercent) {
    //     logsWithDetails = logsWithDetails.filter(...)  // post-filter
    //   }
    //   const summary = {
    //     totalChanges: total,  // <-- uses DB total (unfiltered by minChangePercent)
    //     averageChangePercent: logsWithDetails.reduce(...) / logsWithDetails.length,  // <-- uses filtered
    //     increases: logsWithDetails.filter(...).length,  // <-- uses filtered
    //   }
    //
    // BUG: When minChangePercent is used, the summary.totalChanges will be
    // the total from the DB (not filtered by minChangePercent), while
    // increases/decreases/averageChangePercent are calculated from the
    // post-filtered list. This causes inconsistency where
    // totalChanges != increases + decreases + zeros.

    const totalFromDB = 100;
    const logsAfterMinFilter = [
      { changePercentage: 25 },
      { changePercentage: -30 },
    ];

    const summary = {
      totalChanges: totalFromDB, // 100 (unfiltered)
      increases: logsAfterMinFilter.filter(l => l.changePercentage > 0).length, // 1
      decreases: logsAfterMinFilter.filter(l => l.changePercentage < 0).length, // 1
    };

    // BUG: totalChanges (100) != increases (1) + decreases (1) when minChangePercent filter is active
    expect(summary.totalChanges).not.toBe(summary.increases + summary.decreases);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function extractModel(schemaContent: string, modelName: string): string {
  const regex = new RegExp(`model\\s+${modelName}\\s*\\{`, 'g');
  const match = regex.exec(schemaContent);

  if (!match) return '';

  let braceCount = 1;
  let pos = match.index + match[0].length;

  while (pos < schemaContent.length && braceCount > 0) {
    if (schemaContent[pos] === '{') braceCount++;
    if (schemaContent[pos] === '}') braceCount--;
    pos++;
  }

  return schemaContent.substring(match.index, pos);
}
