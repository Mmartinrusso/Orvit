/**
 * O2C Phase 5: Aging Reports and Collections Tests
 *
 * Tests for AR aging, DSO calculation, and collection actions
 */

import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';

// Helper to create Decimal
const decimal = (value: number) => new Prisma.Decimal(value);

// Aging Bucket Configuration
const DEFAULT_BUCKETS = [30, 60, 90, 120];

interface Invoice {
  id: number;
  clientId: string;
  numero: string;
  total: Prisma.Decimal;
  saldoPendiente: Prisma.Decimal;
  fecha: Date;
  fechaVencimiento: Date;
  estado: 'EMITIDA' | 'PARCIALMENTE_COBRADA' | 'COBRADA';
}

interface AgingBucket {
  label: string;
  min: number;
  max: number | null;
  amount: Prisma.Decimal;
  count: number;
  invoices: Invoice[];
}

interface ClientAging {
  clientId: string;
  clientName: string;
  current: Prisma.Decimal;
  buckets: AgingBucket[];
  total: Prisma.Decimal;
  oldestOverdueDays: number;
}

// Calculate aging for a set of invoices
function calculateAging(
  invoices: Invoice[],
  asOfDate: Date,
  bucketDays: number[] = DEFAULT_BUCKETS
): { buckets: AgingBucket[]; total: Prisma.Decimal } {
  const sortedBuckets = [...bucketDays].sort((a, b) => a - b);

  // Create bucket labels and ranges
  const buckets: AgingBucket[] = [
    { label: 'Corriente', min: -Infinity, max: 0, amount: decimal(0), count: 0, invoices: [] },
  ];

  for (let i = 0; i < sortedBuckets.length; i++) {
    const start = i === 0 ? 1 : sortedBuckets[i - 1] + 1;
    const end = sortedBuckets[i];
    buckets.push({
      label: `${start}-${end}`,
      min: start,
      max: end,
      amount: decimal(0),
      count: 0,
      invoices: [],
    });
  }

  buckets.push({
    label: `>${sortedBuckets[sortedBuckets.length - 1]}`,
    min: sortedBuckets[sortedBuckets.length - 1] + 1,
    max: null,
    amount: decimal(0),
    count: 0,
    invoices: [],
  });

  // Categorize invoices
  for (const invoice of invoices) {
    if (invoice.saldoPendiente.lte(0)) continue;

    const vencimiento = new Date(invoice.fechaVencimiento);
    const daysOverdue = Math.floor(
      (asOfDate.getTime() - vencimiento.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Find appropriate bucket
    let bucket: AgingBucket;
    if (daysOverdue <= 0) {
      bucket = buckets[0]; // Current
    } else {
      bucket = buckets.find(b =>
        daysOverdue >= b.min && (b.max === null || daysOverdue <= b.max)
      ) || buckets[buckets.length - 1];
    }

    bucket.amount = bucket.amount.plus(invoice.saldoPendiente);
    bucket.count++;
    bucket.invoices.push(invoice);
  }

  const total = buckets.reduce((sum, b) => sum.plus(b.amount), decimal(0));

  return { buckets, total };
}

// Calculate DSO (Days Sales Outstanding)
function calculateDSO(
  totalAR: Prisma.Decimal,
  totalSalesInPeriod: Prisma.Decimal,
  daysInPeriod: number
): number {
  if (totalSalesInPeriod.eq(0)) return 0;
  return totalAR.div(totalSalesInPeriod).mul(daysInPeriod).toNumber();
}

// Calculate Weighted Average DSO
function calculateWeightedDSO(
  invoices: Array<{ saldoPendiente: Prisma.Decimal; diasPendiente: number }>
): number {
  const totalAR = invoices.reduce((sum, inv) => sum.plus(inv.saldoPendiente), decimal(0));
  if (totalAR.eq(0)) return 0;

  const weightedSum = invoices.reduce(
    (sum, inv) => sum.plus(inv.saldoPendiente.mul(inv.diasPendiente)),
    decimal(0)
  );

  return weightedSum.div(totalAR).toNumber();
}

describe('Aging Report', () => {
  const asOfDate = new Date('2025-01-31');

  describe('Bucket Categorization', () => {
    it('should categorize current invoices correctly', () => {
      const invoices: Invoice[] = [
        {
          id: 1,
          clientId: 'c1',
          numero: 'FAC-001',
          total: decimal(10000),
          saldoPendiente: decimal(10000),
          fecha: new Date('2025-01-15'),
          fechaVencimiento: new Date('2025-02-15'), // Not due yet
          estado: 'EMITIDA',
        },
      ];

      const result = calculateAging(invoices, asOfDate);

      expect(result.buckets[0].label).toBe('Corriente');
      expect(result.buckets[0].amount.toNumber()).toBe(10000);
      expect(result.buckets[0].count).toBe(1);
    });

    it('should categorize overdue invoices in correct buckets', () => {
      const invoices: Invoice[] = [
        {
          id: 1,
          clientId: 'c1',
          numero: 'FAC-001',
          total: decimal(10000),
          saldoPendiente: decimal(10000),
          fecha: new Date('2024-12-01'),
          fechaVencimiento: new Date('2025-01-15'), // 16 days overdue
          estado: 'EMITIDA',
        },
        {
          id: 2,
          clientId: 'c1',
          numero: 'FAC-002',
          total: decimal(5000),
          saldoPendiente: decimal(5000),
          fecha: new Date('2024-11-01'),
          fechaVencimiento: new Date('2024-12-15'), // 47 days overdue
          estado: 'EMITIDA',
        },
        {
          id: 3,
          clientId: 'c1',
          numero: 'FAC-003',
          total: decimal(8000),
          saldoPendiente: decimal(8000),
          fecha: new Date('2024-09-01'),
          fechaVencimiento: new Date('2024-10-01'), // 122 days overdue
          estado: 'EMITIDA',
        },
      ];

      const result = calculateAging(invoices, asOfDate);

      // 1-30 bucket
      const bucket1_30 = result.buckets.find(b => b.label === '1-30');
      expect(bucket1_30?.amount.toNumber()).toBe(10000);

      // 31-60 bucket
      const bucket31_60 = result.buckets.find(b => b.label === '31-60');
      expect(bucket31_60?.amount.toNumber()).toBe(5000);

      // >120 bucket
      const bucket120plus = result.buckets.find(b => b.label === '>120');
      expect(bucket120plus?.amount.toNumber()).toBe(8000);

      expect(result.total.toNumber()).toBe(23000);
    });

    it('should ignore paid invoices', () => {
      const invoices: Invoice[] = [
        {
          id: 1,
          clientId: 'c1',
          numero: 'FAC-001',
          total: decimal(10000),
          saldoPendiente: decimal(0), // Paid
          fecha: new Date('2024-12-01'),
          fechaVencimiento: new Date('2025-01-01'),
          estado: 'COBRADA',
        },
      ];

      const result = calculateAging(invoices, asOfDate);

      expect(result.total.toNumber()).toBe(0);
    });

    it('should use custom bucket days', () => {
      const invoices: Invoice[] = [
        {
          id: 1,
          clientId: 'c1',
          numero: 'FAC-001',
          total: decimal(10000),
          saldoPendiente: decimal(10000),
          fecha: new Date('2024-11-01'),
          fechaVencimiento: new Date('2024-12-15'), // 47 days overdue
          estado: 'EMITIDA',
        },
      ];

      // Custom buckets: 15, 45, 90
      const result = calculateAging(invoices, asOfDate, [15, 45, 90]);

      // 47 days should be in 46-90 bucket
      const bucket46_90 = result.buckets.find(b => b.label === '46-90');
      expect(bucket46_90?.amount.toNumber()).toBe(10000);
    });
  });
});

describe('DSO Calculation', () => {
  it('should calculate simple DSO', () => {
    const totalAR = decimal(100000);
    const monthlySales = decimal(150000);
    const daysInMonth = 30;

    const dso = calculateDSO(totalAR, monthlySales, daysInMonth);

    expect(dso).toBeCloseTo(20, 1); // 100000/150000 * 30 = 20 days
  });

  it('should handle zero sales', () => {
    const dso = calculateDSO(decimal(100000), decimal(0), 30);
    expect(dso).toBe(0);
  });

  it('should calculate weighted DSO', () => {
    const invoices = [
      { saldoPendiente: decimal(10000), diasPendiente: 10 },
      { saldoPendiente: decimal(5000), diasPendiente: 30 },
      { saldoPendiente: decimal(15000), diasPendiente: 60 },
    ];

    const weightedDSO = calculateWeightedDSO(invoices);

    // (10000*10 + 5000*30 + 15000*60) / (10000+5000+15000)
    // = (100000 + 150000 + 900000) / 30000
    // = 1150000 / 30000 = 38.33 days
    expect(weightedDSO).toBeCloseTo(38.33, 1);
  });

  it('should handle empty invoice list', () => {
    const weightedDSO = calculateWeightedDSO([]);
    expect(weightedDSO).toBe(0);
  });
});

describe('Collection Actions', () => {
  type CollectionActionType = 'LLAMADA' | 'EMAIL' | 'CARTA' | 'VISITA' | 'PROMESA_PAGO';
  type CollectionActionStatus = 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADA' | 'ESCALADA';

  interface CollectionAction {
    id: number;
    clientId: string;
    invoiceId?: number;
    tipo: CollectionActionType;
    estado: CollectionActionStatus;
    fecha: Date;
    resultado?: string;
    proximaAccion?: Date;
    promesaPago?: Date;
    promesaMonto?: Prisma.Decimal;
  }

  function createCollectionStrategy(
    daysOverdue: number,
    amount: Prisma.Decimal
  ): CollectionActionType[] {
    const actions: CollectionActionType[] = [];

    if (daysOverdue >= 1) {
      actions.push('EMAIL');
    }
    if (daysOverdue >= 7) {
      actions.push('LLAMADA');
    }
    if (daysOverdue >= 30) {
      actions.push('CARTA');
    }
    if (daysOverdue >= 60 || amount.gte(50000)) {
      actions.push('VISITA');
    }

    return actions;
  }

  it('should suggest appropriate collection actions based on overdue days', () => {
    // 5 days overdue - just email
    expect(createCollectionStrategy(5, decimal(10000))).toEqual(['EMAIL']);

    // 15 days overdue - email + call
    expect(createCollectionStrategy(15, decimal(10000))).toEqual(['EMAIL', 'LLAMADA']);

    // 45 days overdue - email + call + letter
    expect(createCollectionStrategy(45, decimal(10000))).toEqual(['EMAIL', 'LLAMADA', 'CARTA']);

    // 90 days overdue - all actions
    expect(createCollectionStrategy(90, decimal(10000))).toEqual(['EMAIL', 'LLAMADA', 'CARTA', 'VISITA']);
  });

  it('should escalate high value invoices earlier', () => {
    // High value but only 15 days overdue - should include visit
    const actions = createCollectionStrategy(15, decimal(100000));
    expect(actions).toContain('VISITA');
  });

  it('should track promise to pay', () => {
    const action: CollectionAction = {
      id: 1,
      clientId: 'c1',
      invoiceId: 101,
      tipo: 'LLAMADA',
      estado: 'COMPLETADA',
      fecha: new Date('2025-01-25'),
      resultado: 'Cliente se compromete a pagar el 30/01',
      promesaPago: new Date('2025-01-30'),
      promesaMonto: decimal(10000),
    };

    expect(action.promesaPago).toBeDefined();
    expect(action.promesaMonto?.toNumber()).toBe(10000);
  });
});

describe('Client Risk Scoring', () => {
  interface ClientRiskFactors {
    daysOverdue: number;
    overdueAmount: Prisma.Decimal;
    creditUtilization: number;
    hasRejectedCheques: boolean;
    paymentHistory: 'GOOD' | 'REGULAR' | 'BAD';
  }

  function calculateRiskScore(factors: ClientRiskFactors): {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  } {
    let score = 0;

    // Days overdue (0-40 points)
    if (factors.daysOverdue > 90) score += 40;
    else if (factors.daysOverdue > 60) score += 30;
    else if (factors.daysOverdue > 30) score += 20;
    else if (factors.daysOverdue > 0) score += 10;

    // Overdue amount (0-25 points)
    if (factors.overdueAmount.gte(100000)) score += 25;
    else if (factors.overdueAmount.gte(50000)) score += 15;
    else if (factors.overdueAmount.gt(0)) score += 5;

    // Credit utilization (0-15 points)
    if (factors.creditUtilization > 100) score += 15;
    else if (factors.creditUtilization > 80) score += 10;
    else if (factors.creditUtilization > 60) score += 5;

    // Rejected cheques (0-10 points)
    if (factors.hasRejectedCheques) score += 10;

    // Payment history (0-10 points)
    if (factors.paymentHistory === 'BAD') score += 10;
    else if (factors.paymentHistory === 'REGULAR') score += 5;

    // Determine level
    let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (score >= 70) level = 'CRITICAL';
    else if (score >= 50) level = 'HIGH';
    else if (score >= 30) level = 'MEDIUM';
    else level = 'LOW';

    return { score, level };
  }

  it('should calculate low risk for good clients', () => {
    const result = calculateRiskScore({
      daysOverdue: 0,
      overdueAmount: decimal(0),
      creditUtilization: 40,
      hasRejectedCheques: false,
      paymentHistory: 'GOOD',
    });

    expect(result.level).toBe('LOW');
    expect(result.score).toBeLessThan(30);
  });

  it('should calculate high risk for problematic clients', () => {
    const result = calculateRiskScore({
      daysOverdue: 75,
      overdueAmount: decimal(80000),
      creditUtilization: 95,
      hasRejectedCheques: true,
      paymentHistory: 'BAD',
    });

    expect(result.level).toBe('CRITICAL');
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it('should weight factors appropriately', () => {
    // High overdue days but nothing else
    const result1 = calculateRiskScore({
      daysOverdue: 100,
      overdueAmount: decimal(0),
      creditUtilization: 0,
      hasRejectedCheques: false,
      paymentHistory: 'GOOD',
    });

    expect(result1.level).toBe('MEDIUM');

    // Multiple moderate factors
    const result2 = calculateRiskScore({
      daysOverdue: 45,
      overdueAmount: decimal(60000),
      creditUtilization: 85,
      hasRejectedCheques: false,
      paymentHistory: 'REGULAR',
    });

    expect(result2.level).toBe('HIGH');
  });
});
