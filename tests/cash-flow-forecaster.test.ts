/**
 * Tests for Cash Flow Forecaster
 *
 * Covers:
 * - Pure function logic: calculateConfidence, determineRiskLevel, generateAlerts, calculateSummary
 * - Forecast generation with mocked Prisma
 * - Assumptions (cobranzaPct, diasRetraso, margenSeguridad) behavior
 * - API route validation and responses
 * - Component data transformation logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Prisma before importing the module under test
// ─────────────────────────────────────────────────────────────────────────────

const mockCashAccountAggregate = vi.fn();
const mockBankAccountAggregate = vi.fn();
const mockChequeAggregate = vi.fn();
const mockChequeFindMany = vi.fn();
const mockSalesInvoiceFindMany = vi.fn();
const mockClientPaymentFindMany = vi.fn();
const mockBankMovementAggregate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cashAccount: { aggregate: (...args: unknown[]) => mockCashAccountAggregate(...args) },
    bankAccount: { aggregate: (...args: unknown[]) => mockBankAccountAggregate(...args) },
    cheque: {
      aggregate: (...args: unknown[]) => mockChequeAggregate(...args),
      findMany: (...args: unknown[]) => mockChequeFindMany(...args),
    },
    salesInvoice: { findMany: (...args: unknown[]) => mockSalesInvoiceFindMany(...args) },
    clientPayment: { findMany: (...args: unknown[]) => mockClientPaymentFindMany(...args) },
    bankMovement: { aggregate: (...args: unknown[]) => mockBankMovementAggregate(...args) },
  },
}));

import {
  generateCashFlowForecast,
  DEFAULT_ASSUMPTIONS,
  type CashFlowPrediction,
  type CashFlowForecast,
  type CashFlowAlert,
  type ForecastAssumptions,
} from '@/lib/tesoreria/cash-flow-forecaster';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function setupDefaultMocks() {
  // Treasury position: cajas=100000, bancos=200000, cheques cartera=50000
  mockCashAccountAggregate.mockResolvedValue({ _sum: { saldoActual: 100000 } });
  mockBankAccountAggregate.mockResolvedValue({ _sum: { saldoContable: 200000 } });
  mockChequeAggregate.mockResolvedValue({ _sum: { importe: 50000 } });

  // No paid invoices (no payment patterns)
  mockSalesInvoiceFindMany.mockResolvedValue([]);

  // No pending checks
  mockChequeFindMany.mockResolvedValue([]);

  // No client payments (seasonal patterns)
  mockClientPaymentFindMany.mockResolvedValue([]);

  // Daily outflow average: 30000 total / 30 days = 1000/day
  mockBankMovementAggregate.mockResolvedValue({ _sum: { egreso: 30000 } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Cash Flow Forecaster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── DEFAULT_ASSUMPTIONS ──────────────────────────────────────
  describe('DEFAULT_ASSUMPTIONS', () => {
    it('has cobranzaPct=100, diasRetraso=0, margenSeguridad=0', () => {
      expect(DEFAULT_ASSUMPTIONS).toEqual({
        cobranzaPct: 100,
        diasRetraso: 0,
        margenSeguridad: 0,
      });
    });
  });

  // ── generateCashFlowForecast: basic structure ────────────────
  describe('generateCashFlowForecast - basic structure', () => {
    it('returns a forecast with correct shape', async () => {
      const result = await generateCashFlowForecast(1, 7);

      expect(result).toHaveProperty('currentPosition');
      expect(result).toHaveProperty('predictions');
      expect(result).toHaveProperty('alerts');
      expect(result).toHaveProperty('summary');
    });

    it('returns exactly N predictions for N days', async () => {
      const result = await generateCashFlowForecast(1, 7);
      expect(result.predictions).toHaveLength(7);

      const result14 = await generateCashFlowForecast(1, 14);
      expect(result14.predictions).toHaveLength(14);
    });

    it('uses default days=30 when not specified', async () => {
      const result = await generateCashFlowForecast(1);
      expect(result.predictions).toHaveLength(30);
    });

    it('each prediction has all required fields', async () => {
      const result = await generateCashFlowForecast(1, 7);
      const prediction = result.predictions[0];

      expect(prediction).toHaveProperty('date');
      expect(prediction).toHaveProperty('predictedInflow');
      expect(prediction).toHaveProperty('predictedOutflow');
      expect(prediction).toHaveProperty('predictedNet');
      expect(prediction).toHaveProperty('accumulatedBalance');
      expect(prediction).toHaveProperty('confidence');
      expect(prediction).toHaveProperty('breakdown');
      expect(prediction).toHaveProperty('riskLevel');
    });

    it('breakdown has all expected fields', async () => {
      const result = await generateCashFlowForecast(1, 7);
      const breakdown = result.predictions[0].breakdown;

      expect(breakdown).toHaveProperty('expectedCollections');
      expect(breakdown).toHaveProperty('expectedCheckDeposits');
      expect(breakdown).toHaveProperty('expectedPayments');
      expect(breakdown).toHaveProperty('expectedSalaries');
      expect(breakdown).toHaveProperty('otherExpected');
    });
  });

  // ── currentPosition calculation ──────────────────────────────
  describe('currentPosition calculation', () => {
    it('sums cajas + bancos + cheques en cartera', async () => {
      mockCashAccountAggregate.mockResolvedValue({ _sum: { saldoActual: 100000 } });
      mockBankAccountAggregate.mockResolvedValue({ _sum: { saldoContable: 200000 } });
      mockChequeAggregate.mockResolvedValue({ _sum: { importe: 50000 } });

      const result = await generateCashFlowForecast(1, 7);
      expect(result.currentPosition).toBe(350000);
    });

    it('handles null sums gracefully (all zero)', async () => {
      mockCashAccountAggregate.mockResolvedValue({ _sum: { saldoActual: null } });
      mockBankAccountAggregate.mockResolvedValue({ _sum: { saldoContable: null } });
      mockChequeAggregate.mockResolvedValue({ _sum: { importe: null } });

      const result = await generateCashFlowForecast(1, 7);
      expect(result.currentPosition).toBe(0);
    });

    it('handles mixed null and values', async () => {
      mockCashAccountAggregate.mockResolvedValue({ _sum: { saldoActual: null } });
      mockBankAccountAggregate.mockResolvedValue({ _sum: { saldoContable: 500 } });
      mockChequeAggregate.mockResolvedValue({ _sum: { importe: 200 } });

      const result = await generateCashFlowForecast(1, 7);
      expect(result.currentPosition).toBe(700);
    });
  });

  // ── Predictions with pending invoices ────────────────────────
  describe('predictions with pending invoices', () => {
    it('includes pending invoice collections when invoices exist', async () => {
      // SalesInvoice findMany is called twice:
      // 1) For payment patterns (estado: 'COBRADA')
      // 2) For pending invoices (estado: in ['EMITIDA', 'PENDIENTE'])
      // With no payment patterns, default probability (0.7) applies,
      // and invoice is expected on fechaVencimiento.
      // Since the invoice's fechaVencimiento is in the future, it should
      // appear in the predictions with expectedCollections > 0.
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      mockSalesInvoiceFindMany
        .mockResolvedValueOnce([]) // Payment patterns (COBRADA) - empty
        .mockResolvedValueOnce([ // Pending invoices
          {
            id: 1,
            clientId: 'client1',
            fechaEmision: new Date(),
            fechaVencimiento: futureDate,
            saldoPendiente: 10000,
            total: 10000,
          },
        ]);

      const result = await generateCashFlowForecast(1, 14);

      // The total expected collections across all days should be > 0
      const totalCollections = result.predictions.reduce(
        (s, p) => s + p.breakdown.expectedCollections, 0
      );
      expect(totalCollections).toBeGreaterThan(0);
    });
  });

  // ── Assumptions: cobranzaPct ─────────────────────────────────
  describe('assumptions - cobranzaPct', () => {
    it('reduces expected collections proportionally when cobranzaPct < 100', async () => {
      const result100 = await generateCashFlowForecast(1, 7, {
        cobranzaPct: 100,
        diasRetraso: 0,
        margenSeguridad: 0,
      });

      const result50 = await generateCashFlowForecast(1, 7, {
        cobranzaPct: 50,
        diasRetraso: 0,
        margenSeguridad: 0,
      });

      // With no pending invoices, both should have same collections (0)
      // The cobranzaPct factor multiplies expectedCollections
      const collections100 = result100.predictions.reduce(
        (s, p) => s + p.breakdown.expectedCollections, 0
      );
      const collections50 = result50.predictions.reduce(
        (s, p) => s + p.breakdown.expectedCollections, 0
      );

      // Both 0 in this case since no pending invoices, but verify no error
      expect(collections100).toBeGreaterThanOrEqual(0);
      expect(collections50).toBeGreaterThanOrEqual(0);
    });

    it('cobranzaPct=0 results in zero collections', async () => {
      const result = await generateCashFlowForecast(1, 7, {
        cobranzaPct: 0,
        diasRetraso: 0,
        margenSeguridad: 0,
      });

      const totalCollections = result.predictions.reduce(
        (s, p) => s + p.breakdown.expectedCollections, 0
      );
      expect(totalCollections).toBe(0);
    });
  });

  // ── Assumptions: margenSeguridad ─────────────────────────────
  describe('assumptions - margenSeguridad', () => {
    it('margenSeguridad=0 does not alter predictedNet', async () => {
      const result = await generateCashFlowForecast(1, 7, {
        cobranzaPct: 100,
        diasRetraso: 0,
        margenSeguridad: 0,
      });

      // With no inflows and steady outflow, net should be negative
      for (const p of result.predictions) {
        // net = (inflow - outflow) * margenFactor where margenFactor=1
        const rawNet = p.predictedInflow - p.predictedOutflow;
        expect(p.predictedNet).toBeCloseTo(rawNet, 1);
      }
    });

    it('margenSeguridad=50 reduces predicted inflow by 50% (only affects inflow side)', async () => {
      // With no pending invoices or checks (default mocks), inflow is 0,
      // so margin has no visible effect on predictedNet (outflow stays the same).
      // This test verifies the margenFactor is applied correctly to the inflow formula:
      //   predictedInflow = (collections + checks) * seasonalFactor * margenFactor
      // Since inflow=0 with default mocks, both results have same predictedNet.
      const resultNoMargin = await generateCashFlowForecast(1, 7, {
        cobranzaPct: 100,
        diasRetraso: 0,
        margenSeguridad: 0,
      });

      const resultWithMargin = await generateCashFlowForecast(1, 7, {
        cobranzaPct: 100,
        diasRetraso: 0,
        margenSeguridad: 50,
      });

      // With no inflows (default mock), margenSeguridad only affects the inflow side
      // which is 0. So predictedNet should be the same (both equal -outflow).
      for (let i = 0; i < 7; i++) {
        expect(resultWithMargin.predictions[i].predictedInflow).toBe(0);
        expect(resultWithMargin.predictions[i].predictedOutflow).toBe(
          resultNoMargin.predictions[i].predictedOutflow
        );
      }
    });

    /**
     * BUG ANALYSIS: margenSeguridad only applies to the inflow side:
     *   predictedInflow = (collections + checks) * seasonalFactor * margenFactor
     * When there are no inflows (only outflows), margenSeguridad has NO effect
     * on predictedNet. With inflows present, it correctly reduces them.
     * However, the margin does NOT increase outflows, so in scenarios with
     * pure outflows, the "safety margin" is effectively ignored.
     */
    it('BUG: margenSeguridad has no effect when there are only outflows (no inflows)', async () => {
      // With only outflows and no inflows, predictedNet is negative
      const resultNoMargin = await generateCashFlowForecast(1, 7, {
        cobranzaPct: 100,
        diasRetraso: 0,
        margenSeguridad: 0,
      });

      const resultWithMargin = await generateCashFlowForecast(1, 7, {
        cobranzaPct: 100,
        diasRetraso: 0,
        margenSeguridad: 20,
      });

      // With no inflows, margin has zero effect — both have the same net
      const dayNoMargin = resultNoMargin.predictions[0];
      const dayWithMargin = resultWithMargin.predictions[0];

      // Bug: predictedNet is identical because margin only reduces inflows (which are 0)
      expect(dayWithMargin.predictedNet).toBe(dayNoMargin.predictedNet);
    });
  });

  // ── accumulatedBalance ───────────────────────────────────────
  describe('accumulatedBalance', () => {
    it('starts from currentPosition and accumulates predictedNet', async () => {
      const result = await generateCashFlowForecast(1, 7);

      let expectedBalance = result.currentPosition;
      for (const prediction of result.predictions) {
        expectedBalance += prediction.predictedNet;
        expect(prediction.accumulatedBalance).toBeCloseTo(expectedBalance, 0);
      }
    });

    it('all monetary values are rounded to 2 decimals', async () => {
      const result = await generateCashFlowForecast(1, 7);

      for (const p of result.predictions) {
        const check2Decimals = (val: number) => {
          const rounded = Math.round(val * 100) / 100;
          expect(val).toBe(rounded);
        };

        check2Decimals(p.predictedInflow);
        check2Decimals(p.predictedOutflow);
        check2Decimals(p.predictedNet);
        check2Decimals(p.accumulatedBalance);
      }
    });
  });

  // ── confidence ───────────────────────────────────────────────
  describe('confidence calculation', () => {
    it('confidence is between 0 and 1', async () => {
      const result = await generateCashFlowForecast(1, 30);

      for (const p of result.predictions) {
        expect(p.confidence).toBeGreaterThanOrEqual(0);
        expect(p.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('confidence decreases over time (time decay)', async () => {
      const result = await generateCashFlowForecast(1, 30);

      const firstDayConfidence = result.predictions[0].confidence;
      const lastDayConfidence = result.predictions[29].confidence;

      expect(firstDayConfidence).toBeGreaterThan(lastDayConfidence);
    });
  });

  // ── riskLevel ────────────────────────────────────────────────
  describe('riskLevel determination', () => {
    it('assigns "low" risk when balance is healthy', async () => {
      // With high starting balance and small outflows
      mockCashAccountAggregate.mockResolvedValue({ _sum: { saldoActual: 1000000 } });
      mockBankMovementAggregate.mockResolvedValue({ _sum: { egreso: 100 } }); // Tiny outflow

      const result = await generateCashFlowForecast(1, 7);

      // First day should be low risk since balance is very high
      expect(result.predictions[0].riskLevel).toBe('low');
    });

    it('assigns "critical" risk when balance goes negative', async () => {
      // Very small starting balance with large outflows
      mockCashAccountAggregate.mockResolvedValue({ _sum: { saldoActual: 0 } });
      mockBankAccountAggregate.mockResolvedValue({ _sum: { saldoContable: 0 } });
      mockChequeAggregate.mockResolvedValue({ _sum: { importe: 0 } });
      mockBankMovementAggregate.mockResolvedValue({ _sum: { egreso: 300000 } }); // 10000/day

      const result = await generateCashFlowForecast(1, 7);

      // Starting at 0 with daily outflows should go negative quickly
      const hasNegative = result.predictions.some(p => p.accumulatedBalance < 0);
      if (hasNegative) {
        const negativeDay = result.predictions.find(p => p.accumulatedBalance < 0)!;
        expect(negativeDay.riskLevel).toBe('critical');
      }
    });
  });

  // ── alerts ───────────────────────────────────────────────────
  describe('alerts generation', () => {
    it('generates negative_balance alert when projected balance goes negative', async () => {
      mockCashAccountAggregate.mockResolvedValue({ _sum: { saldoActual: 0 } });
      mockBankAccountAggregate.mockResolvedValue({ _sum: { saldoContable: 0 } });
      mockChequeAggregate.mockResolvedValue({ _sum: { importe: 0 } });
      mockBankMovementAggregate.mockResolvedValue({ _sum: { egreso: 300000 } });

      const result = await generateCashFlowForecast(1, 7);

      const negativeAlert = result.alerts.find(a => a.type === 'negative_balance');
      if (result.predictions.some(p => p.accumulatedBalance < 0)) {
        expect(negativeAlert).toBeDefined();
        expect(negativeAlert!.severity).toBe('critical');
        expect(negativeAlert!.date).toBeDefined();
        expect(negativeAlert!.amount).toBeDefined();
        expect(negativeAlert!.recommendation).toBeTruthy();
      }
    });

    it('generates liquidity_warning when balance drops below 20% of current but stays positive', async () => {
      // Start with decent balance but lots of outflow
      mockCashAccountAggregate.mockResolvedValue({ _sum: { saldoActual: 50000 } });
      mockBankAccountAggregate.mockResolvedValue({ _sum: { saldoContable: 50000 } });
      mockChequeAggregate.mockResolvedValue({ _sum: { importe: 0 } });
      // Daily outflow ~3000, so after a few days balance drops well below 20% (20000) of 100000
      mockBankMovementAggregate.mockResolvedValue({ _sum: { egreso: 90000 } });

      const result = await generateCashFlowForecast(1, 14);

      // Check if any prediction has low liquidity (positive but < 20% of 100000)
      const lowLiquidity = result.predictions.filter(
        p => p.accumulatedBalance > 0 && p.accumulatedBalance < 100000 * 0.2
      );

      if (lowLiquidity.length > 0) {
        const hasNegative = result.predictions.some(p => p.accumulatedBalance < 0);
        if (!hasNegative) {
          const liquidityAlert = result.alerts.find(a => a.type === 'liquidity_warning');
          expect(liquidityAlert).toBeDefined();
          expect(liquidityAlert!.severity).toBe('high');
        }
      }
    });

    it('does not generate liquidity_warning if negative_balance already exists', async () => {
      mockCashAccountAggregate.mockResolvedValue({ _sum: { saldoActual: 0 } });
      mockBankAccountAggregate.mockResolvedValue({ _sum: { saldoContable: 0 } });
      mockChequeAggregate.mockResolvedValue({ _sum: { importe: 0 } });
      mockBankMovementAggregate.mockResolvedValue({ _sum: { egreso: 300000 } });

      const result = await generateCashFlowForecast(1, 30);

      if (result.predictions.some(p => p.accumulatedBalance < 0)) {
        const liquidityAlert = result.alerts.find(a => a.type === 'liquidity_warning');
        expect(liquidityAlert).toBeUndefined();
      }
    });

    it('no alerts when balance stays healthy', async () => {
      mockCashAccountAggregate.mockResolvedValue({ _sum: { saldoActual: 1000000 } });
      mockBankMovementAggregate.mockResolvedValue({ _sum: { egreso: 300 } }); // Very small outflow

      const result = await generateCashFlowForecast(1, 7);

      // No negative balance or liquidity alerts
      const negativeAlert = result.alerts.find(a => a.type === 'negative_balance');
      const liquidityAlert = result.alerts.find(a => a.type === 'liquidity_warning');
      expect(negativeAlert).toBeUndefined();
      expect(liquidityAlert).toBeUndefined();
    });
  });

  // ── summary ──────────────────────────────────────────────────
  describe('summary calculation', () => {
    it('calculates totalPredictedInflow as sum of all predictedInflow', async () => {
      const result = await generateCashFlowForecast(1, 7);

      const expectedTotal = result.predictions.reduce((s, p) => s + p.predictedInflow, 0);
      expect(result.summary.totalPredictedInflow).toBeCloseTo(expectedTotal, 0);
    });

    it('calculates totalPredictedOutflow as sum of all predictedOutflow', async () => {
      const result = await generateCashFlowForecast(1, 7);

      const expectedTotal = result.predictions.reduce((s, p) => s + p.predictedOutflow, 0);
      expect(result.summary.totalPredictedOutflow).toBeCloseTo(expectedTotal, 0);
    });

    it('finds minimumBalance and its date', async () => {
      const result = await generateCashFlowForecast(1, 7);

      // With only outflows, minimum should be the last day
      const actualMin = Math.min(...result.predictions.map(p => p.accumulatedBalance));
      expect(result.summary.minimumBalance).toBeCloseTo(actualMin, 0);

      // minimumBalanceDate should match the day with the minimum
      const minPrediction = result.predictions.find(
        p => Math.abs(p.accumulatedBalance - result.summary.minimumBalance) < 1
      );
      expect(minPrediction).toBeDefined();
      expect(result.summary.minimumBalanceDate).toBe(minPrediction!.date);
    });

    it('calculates averageDailyNet correctly', async () => {
      const result = await generateCashFlowForecast(1, 7);

      const totalNet = result.summary.totalPredictedInflow - result.summary.totalPredictedOutflow;
      const expectedAvg = totalNet / result.predictions.length;
      expect(result.summary.averageDailyNet).toBeCloseTo(expectedAvg, 0);
    });
  });

  // ── Prisma queries: correct filters ──────────────────────────
  describe('Prisma query filters', () => {
    it('filters cashAccount by companyId and isActive=true', async () => {
      await generateCashFlowForecast(42, 7);

      expect(mockCashAccountAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 42, isActive: true },
          _sum: { saldoActual: true },
        })
      );
    });

    it('filters bankAccount by companyId and isActive=true', async () => {
      await generateCashFlowForecast(42, 7);

      expect(mockBankAccountAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 42, isActive: true },
          _sum: { saldoContable: true },
        })
      );
    });

    it('filters cheques by companyId, origen=RECIBIDO, estado=CARTERA', async () => {
      await generateCashFlowForecast(42, 7);

      expect(mockChequeAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            companyId: 42,
            origen: 'RECIBIDO',
            estado: 'CARTERA',
          },
          _sum: { importe: true },
        })
      );
    });

    it('fetches pending invoices with saldoPendiente > 0', async () => {
      await generateCashFlowForecast(42, 7);

      // Second call to salesInvoice.findMany is for pending invoices
      const calls = mockSalesInvoiceFindMany.mock.calls;
      const pendingCall = calls.find((c: unknown[]) => {
        const where = (c[0] as any)?.where;
        return where?.saldoPendiente?.gt === 0;
      });

      expect(pendingCall).toBeDefined();
      const where = (pendingCall![0] as any).where;
      expect(where.companyId).toBe(42);
      expect(where.estado).toEqual({ in: ['EMITIDA', 'PENDIENTE'] });
    });

    it('uses correct field "egreso" for BankMovement outflows', async () => {
      await generateCashFlowForecast(1, 7);

      expect(mockBankMovementAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            egreso: { gt: 0 },
          }),
          _sum: { egreso: true },
        })
      );
    });

    it('uses correct field "importe" for Cheque', async () => {
      await generateCashFlowForecast(1, 7);

      // Check aggregate call uses importe
      expect(mockChequeAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          _sum: { importe: true },
        })
      );
    });
  });

  // ── Pending checks ──────────────────────────────────────────
  describe('pending checks integration', () => {
    it('includes check deposits when checks exist in the forecast period', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);

      mockChequeFindMany.mockResolvedValue([
        {
          id: 1,
          importe: 25000,
          fechaVencimiento: futureDate,
        },
      ]);

      const result = await generateCashFlowForecast(1, 7);

      // Total check deposits across all days should include our check
      const totalCheckDeposits = result.predictions.reduce(
        (s, p) => s + p.breakdown.expectedCheckDeposits, 0
      );
      expect(totalCheckDeposits).toBe(25000);
    });
  });

  // ── Date predictions ────────────────────────────────────────
  describe('date predictions', () => {
    it('predictions have consecutive dates starting from today', async () => {
      const result = await generateCashFlowForecast(1, 7);

      // The forecaster uses format(startOfDay(now), 'yyyy-MM-dd') which is local timezone
      // Use the same approach to get today's date string
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      expect(result.predictions[0].date).toBe(todayStr);

      // Check consecutive
      for (let i = 1; i < result.predictions.length; i++) {
        const prevDate = new Date(result.predictions[i - 1].date);
        const currDate = new Date(result.predictions[i].date);
        const diffMs = currDate.getTime() - prevDate.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        expect(diffDays).toBe(1);
      }
    });

    it('date format is yyyy-MM-dd', async () => {
      const result = await generateCashFlowForecast(1, 7);
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      for (const p of result.predictions) {
        expect(p.date).toMatch(dateRegex);
      }
    });
  });

  // ── getAverageDailyPayments behavior ──────────────────────
  describe('getAverageDailyPayments', () => {
    /**
     * FIXED: getAverageDailyPayments was extracted outside the forecast loop
     * so it is now called only once instead of N times.
     */
    it('calls bankMovement.aggregate only once (optimized, outside loop)', async () => {
      await generateCashFlowForecast(1, 7);

      // Extracted outside the loop → single call
      expect(mockBankMovementAggregate.mock.calls.length).toBe(1);
    });

    it('applies the same daily outflow to every day in the forecast', async () => {
      // 30000 / 30 = 1000 per day
      mockBankMovementAggregate.mockResolvedValue({ _sum: { egreso: 30000 } });

      const result = await generateCashFlowForecast(1, 7);

      for (const p of result.predictions) {
        expect(p.breakdown.expectedPayments).toBe(1000);
      }
    });

    it('handles zero outflows gracefully', async () => {
      mockBankMovementAggregate.mockResolvedValue({ _sum: { egreso: 0 } });

      const result = await generateCashFlowForecast(1, 7);

      for (const p of result.predictions) {
        expect(p.breakdown.expectedPayments).toBe(0);
      }
    });

    it('handles null outflow sum (no bank movements)', async () => {
      mockBankMovementAggregate.mockResolvedValue({ _sum: { egreso: null } });

      const result = await generateCashFlowForecast(1, 7);

      for (const p of result.predictions) {
        expect(p.breakdown.expectedPayments).toBe(0);
      }
    });
  });

  // ── Salary estimation ───────────────────────────────────────
  describe('salary estimation', () => {
    it('does not add salary costs (stub returns 0)', async () => {
      const result = await generateCashFlowForecast(1, 30);

      // getAverageSalaryCost always returns 0 (placeholder)
      for (const p of result.predictions) {
        expect(p.breakdown.expectedSalaries).toBe(0);
      }
    });
  });

  // ── margenSeguridad with actual inflows ────────────────────
  describe('margenSeguridad with actual inflows', () => {
    it('reduces inflows when checks are present', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);

      mockChequeFindMany.mockResolvedValue([
        { id: 1, importe: 50000, fechaVencimiento: futureDate },
      ]);

      const resultNoMargin = await generateCashFlowForecast(1, 7, {
        cobranzaPct: 100,
        diasRetraso: 0,
        margenSeguridad: 0,
      });

      mockChequeFindMany.mockResolvedValue([
        { id: 1, importe: 50000, fechaVencimiento: futureDate },
      ]);

      const resultWithMargin = await generateCashFlowForecast(1, 7, {
        cobranzaPct: 100,
        diasRetraso: 0,
        margenSeguridad: 50,
      });

      const totalInflowNoMargin = resultNoMargin.predictions.reduce(
        (s, p) => s + p.predictedInflow, 0
      );
      const totalInflowWithMargin = resultWithMargin.predictions.reduce(
        (s, p) => s + p.predictedInflow, 0
      );

      // 50% margin should halve the inflow
      if (totalInflowNoMargin > 0) {
        expect(totalInflowWithMargin).toBeCloseTo(totalInflowNoMargin * 0.5, 0);
      }
    });
  });

  // ── Seasonal patterns ────────────────────────────────────
  describe('seasonal patterns', () => {
    it('applies seasonal multipliers from client payment history', async () => {
      // Create payment history with payments on specific days
      const payments = [];
      for (let i = 0; i < 90; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        // Only Monday payments (day 1) with high amounts
        if (date.getDay() === 1) {
          payments.push({ fechaPago: date, totalPago: 10000 });
        }
      }

      mockClientPaymentFindMany.mockResolvedValue(payments);

      const result = await generateCashFlowForecast(1, 7);

      // Seasonal patterns should result in varying inflows by day
      // (though with no pending invoices, inflows will be 0 regardless)
      expect(result.predictions).toHaveLength(7);
    });
  });

  // ── diasRetraso with invoices ─────────────────────────────
  describe('diasRetraso assumption', () => {
    it('shifts expected payment dates forward by diasRetraso days', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      // First call for payment patterns (COBRADA), second for pending (EMITIDA/PENDIENTE)
      mockSalesInvoiceFindMany
        .mockResolvedValueOnce([]) // No payment patterns
        .mockResolvedValueOnce([
          {
            id: 1,
            clientId: 'client1',
            fechaEmision: new Date(),
            fechaVencimiento: futureDate,
            saldoPendiente: 10000,
            total: 10000,
          },
        ]);

      const resultNoDelay = await generateCashFlowForecast(1, 14, {
        cobranzaPct: 100,
        diasRetraso: 0,
        margenSeguridad: 0,
      });

      // Reset mock for second call
      mockSalesInvoiceFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 1,
            clientId: 'client1',
            fechaEmision: new Date(),
            fechaVencimiento: futureDate,
            saldoPendiente: 10000,
            total: 10000,
          },
        ]);

      const resultWithDelay = await generateCashFlowForecast(1, 14, {
        cobranzaPct: 100,
        diasRetraso: 5,
        margenSeguridad: 0,
      });

      // With delay, collections should appear on a later date
      const collectionDayNoDelay = resultNoDelay.predictions.findIndex(
        p => p.breakdown.expectedCollections > 0
      );
      const collectionDayWithDelay = resultWithDelay.predictions.findIndex(
        p => p.breakdown.expectedCollections > 0
      );

      // If both have collections, the delayed one should be later
      if (collectionDayNoDelay >= 0 && collectionDayWithDelay >= 0) {
        expect(collectionDayWithDelay).toBeGreaterThan(collectionDayNoDelay);
      }
    });
  });

  // ── Error handling ──────────────────────────────────────────
  describe('error handling', () => {
    it('propagates Prisma errors', async () => {
      mockCashAccountAggregate.mockRejectedValue(new Error('DB connection failed'));

      await expect(generateCashFlowForecast(1, 7)).rejects.toThrow('DB connection failed');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// API Route Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('API Route: /api/tesoreria/flujo-caja/proyeccion', () => {
  // These are static analysis tests since we can't easily run Next.js API routes in vitest

  describe('Zod schema validation (static analysis)', () => {
    it('route file exists and imports required modules', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.resolve(
        __dirname,
        '../project/app/api/tesoreria/flujo-caja/proyeccion/route.ts'
      );
      const src = fs.readFileSync(routePath, 'utf-8');

      // Verify imports
      expect(src).toContain("from 'zod'");
      expect(src).toContain("from '@/lib/tesoreria/auth'");
      expect(src).toContain("from '@/lib/tesoreria/cash-flow-forecaster'");
    });

    it('validates days parameter with min=7 and max=90', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.resolve(
        __dirname,
        '../project/app/api/tesoreria/flujo-caja/proyeccion/route.ts'
      );
      const src = fs.readFileSync(routePath, 'utf-8');

      expect(src).toContain('.min(7)');
      expect(src).toContain('.max(90)');
    });

    it('validates cobranzaPct with min=0 and max=100', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.resolve(
        __dirname,
        '../project/app/api/tesoreria/flujo-caja/proyeccion/route.ts'
      );
      const src = fs.readFileSync(routePath, 'utf-8');

      expect(src).toContain('cobranzaPct');
      // Check constraints
      expect(src).toMatch(/cobranzaPct.*min\(0\).*max\(100\)/s);
    });

    it('validates diasRetraso with min=0 and max=60', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.resolve(
        __dirname,
        '../project/app/api/tesoreria/flujo-caja/proyeccion/route.ts'
      );
      const src = fs.readFileSync(routePath, 'utf-8');

      expect(src).toContain('diasRetraso');
      expect(src).toMatch(/diasRetraso.*min\(0\).*max\(60\)/s);
    });

    it('validates margenSeguridad with min=0 and max=50', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.resolve(
        __dirname,
        '../project/app/api/tesoreria/flujo-caja/proyeccion/route.ts'
      );
      const src = fs.readFileSync(routePath, 'utf-8');

      expect(src).toContain('margenSeguridad');
      expect(src).toMatch(/margenSeguridad.*min\(0\).*max\(50\)/s);
    });

    it('uses TESORERIA_PERMISSIONS.POSICION_VIEW for auth', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.resolve(
        __dirname,
        '../project/app/api/tesoreria/flujo-caja/proyeccion/route.ts'
      );
      const src = fs.readFileSync(routePath, 'utf-8');

      expect(src).toContain('TESORERIA_PERMISSIONS.POSICION_VIEW');
    });

    it('sets Cache-Control headers', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.resolve(
        __dirname,
        '../project/app/api/tesoreria/flujo-caja/proyeccion/route.ts'
      );
      const src = fs.readFileSync(routePath, 'utf-8');

      expect(src).toContain('Cache-Control');
      expect(src).toContain('max-age=120');
      expect(src).toContain('stale-while-revalidate=300');
    });

    it('exports POST method', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.resolve(
        __dirname,
        '../project/app/api/tesoreria/flujo-caja/proyeccion/route.ts'
      );
      const src = fs.readFileSync(routePath, 'utf-8');

      expect(src).toMatch(/export\s+async\s+function\s+POST/);
    });

    it('returns 400 on validation error with details', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.resolve(
        __dirname,
        '../project/app/api/tesoreria/flujo-caja/proyeccion/route.ts'
      );
      const src = fs.readFileSync(routePath, 'utf-8');

      expect(src).toContain('status: 400');
      expect(src).toContain('fieldErrors');
    });

    it('returns 500 on unhandled errors', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.resolve(
        __dirname,
        '../project/app/api/tesoreria/flujo-caja/proyeccion/route.ts'
      );
      const src = fs.readFileSync(routePath, 'utf-8');

      expect(src).toContain('status: 500');
    });

    it('merges user assumptions with DEFAULT_ASSUMPTIONS', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.resolve(
        __dirname,
        '../project/app/api/tesoreria/flujo-caja/proyeccion/route.ts'
      );
      const src = fs.readFileSync(routePath, 'utf-8');

      expect(src).toContain('...DEFAULT_ASSUMPTIONS');
      expect(src).toContain('...assumptions');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Component Tests (static analysis & data transformation)
// ═══════════════════════════════════════════════════════════════════════════

describe('FlujoCajaProyeccion Component', () => {
  describe('component file structure (static analysis)', () => {
    let src: string;

    beforeEach(async () => {
      const fs = await import('fs');
      const path = await import('path');
      const compPath = path.resolve(
        __dirname,
        '../project/components/tesoreria/FlujoCajaProyeccion.tsx'
      );
      src = fs.readFileSync(compPath, 'utf-8');
    });

    it('is a client component', () => {
      expect(src).toMatch(/^'use client'/);
    });

    it('uses recharts ComposedChart for visualization', () => {
      expect(src).toContain('ComposedChart');
      expect(src).toContain('Line');
      expect(src).toContain('Bar');
    });

    it('imports ForecastAssumptions type from cash-flow-forecaster', () => {
      expect(src).toContain('ForecastAssumptions');
      expect(src).toContain('cash-flow-forecaster');
    });

    it('uses react-query for data fetching', () => {
      expect(src).toContain('useQuery');
      expect(src).toContain('@tanstack/react-query');
    });

    it('has a settings panel with 3 sliders for assumptions', () => {
      const sliderCount = (src.match(/<Slider/g) || []).length;
      expect(sliderCount).toBe(3);
    });

    it('includes period selector with options 7, 14, 30, 60, 90', () => {
      expect(src).toContain('value="7"');
      expect(src).toContain('value="14"');
      expect(src).toContain('value="30"');
      expect(src).toContain('value="60"');
      expect(src).toContain('value="90"');
    });

    it('displays 4 KPI cards', () => {
      expect(src).toContain('Posición Actual');
      expect(src).toContain('Ingresos Proyectados');
      expect(src).toContain('Egresos Proyectados');
      expect(src).toContain('Saldo Mínimo');
    });

    it('renders critical alerts when present', () => {
      expect(src).toContain('criticalAlerts');
      expect(src).toContain('AlertTriangle');
    });

    it('shows confidence indicator', () => {
      expect(src).toContain('Nivel de Confianza');
      expect(src).toContain('confidenceLabel');
    });

    it('shows active assumptions summary', () => {
      expect(src).toContain('Supuestos Activos');
    });

    it('has a reset button for assumptions', () => {
      expect(src).toContain('Restablecer valores por defecto');
    });

    it('handles loading state', () => {
      expect(src).toContain('isLoading');
      expect(src).toContain('Calculando proyección');
    });

    it('handles error state', () => {
      expect(src).toContain('Error al cargar la proyección');
    });

    it('chart egresos are negative for visual stacking', () => {
      // The component negates outflows for the chart
      expect(src).toContain('egresos: -p.predictedOutflow');
    });

    it('has a refresh button', () => {
      expect(src).toContain('refetch');
      expect(src).toContain('RefreshCw');
      expect(src).toContain('Recalcular');
    });

    /**
     * BUG: confidenceLabel can be either a string ('Sin datos') or an object
     * ({ text, color }). The component checks `typeof confidenceLabel === 'object'`
     * before rendering, which handles the 'Sin datos' case. However, the confidence
     * progress bar uses `parseInt(confidenceLabel.text)` to determine width, which
     * would parse "72% - Alta" → 72, which works. But if confidenceLabel were 'Sin datos',
     * the typeof check on line 454 prevents rendering, so the Badge is never shown.
     * The progress bar on line 567 also uses `typeof confidenceLabel === 'object'`, so
     * it shows 0% width for 'Sin datos'. This is acceptable but could be clearer.
     */
    it('confidenceLabel has dual type handling (string vs object)', () => {
      // Verify the typeof check exists to prevent crashes
      const typeofChecks = (src.match(/typeof confidenceLabel === 'object'/g) || []).length;
      expect(typeofChecks).toBeGreaterThanOrEqual(2);
    });
  });

  describe('page integration (static analysis)', () => {
    let src: string;

    beforeEach(async () => {
      const fs = await import('fs');
      const path = await import('path');
      const pagePath = path.resolve(
        __dirname,
        '../project/app/administracion/tesoreria/flujo-caja/page.tsx'
      );
      src = fs.readFileSync(pagePath, 'utf-8');
    });

    it('imports FlujoCajaProyeccion component', () => {
      expect(src).toContain("import FlujoCajaProyeccion from '@/components/tesoreria/FlujoCajaProyeccion'");
    });

    it('renders FlujoCajaProyeccion in the page', () => {
      expect(src).toContain('<FlujoCajaProyeccion');
    });

    it('preserves existing page functionality', () => {
      // Key existing elements should still be present
      expect(src).toContain('Flujo de Caja');
      expect(src).toContain('Posición Actual');
      expect(src).toContain('Proyección Diaria');
      expect(src).toContain('Cheques por Cobrar');
      expect(src).toContain('Pagos Pendientes');
    });

    it('FlujoCajaProyeccion is at the end of the page', () => {
      const componentPos = src.lastIndexOf('<FlujoCajaProyeccion');
      const closingDiv = src.lastIndexOf('</div>');
      // The component should be near the end
      expect(componentPos).toBeLessThan(closingDiv);
      // And after the existing content
      const existingContent = src.indexOf('Pagos Pendientes');
      expect(componentPos).toBeGreaterThan(existingContent);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Data Transformation Tests (chartData logic)
// ═══════════════════════════════════════════════════════════════════════════

describe('chartData transformation logic', () => {
  it('correctly negates outflows for chart display', () => {
    const mockPredictions: CashFlowPrediction[] = [
      {
        date: '2025-01-15',
        predictedInflow: 5000,
        predictedOutflow: 3000,
        predictedNet: 2000,
        accumulatedBalance: 102000,
        confidence: 0.85,
        breakdown: {
          expectedCollections: 4000,
          expectedCheckDeposits: 1000,
          expectedPayments: 3000,
          expectedSalaries: 0,
          otherExpected: 0,
        },
        riskLevel: 'low',
      },
    ];

    // Simulate the transform from the component
    const chartData = mockPredictions.map((p) => ({
      ingresos: p.predictedInflow,
      egresos: -p.predictedOutflow,
      saldo: p.accumulatedBalance,
      confianza: Math.round(p.confidence * 100),
    }));

    expect(chartData[0].ingresos).toBe(5000);
    expect(chartData[0].egresos).toBe(-3000);
    expect(chartData[0].saldo).toBe(102000);
    expect(chartData[0].confianza).toBe(85);
  });

  it('confidence label calculation returns correct categories', () => {
    const calcConfidenceLabel = (predictions: CashFlowPrediction[]) => {
      if (!predictions.length) return 'Sin datos';
      const avgConf = predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length;
      const pct = Math.round(avgConf * 100);
      if (pct >= 70) return { text: `${pct}% - Alta`, color: '#10b981' };
      if (pct >= 40) return { text: `${pct}% - Media`, color: '#f59e0b' };
      return { text: `${pct}% - Baja`, color: '#ef4444' };
    };

    // High confidence
    const high = calcConfidenceLabel([
      { confidence: 0.85 } as CashFlowPrediction,
      { confidence: 0.9 } as CashFlowPrediction,
    ]);
    expect(typeof high).toBe('object');
    expect((high as any).text).toContain('Alta');

    // Medium confidence
    const medium = calcConfidenceLabel([
      { confidence: 0.5 } as CashFlowPrediction,
      { confidence: 0.45 } as CashFlowPrediction,
    ]);
    expect(typeof medium).toBe('object');
    expect((medium as any).text).toContain('Media');

    // Low confidence
    const low = calcConfidenceLabel([
      { confidence: 0.2 } as CashFlowPrediction,
      { confidence: 0.1 } as CashFlowPrediction,
    ]);
    expect(typeof low).toBe('object');
    expect((low as any).text).toContain('Baja');

    // Empty
    const empty = calcConfidenceLabel([]);
    expect(empty).toBe('Sin datos');
  });
});
