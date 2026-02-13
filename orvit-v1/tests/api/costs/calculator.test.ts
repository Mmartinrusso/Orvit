/**
 * Cost Calculator - Comprehensive Unit & Integration Tests
 *
 * Tests all exported functions from lib/costs/calculator.ts:
 * - getEffectiveEmployeeComp: historical vs fallback compensation
 * - getEffectiveInputPrice: historical vs fallback pricing
 * - calculateRecipeCost: PER_BATCH and PER_M3 recipes
 * - calculateDirectCostPerOutput: BATCH, VOLUMETRIC, PER_UNIT_BOM methods
 * - getProductionByLine: production aggregation by line
 * - calculateIndirectCostPerOutput: indirect cost allocation
 * - calculateEmployeeCostPerOutput: employee cost allocation
 * - calculateProductCost: full cost breakdown orchestration
 * - recalculateMonthCosts: bulk recalculation with history persistence
 *
 * Edge cases: division by zero, missing configs, negative values, zero production
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initTestDatabase, cleanDatabase, disconnectTestDatabase, getTestPrisma } from '../../setup/db-setup';
import { createCompany } from '../../factories/company.factory';
import {
  createLine,
  createCostProduct,
  createInputItem,
  createCostEmployee,
  createRecipe,
  createMonthlyProduction,
  resetCostCounters,
} from '../../factories/cost.factory';
import {
  createBatchDirectYieldFixture,
  createBatchChainedYieldFixture,
  createVolumetricProductFixture,
  createPerUnitBOMFixture,
  addInputPriceHistory,
  addEmployeeCompHistory,
} from '../../fixtures/cost-calculator.fixtures';

import { Decimal } from '@prisma/client/runtime/library';

const prisma = getTestPrisma();
const MONTH = '2024-06';

// Import calculator functions
import {
  getEffectiveEmployeeComp,
  getEffectiveEmployeeCompBatch,
  getEffectiveInputPrice,
  calculateRecipeCost,
  calculateDirectCostPerOutput,
  getProductionByLine,
  calculateIndirectCostPerOutput,
  calculateEmployeeCostPerOutput,
  calculateProductCost,
  recalculateMonthCosts,
} from '@/lib/costs/calculator';

// ============================================================================
// Lifecycle
// ============================================================================

beforeAll(async () => {
  await initTestDatabase();
}, 60_000);

afterAll(async () => {
  await disconnectTestDatabase();
});

beforeEach(async () => {
  await cleanDatabase();
  resetCostCounters();
});

// ============================================================================
// getEffectiveEmployeeComp
// ============================================================================

describe('getEffectiveEmployeeComp', () => {
  it('should return current compensation when no history exists', async () => {
    const company = await createCompany();
    const employee = await createCostEmployee({
      companyId: company.id,
      grossSalary: 500000,
      payrollTaxes: 125000,
    });

    const comp = await getEffectiveEmployeeComp(employee.id, '2024-06');

    expect(comp.grossSalary).toBe(500000);
    expect(comp.payrollTaxes).toBe(125000);
  });

  it('should return historical compensation when history exists', async () => {
    const company = await createCompany();
    const employee = await createCostEmployee({
      companyId: company.id,
      grossSalary: 600000,
      payrollTaxes: 150000,
    });

    // Add history: $400k effective from Jan 2024
    await addEmployeeCompHistory(
      employee.id, company.id,
      new Date('2024-01-01'), 400000, 100000
    );

    const comp = await getEffectiveEmployeeComp(employee.id, '2024-06');

    expect(comp.grossSalary).toBe(400000);
    expect(comp.payrollTaxes).toBe(100000);
  });

  it('should return most recent history before end of month', async () => {
    const company = await createCompany();
    const employee = await createCostEmployee({
      companyId: company.id,
      grossSalary: 800000,
      payrollTaxes: 200000,
    });

    // Two history entries
    await addEmployeeCompHistory(
      employee.id, company.id,
      new Date('2024-01-01'), 300000, 75000
    );
    await addEmployeeCompHistory(
      employee.id, company.id,
      new Date('2024-05-01'), 500000, 125000
    );

    const comp = await getEffectiveEmployeeComp(employee.id, '2024-06');

    // Should pick the May one (most recent before end of June)
    expect(comp.grossSalary).toBe(500000);
    expect(comp.payrollTaxes).toBe(125000);
  });

  it('should ignore future history records', async () => {
    const company = await createCompany();
    const employee = await createCostEmployee({
      companyId: company.id,
      grossSalary: 400000,
      payrollTaxes: 100000,
    });

    // History dated after the requested month
    await addEmployeeCompHistory(
      employee.id, company.id,
      new Date('2024-08-01'), 900000, 225000
    );

    const comp = await getEffectiveEmployeeComp(employee.id, '2024-06');

    // Should fall back to current compensation
    expect(comp.grossSalary).toBe(400000);
    expect(comp.payrollTaxes).toBe(100000);
  });

  it('should throw for non-existent employee', async () => {
    await expect(
      getEffectiveEmployeeComp('non-existent-id', '2024-06')
    ).rejects.toThrow('Employee not found');
  });
});

// ============================================================================
// getEffectiveEmployeeCompBatch
// ============================================================================

describe('getEffectiveEmployeeCompBatch', () => {
  it('should return current compensation for all employees when no history', async () => {
    const company = await createCompany();
    const emp1 = await createCostEmployee({ companyId: company.id, grossSalary: 400000, payrollTaxes: 100000 });
    const emp2 = await createCostEmployee({ companyId: company.id, grossSalary: 600000, payrollTaxes: 150000 });

    const result = await getEffectiveEmployeeCompBatch(
      [
        { id: emp1.id, grossSalary: new Decimal(400000), payrollTaxes: new Decimal(100000) },
        { id: emp2.id, grossSalary: new Decimal(600000), payrollTaxes: new Decimal(150000) },
      ],
      '2024-06'
    );

    expect(result.size).toBe(2);
    expect(result.get(emp1.id)).toEqual({ grossSalary: 400000, payrollTaxes: 100000 });
    expect(result.get(emp2.id)).toEqual({ grossSalary: 600000, payrollTaxes: 150000 });
  });

  it('should return historical compensation when history exists', async () => {
    const company = await createCompany();
    const emp = await createCostEmployee({ companyId: company.id, grossSalary: 800000, payrollTaxes: 200000 });

    await addEmployeeCompHistory(emp.id, company.id, new Date('2024-03-01'), 500000, 125000);

    const result = await getEffectiveEmployeeCompBatch(
      [{ id: emp.id, grossSalary: new Decimal(800000), payrollTaxes: new Decimal(200000) }],
      '2024-06'
    );

    expect(result.get(emp.id)).toEqual({ grossSalary: 500000, payrollTaxes: 125000 });
  });

  it('should pick most recent history per employee', async () => {
    const company = await createCompany();
    const emp = await createCostEmployee({ companyId: company.id, grossSalary: 900000, payrollTaxes: 225000 });

    await addEmployeeCompHistory(emp.id, company.id, new Date('2024-01-01'), 300000, 75000);
    await addEmployeeCompHistory(emp.id, company.id, new Date('2024-05-01'), 700000, 175000);

    const result = await getEffectiveEmployeeCompBatch(
      [{ id: emp.id, grossSalary: new Decimal(900000), payrollTaxes: new Decimal(225000) }],
      '2024-06'
    );

    expect(result.get(emp.id)).toEqual({ grossSalary: 700000, payrollTaxes: 175000 });
  });

  it('should mix historical and fallback across employees', async () => {
    const company = await createCompany();
    const empWithHistory = await createCostEmployee({ companyId: company.id, grossSalary: 600000, payrollTaxes: 150000 });
    const empWithout = await createCostEmployee({ companyId: company.id, grossSalary: 400000, payrollTaxes: 100000 });

    await addEmployeeCompHistory(empWithHistory.id, company.id, new Date('2024-02-01'), 500000, 125000);

    const result = await getEffectiveEmployeeCompBatch(
      [
        { id: empWithHistory.id, grossSalary: new Decimal(600000), payrollTaxes: new Decimal(150000) },
        { id: empWithout.id, grossSalary: new Decimal(400000), payrollTaxes: new Decimal(100000) },
      ],
      '2024-06'
    );

    // empWithHistory: uses history
    expect(result.get(empWithHistory.id)).toEqual({ grossSalary: 500000, payrollTaxes: 125000 });
    // empWithout: falls back to current
    expect(result.get(empWithout.id)).toEqual({ grossSalary: 400000, payrollTaxes: 100000 });
  });

  it('should ignore future history records', async () => {
    const company = await createCompany();
    const emp = await createCostEmployee({ companyId: company.id, grossSalary: 400000, payrollTaxes: 100000 });

    await addEmployeeCompHistory(emp.id, company.id, new Date('2024-09-01'), 999000, 250000);

    const result = await getEffectiveEmployeeCompBatch(
      [{ id: emp.id, grossSalary: new Decimal(400000), payrollTaxes: new Decimal(100000) }],
      '2024-06'
    );

    // Should fallback to current
    expect(result.get(emp.id)).toEqual({ grossSalary: 400000, payrollTaxes: 100000 });
  });

  it('should handle empty employee list', async () => {
    const result = await getEffectiveEmployeeCompBatch([], '2024-06');
    expect(result.size).toBe(0);
  });
});

// ============================================================================
// getEffectiveInputPrice
// ============================================================================

describe('getEffectiveInputPrice', () => {
  it('should return current price when no history exists', async () => {
    const company = await createCompany();
    const input = await createInputItem({
      companyId: company.id,
      currentPrice: 250,
    });

    const price = await getEffectiveInputPrice(input.id, '2024-06');

    expect(price).toBe(250);
  });

  it('should return historical price when history exists', async () => {
    const company = await createCompany();
    const input = await createInputItem({
      companyId: company.id,
      currentPrice: 300,
    });

    await addInputPriceHistory(
      input.id, company.id,
      new Date('2024-03-01'), 180
    );

    const price = await getEffectiveInputPrice(input.id, '2024-06');

    expect(price).toBe(180);
  });

  it('should return most recent history before end of month', async () => {
    const company = await createCompany();
    const input = await createInputItem({
      companyId: company.id,
      currentPrice: 500,
    });

    await addInputPriceHistory(input.id, company.id, new Date('2024-01-01'), 100);
    await addInputPriceHistory(input.id, company.id, new Date('2024-04-15'), 200);

    const price = await getEffectiveInputPrice(input.id, '2024-06');

    expect(price).toBe(200);
  });

  it('should ignore future price history', async () => {
    const company = await createCompany();
    const input = await createInputItem({
      companyId: company.id,
      currentPrice: 150,
    });

    await addInputPriceHistory(input.id, company.id, new Date('2024-09-01'), 999);

    const price = await getEffectiveInputPrice(input.id, '2024-06');

    expect(price).toBe(150);
  });

  it('should throw for non-existent input', async () => {
    await expect(
      getEffectiveInputPrice('non-existent-id', '2024-06')
    ).rejects.toThrow('Input item not found');
  });
});

// ============================================================================
// calculateRecipeCost
// ============================================================================

describe('calculateRecipeCost', () => {
  it('should calculate PER_BATCH recipe cost from current prices', async () => {
    const company = await createCompany();
    const input1 = await createInputItem({ companyId: company.id, currentPrice: 100 });
    const input2 = await createInputItem({ companyId: company.id, currentPrice: 250 });

    const recipe = await createRecipe({
      companyId: company.id,
      inputItems: [
        { inputItemId: input1.id, quantity: 10 },
        { inputItemId: input2.id, quantity: 4 },
      ],
    });

    // Default base is PER_BATCH
    const cost = await calculateRecipeCost(recipe.id);

    // 10*100 + 4*250 = 1000 + 1000 = 2000
    expect(cost.costPerBatch).toBe(2000);
    expect(cost.costPerM3).toBeUndefined();
  });

  it('should calculate PER_M3 recipe cost', async () => {
    const company = await createCompany();
    const input1 = await createInputItem({ companyId: company.id, currentPrice: 50 });
    const input2 = await createInputItem({ companyId: company.id, currentPrice: 20 });

    const recipe = await createRecipe({
      companyId: company.id,
      inputItems: [
        { inputItemId: input1.id, quantity: 300 },
        { inputItemId: input2.id, quantity: 700 },
      ],
    });

    await prisma.recipe.update({ where: { id: recipe.id }, data: { base: 'PER_M3' } });

    const cost = await calculateRecipeCost(recipe.id);

    // 300*50 + 700*20 = 15000 + 14000 = 29000
    expect(cost.costPerM3).toBe(29000);
    expect(cost.costPerBatch).toBeUndefined();
  });

  it('should use historical prices when month is provided', async () => {
    const company = await createCompany();
    const input1 = await createInputItem({ companyId: company.id, currentPrice: 100 });

    // Historical price: $80 effective from March
    await addInputPriceHistory(input1.id, company.id, new Date('2024-03-01'), 80);

    const recipe = await createRecipe({
      companyId: company.id,
      inputItems: [{ inputItemId: input1.id, quantity: 10 }],
    });

    const cost = await calculateRecipeCost(recipe.id, '2024-06');

    // 10 * 80 (historical) = 800
    expect(cost.costPerBatch).toBe(800);
  });

  it('should use current price when no historical price and month provided', async () => {
    const company = await createCompany();
    const input1 = await createInputItem({ companyId: company.id, currentPrice: 100 });

    const recipe = await createRecipe({
      companyId: company.id,
      inputItems: [{ inputItemId: input1.id, quantity: 5 }],
    });

    const cost = await calculateRecipeCost(recipe.id, '2024-06');

    // Falls back to current: 5 * 100 = 500
    expect(cost.costPerBatch).toBe(500);
  });

  it('should handle recipe with no items (zero cost)', async () => {
    const company = await createCompany();
    const recipe = await createRecipe({ companyId: company.id });

    const cost = await calculateRecipeCost(recipe.id);

    expect(cost.costPerBatch).toBe(0);
  });

  it('should throw for non-existent recipe', async () => {
    await expect(
      calculateRecipeCost('non-existent-recipe-id')
    ).rejects.toThrow('Recipe not found');
  });
});

// ============================================================================
// calculateDirectCostPerOutput - BATCH (Direct Yield)
// ============================================================================

describe('calculateDirectCostPerOutput - BATCH direct yield', () => {
  it('should calculate cost with direct yield (outputsPerBatch + scrapGlobal)', async () => {
    const f = await createBatchDirectYieldFixture(MONTH);

    const cost = await calculateDirectCostPerOutput(f.product.id, MONTH);

    // Recipe: 10*150 + 5*200 + 2*300 = 3100
    // Outputs: 100 * (1-0.05) = 95
    // Cost per output = 3100/95 ≈ 32.6316
    expect(cost).toBeCloseTo(3100 / 95, 2);
  });

  it('should throw when yield config is missing', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'BATCH',
    });

    await expect(
      calculateDirectCostPerOutput(product.id, MONTH)
    ).rejects.toThrow('Yield config not found');
  });

  it('should throw when no active recipe exists', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'BATCH',
    });

    await prisma.yieldConfig.create({
      data: { productId: product.id, outputsPerBatch: 100, scrapGlobal: 0 },
    });

    await expect(
      calculateDirectCostPerOutput(product.id, MONTH)
    ).rejects.toThrow('No active recipe found');
  });

  it('should use line-level recipe when no product recipe exists', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'BATCH',
    });

    const input = await createInputItem({ companyId: company.id, currentPrice: 100 });

    // Line-scoped recipe (not product)
    const recipe = await createRecipe({
      companyId: company.id,
      scopeType: 'LINE',
      scopeId: line.id,
      inputItems: [{ inputItemId: input.id, quantity: 10 }],
    });
    await prisma.recipe.update({ where: { id: recipe.id }, data: { isActive: true } });

    await prisma.yieldConfig.create({
      data: { productId: product.id, outputsPerBatch: 50, scrapGlobal: 0 },
    });

    const cost = await calculateDirectCostPerOutput(product.id, MONTH);

    // 10*100 = 1000, 50 outputs, no scrap => 1000/50 = 20
    expect(cost).toBe(20);
  });

  it('should handle zero scrap correctly', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'BATCH',
    });

    const input = await createInputItem({ companyId: company.id, currentPrice: 200 });
    const recipe = await createRecipe({
      companyId: company.id,
      scopeType: 'PRODUCT',
      scopeId: product.id,
      inputItems: [{ inputItemId: input.id, quantity: 5 }],
    });
    await prisma.recipe.update({ where: { id: recipe.id }, data: { isActive: true } });

    await prisma.yieldConfig.create({
      data: { productId: product.id, outputsPerBatch: 50, scrapGlobal: 0 },
    });

    const cost = await calculateDirectCostPerOutput(product.id, MONTH);

    // 5*200 = 1000, 50 outputs, 0 scrap => 1000/50 = 20
    expect(cost).toBe(20);
  });
});

// ============================================================================
// calculateDirectCostPerOutput - BATCH (Chained Yield)
// ============================================================================

describe('calculateDirectCostPerOutput - BATCH chained yield', () => {
  it('should calculate cost with chained yield (intermediates → outputs)', async () => {
    const f = await createBatchChainedYieldFixture(MONTH);

    const cost = await calculateDirectCostPerOutput(f.product.id, MONTH);

    // Recipe: 10*150 + 5*200 = 2500
    // Intermediates: 20 * (1-0.10) = 18
    // Outputs: 18 * 5 * (1-0.08) = 82.8
    // Cost per output = 2500/82.8 ≈ 30.1932
    expect(cost).toBeCloseTo(2500 / 82.8, 2);
  });

  it('should handle zero scrapA and scrapB', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'BATCH',
    });

    const input = await createInputItem({ companyId: company.id, currentPrice: 100 });
    const recipe = await createRecipe({
      companyId: company.id,
      scopeType: 'PRODUCT',
      scopeId: product.id,
      inputItems: [{ inputItemId: input.id, quantity: 10 }],
    });
    await prisma.recipe.update({ where: { id: recipe.id }, data: { isActive: true } });

    await prisma.yieldConfig.create({
      data: {
        productId: product.id,
        intermediatesPerBatch: 10,
        outputsPerIntermediate: 4,
        scrapA: 0,
        scrapB: 0,
        usesIntermediate: true,
      },
    });

    const cost = await calculateDirectCostPerOutput(product.id, MONTH);

    // 10*100 = 1000, 10 intermediates * 4 outputs = 40 total
    // Cost = 1000/40 = 25
    expect(cost).toBe(25);
  });

  it('should handle high scrap rates', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'BATCH',
    });

    const input = await createInputItem({ companyId: company.id, currentPrice: 100 });
    const recipe = await createRecipe({
      companyId: company.id,
      scopeType: 'PRODUCT',
      scopeId: product.id,
      inputItems: [{ inputItemId: input.id, quantity: 10 }],
    });
    await prisma.recipe.update({ where: { id: recipe.id }, data: { isActive: true } });

    await prisma.yieldConfig.create({
      data: {
        productId: product.id,
        intermediatesPerBatch: 10,
        outputsPerIntermediate: 5,
        scrapA: 0.50,  // 50% loss at intermediate
        scrapB: 0.20,  // 20% loss at output
        usesIntermediate: true,
      },
    });

    const cost = await calculateDirectCostPerOutput(product.id, MONTH);

    // 10*100 = 1000
    // Intermediates: 10 * (1-0.50) = 5
    // Outputs: 5 * 5 * (1-0.20) = 20
    // Cost = 1000/20 = 50
    expect(cost).toBe(50);
  });
});

// ============================================================================
// calculateDirectCostPerOutput - BATCH (PER_M3 recipe with yield)
// ============================================================================

describe('calculateDirectCostPerOutput - BATCH with PER_M3 recipe', () => {
  it('should convert PER_M3 recipe cost to batch cost using m3PerBatch', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'BATCH',
    });

    const input = await createInputItem({ companyId: company.id, currentPrice: 100 });
    const recipe = await createRecipe({
      companyId: company.id,
      scopeType: 'PRODUCT',
      scopeId: product.id,
      inputItems: [{ inputItemId: input.id, quantity: 50 }], // $50/m3 * 50 = 5000/m3
    });
    await prisma.recipe.update({ where: { id: recipe.id }, data: { isActive: true, base: 'PER_M3' } });

    await prisma.yieldConfig.create({
      data: {
        productId: product.id,
        m3PerBatch: 2.0,  // 2 m3 per batch
        outputsPerBatch: 100,
        scrapGlobal: 0,
      },
    });

    const cost = await calculateDirectCostPerOutput(product.id, MONTH);

    // Recipe cost per m3 = 50*100 = 5000
    // Batch cost = 5000 * 2.0 = 10000
    // Outputs = 100 * (1-0) = 100
    // Cost per output = 10000/100 = 100
    expect(cost).toBe(100);
  });

  it('should throw when PER_M3 recipe is used without m3PerBatch', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'BATCH',
    });

    const input = await createInputItem({ companyId: company.id, currentPrice: 100 });
    const recipe = await createRecipe({
      companyId: company.id,
      scopeType: 'PRODUCT',
      scopeId: product.id,
      inputItems: [{ inputItemId: input.id, quantity: 10 }],
    });
    await prisma.recipe.update({ where: { id: recipe.id }, data: { isActive: true, base: 'PER_M3' } });

    // No m3PerBatch set
    await prisma.yieldConfig.create({
      data: { productId: product.id, outputsPerBatch: 100, scrapGlobal: 0 },
    });

    await expect(
      calculateDirectCostPerOutput(product.id, MONTH)
    ).rejects.toThrow('m3PerBatch required');
  });
});

// ============================================================================
// calculateDirectCostPerOutput - VOLUMETRIC
// ============================================================================

describe('calculateDirectCostPerOutput - VOLUMETRIC', () => {
  it('should calculate volumetric cost (recipe per m3 * m3PerOutput)', async () => {
    const f = await createVolumetricProductFixture(MONTH);

    const cost = await calculateDirectCostPerOutput(f.product.id, MONTH);

    // Recipe: 300*50 + 700*20 = 29000/m3
    // m3PerOutput = 0.05
    // Cost = 29000 * 0.05 = 1450
    expect(cost).toBe(1450);
  });

  it('should throw when volumetric param is missing', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'VOLUMETRIC',
    });

    await expect(
      calculateDirectCostPerOutput(product.id, MONTH)
    ).rejects.toThrow('Volumetric param not found');
  });

  it('should throw when no active recipe exists for volumetric', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'VOLUMETRIC',
    });

    await prisma.volumetricParam.create({
      data: { productId: product.id, m3PerOutput: 0.05 },
    });

    await expect(
      calculateDirectCostPerOutput(product.id, MONTH)
    ).rejects.toThrow('No active recipe found');
  });

  it('should fallback to costPerBatch when PER_BATCH recipe is used with volumetric product', async () => {
    // Tests the fallback branch: costPerM3 || recipeCost.costPerBatch || 0
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'VOLUMETRIC',
    });

    const input = await createInputItem({ companyId: company.id, currentPrice: 100 });

    // PER_BATCH recipe (not PER_M3) - tests the fallback branch
    const recipe = await createRecipe({
      companyId: company.id,
      scopeType: 'PRODUCT',
      scopeId: product.id,
      inputItems: [{ inputItemId: input.id, quantity: 50 }],
    });
    await prisma.recipe.update({ where: { id: recipe.id }, data: { isActive: true, base: 'PER_BATCH' } });

    await prisma.volumetricParam.create({
      data: { productId: product.id, m3PerOutput: 0.02 },
    });

    const cost = await calculateDirectCostPerOutput(product.id, MONTH);

    // Recipe: 50*100 = 5000 (PER_BATCH)
    // costPerM3 is undefined, so falls back to costPerBatch = 5000
    // Cost = 5000 * 0.02 = 100
    expect(cost).toBe(100);
  });
});

// ============================================================================
// calculateDirectCostPerOutput - PER_UNIT_BOM
// ============================================================================

describe('calculateDirectCostPerOutput - PER_UNIT_BOM', () => {
  it('should sum BOM items cost per output', async () => {
    const f = await createPerUnitBOMFixture(MONTH);

    const cost = await calculateDirectCostPerOutput(f.product.id, MONTH);

    // 2 * 500 + 20 * 10 = 1000 + 200 = 1200
    expect(cost).toBe(1200);
  });

  it('should throw when BOM is empty', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'PER_UNIT_BOM',
    });

    await expect(
      calculateDirectCostPerOutput(product.id, MONTH)
    ).rejects.toThrow('Per unit BOM not found');
  });
});

// ============================================================================
// calculateDirectCostPerOutput - Edge Cases
// ============================================================================

describe('calculateDirectCostPerOutput - edge cases', () => {
  it('should throw for non-existent product', async () => {
    await expect(
      calculateDirectCostPerOutput('non-existent-product', MONTH)
    ).rejects.toThrow('Product not found');
  });

  it('should throw for unknown cost method', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);

    // Create product, then force an invalid cost method via raw SQL
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'BATCH',
    });

    // Manually set to a non-standard method to test the default switch branch
    await prisma.$executeRawUnsafe(
      `UPDATE "CostProduct" SET "costMethod" = 'REAL' WHERE id = $1`,
      product.id
    );

    await expect(
      calculateDirectCostPerOutput(product.id, MONTH)
    ).rejects.toThrow('Unknown cost method');
  });

  it('should throw when outputs per batch calculates to zero (100% scrap)', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'BATCH',
    });

    const input = await createInputItem({ companyId: company.id, currentPrice: 100 });
    const recipe = await createRecipe({
      companyId: company.id,
      scopeType: 'PRODUCT',
      scopeId: product.id,
      inputItems: [{ inputItemId: input.id, quantity: 10 }],
    });
    await prisma.recipe.update({ where: { id: recipe.id }, data: { isActive: true } });

    await prisma.yieldConfig.create({
      data: { productId: product.id, outputsPerBatch: 100, scrapGlobal: 1.0 },
    });

    await expect(
      calculateDirectCostPerOutput(product.id, MONTH)
    ).rejects.toThrow('Invalid outputs per batch');
  });

  it('should throw when yield config has no outputs configuration', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'BATCH',
    });

    const input = await createInputItem({ companyId: company.id, currentPrice: 100 });
    const recipe = await createRecipe({
      companyId: company.id,
      scopeType: 'PRODUCT',
      scopeId: product.id,
      inputItems: [{ inputItemId: input.id, quantity: 10 }],
    });
    await prisma.recipe.update({ where: { id: recipe.id }, data: { isActive: true } });

    // YieldConfig with no outputsPerBatch and no intermediates
    await prisma.yieldConfig.create({
      data: { productId: product.id },
    });

    await expect(
      calculateDirectCostPerOutput(product.id, MONTH)
    ).rejects.toThrow('Invalid yield configuration');
  });

  it('should handle negative scrap values gracefully (outputs > batch size)', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'BATCH',
    });

    const input = await createInputItem({ companyId: company.id, currentPrice: 100 });
    const recipe = await createRecipe({
      companyId: company.id,
      scopeType: 'PRODUCT',
      scopeId: product.id,
      inputItems: [{ inputItemId: input.id, quantity: 10 }],
    });
    await prisma.recipe.update({ where: { id: recipe.id }, data: { isActive: true } });

    // Negative scrap effectively increases outputs (1 - (-0.10)) = 1.10
    await prisma.yieldConfig.create({
      data: { productId: product.id, outputsPerBatch: 100, scrapGlobal: -0.10 },
    });

    const cost = await calculateDirectCostPerOutput(product.id, MONTH);

    // 10*100 = 1000, outputs = 100 * (1-(-0.10)) = 110
    // Cost = 1000/110 ≈ 9.0909
    expect(cost).toBeCloseTo(1000 / 110, 2);
  });

  it('should calculate correctly with very small input prices', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'PER_UNIT_BOM',
    });

    const input = await createInputItem({ companyId: company.id, currentPrice: 0.001 });
    await prisma.perUnitBOM.create({
      data: { productId: product.id, inputId: input.id, qtyPerOut: 1000, unitLabel: 'g' },
    });

    const cost = await calculateDirectCostPerOutput(product.id, MONTH);

    // 1000 * 0.001 = 1.0
    expect(cost).toBeCloseTo(1.0, 4);
  });
});

// ============================================================================
// getProductionByLine
// ============================================================================

describe('getProductionByLine', () => {
  it('should aggregate production by line', async () => {
    const company = await createCompany();
    const line1 = await createLine(company.id, 'Line A');
    const line2 = await createLine(company.id, 'Line B');

    const prodA1 = await createCostProduct({ lineId: line1.id, companyId: company.id, name: 'P-A1' });
    const prodA2 = await createCostProduct({ lineId: line1.id, companyId: company.id, name: 'P-A2' });
    const prodB1 = await createCostProduct({ lineId: line2.id, companyId: company.id, name: 'P-B1' });

    await createMonthlyProduction({ companyId: company.id, productId: prodA1.id, month: MONTH, producedQuantity: 500 });
    await createMonthlyProduction({ companyId: company.id, productId: prodA2.id, month: MONTH, producedQuantity: 300 });
    await createMonthlyProduction({ companyId: company.id, productId: prodB1.id, month: MONTH, producedQuantity: 1000 });

    const result = await getProductionByLine(MONTH);

    expect(result).toHaveLength(2);

    const lineA = result.find(l => l.lineId === line1.id)!;
    expect(lineA.totalProduction).toBe(800);
    expect(lineA.products).toHaveLength(2);

    const lineB = result.find(l => l.lineId === line2.id)!;
    expect(lineB.totalProduction).toBe(1000);
    expect(lineB.products).toHaveLength(1);
  });

  it('should return empty array when no production data', async () => {
    const result = await getProductionByLine('2099-01');
    expect(result).toHaveLength(0);
  });

  it('should only include production for requested month', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({ lineId: line.id, companyId: company.id });

    await createMonthlyProduction({ companyId: company.id, productId: product.id, month: '2024-05', producedQuantity: 100 });
    await createMonthlyProduction({ companyId: company.id, productId: product.id, month: '2024-06', producedQuantity: 200 });
    await createMonthlyProduction({ companyId: company.id, productId: product.id, month: '2024-07', producedQuantity: 300 });

    const result = await getProductionByLine('2024-06');

    expect(result).toHaveLength(1);
    expect(result[0].totalProduction).toBe(200);
  });
});

// ============================================================================
// calculateIndirectCostPerOutput
// ============================================================================

describe('calculateIndirectCostPerOutput', () => {
  it('should allocate indirect costs proportionally to line', async () => {
    const f = await createBatchDirectYieldFixture(MONTH);

    const cost = await calculateIndirectCostPerOutput(f.line.id, MONTH);

    // Total indirect: $80,000
    // Line allocation: 60%
    // Line indirect = 80000 * 0.60 = 48000
    // Production: 1000 units
    // Per output = 48000 / 1000 = 48
    expect(cost).toBe(48);
  });

  it('should return 0 when line has zero production', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);

    await prisma.globalAllocation.create({
      data: { category: 'INDIRECTOS', lineId: line.id, percent: 0.50 },
    });

    await prisma.monthlyIndirect.create({
      data: {
        category: 'UTILITIES',
        label: 'Test',
        amount: 100000,
        month: MONTH,
        companyId: company.id,
      },
    });

    const cost = await calculateIndirectCostPerOutput(line.id, MONTH);
    expect(cost).toBe(0);
  });

  it('should throw when allocation not found', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);

    await expect(
      calculateIndirectCostPerOutput(line.id, MONTH)
    ).rejects.toThrow('Indirect allocation not found');
  });

  it('should handle multiple indirect items summed together', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({ lineId: line.id, companyId: company.id });

    await prisma.globalAllocation.create({
      data: { category: 'INDIRECTOS', lineId: line.id, percent: 1.0 },
    });

    await prisma.monthlyIndirect.createMany({
      data: [
        { category: 'UTILITIES', label: 'Electricity', amount: 50000, month: MONTH, companyId: company.id },
        { category: 'UTILITIES', label: 'Water', amount: 30000, month: MONTH, companyId: company.id },
        { category: 'MKT', label: 'Marketing', amount: 20000, month: MONTH, companyId: company.id },
      ],
    });

    await createMonthlyProduction({ companyId: company.id, productId: product.id, month: MONTH, producedQuantity: 500 });

    const cost = await calculateIndirectCostPerOutput(line.id, MONTH);

    // Total indirect = 50000 + 30000 + 20000 = 100000
    // Allocation = 100%, Production = 500
    // Per output = 100000 / 500 = 200
    expect(cost).toBe(200);
  });
});

// ============================================================================
// calculateEmployeeCostPerOutput
// ============================================================================

describe('calculateEmployeeCostPerOutput', () => {
  it('should allocate employee costs proportionally to line', async () => {
    const f = await createBatchDirectYieldFixture(MONTH);

    const cost = await calculateEmployeeCostPerOutput(f.line.id, MONTH);

    // Employee: salary=$600k + taxes=$150k = $750k
    // Allocation: 40%
    // Line cost = 750000 * 0.40 = 300000
    // Production: 1000
    // Per output = 300000 / 1000 = 300
    expect(cost).toBe(300);
  });

  it('should return 0 when line has zero production', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const employee = await createCostEmployee({ companyId: company.id });

    await prisma.globalAllocation.create({
      data: { category: 'EMPLEADOS', lineId: line.id, percent: 0.50 },
    });

    const cost = await calculateEmployeeCostPerOutput(line.id, MONTH);
    expect(cost).toBe(0);
  });

  it('should throw when employee allocation not found', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);

    await expect(
      calculateEmployeeCostPerOutput(line.id, MONTH)
    ).rejects.toThrow('Employee allocation not found');
  });

  it('should use historical compensation when available', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({ lineId: line.id, companyId: company.id });

    const employee = await createCostEmployee({
      companyId: company.id,
      grossSalary: 800000,
      payrollTaxes: 200000,
    });

    // Historical compensation (lower than current)
    await addEmployeeCompHistory(
      employee.id, company.id,
      new Date('2024-04-01'), 500000, 125000
    );

    await prisma.globalAllocation.create({
      data: { category: 'EMPLEADOS', lineId: line.id, percent: 1.0 },
    });

    await createMonthlyProduction({ companyId: company.id, productId: product.id, month: MONTH, producedQuantity: 100 });

    const cost = await calculateEmployeeCostPerOutput(line.id, MONTH);

    // Historical: 500000 + 125000 = 625000
    // Allocation: 100%, Production: 100
    // Per output = 625000 / 100 = 6250
    expect(cost).toBe(6250);
  });

  it('should use current salary when no history exists before target month', async () => {
    // When an employee has no comp history records effective before the target month,
    // getEffectiveEmployeeCompBatch falls back to using emp.grossSalary/payrollTaxes
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({ lineId: line.id, companyId: company.id });

    const emp = await createCostEmployee({
      companyId: company.id,
      grossSalary: 400000,
      payrollTaxes: 100000,
    });

    // Add a history record AFTER the target month — won't match the query
    await addEmployeeCompHistory(emp.id, company.id, new Date('2024-09-01'), 999000, 250000);

    await prisma.globalAllocation.create({
      data: { category: 'EMPLEADOS', lineId: line.id, percent: 1.0 },
    });

    await createMonthlyProduction({ companyId: company.id, productId: product.id, month: MONTH, producedQuantity: 100 });

    const cost = await calculateEmployeeCostPerOutput(line.id, MONTH);

    // Should use current salary: 400000 + 100000 = 500000
    // Allocation: 100%, Production: 100
    // Per output = 500000 / 100 = 5000
    expect(cost).toBe(5000);
  });

  it('should sum all active employees', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({ lineId: line.id, companyId: company.id });

    await createCostEmployee({ companyId: company.id, grossSalary: 300000, payrollTaxes: 75000 });
    await createCostEmployee({ companyId: company.id, grossSalary: 400000, payrollTaxes: 100000 });
    await createCostEmployee({ companyId: company.id, grossSalary: 500000, payrollTaxes: 125000, active: false });

    await prisma.globalAllocation.create({
      data: { category: 'EMPLEADOS', lineId: line.id, percent: 1.0 },
    });

    await createMonthlyProduction({ companyId: company.id, productId: product.id, month: MONTH, producedQuantity: 100 });

    const cost = await calculateEmployeeCostPerOutput(line.id, MONTH);

    // Active employees only: (300k+75k) + (400k+100k) = 375k + 500k = 875k
    // Allocation: 100%, Production: 100
    // Per output = 875000 / 100 = 8750
    expect(cost).toBe(8750);
  });
});

// ============================================================================
// calculateProductCost (full orchestration)
// ============================================================================

describe('calculateProductCost', () => {
  it('should return full cost breakdown for BATCH product', async () => {
    const f = await createBatchDirectYieldFixture(MONTH);

    const result = await calculateProductCost(f.product.id, MONTH);

    // Direct: 3100/95 ≈ 32.63
    expect(result.directPerOutput).toBeCloseTo(3100 / 95, 2);

    // Indirect: 80000 * 0.60 / 1000 = 48
    expect(result.indirectPerOutput).toBe(48);

    // Employee: 750000 * 0.40 / 1000 = 300
    expect(result.employeesPerOutput).toBe(300);

    // Total = direct + indirect + employees
    expect(result.totalPerOutput).toBeCloseTo(3100 / 95 + 48 + 300, 2);
  });

  it('should return full cost breakdown for VOLUMETRIC product', async () => {
    const f = await createVolumetricProductFixture(MONTH);

    const result = await calculateProductCost(f.product.id, MONTH);

    // Direct: 29000 * 0.05 = 1450
    expect(result.directPerOutput).toBe(1450);

    // Indirect: 40000 * 0.30 / 2000 = 6
    expect(result.indirectPerOutput).toBe(6);

    // Employee: (500000+125000) * 0.25 / 2000 = 78.125
    expect(result.employeesPerOutput).toBe(78.125);

    expect(result.totalPerOutput).toBeCloseTo(1450 + 6 + 78.125, 2);
  });

  it('should return full cost breakdown for PER_UNIT_BOM product', async () => {
    const f = await createPerUnitBOMFixture(MONTH);

    const result = await calculateProductCost(f.product.id, MONTH);

    // Direct: 2*500 + 20*10 = 1200
    expect(result.directPerOutput).toBe(1200);

    // Indirect: 30000 * 0.45 / 200 = 67.5
    expect(result.indirectPerOutput).toBe(67.5);

    // Employee: (550000+137500) * 0.50 / 200 = 1718.75
    expect(result.employeesPerOutput).toBe(1718.75);

    expect(result.totalPerOutput).toBeCloseTo(1200 + 67.5 + 1718.75, 2);
  });

  it('should throw for non-existent product', async () => {
    await expect(
      calculateProductCost('non-existent-id', MONTH)
    ).rejects.toThrow('Product not found');
  });
});

// ============================================================================
// recalculateMonthCosts (bulk + history persistence)
// ============================================================================

describe('recalculateMonthCosts', () => {
  it('should calculate and persist cost history for all active products', async () => {
    const f = await createBatchDirectYieldFixture(MONTH);

    await recalculateMonthCosts(MONTH);

    const history = await prisma.productCostHistory.findMany({
      where: { productId: f.product.id, month: MONTH },
    });

    expect(history.length).toBeGreaterThanOrEqual(1);
    const record = history[0];
    expect(record.directPerOutput.toNumber()).toBeCloseTo(3100 / 95, 2);
    expect(record.indirectPerOutput.toNumber()).toBe(48);
    expect(record.employeesPerOutput.toNumber()).toBe(300);
    expect(record.manualOverride).toBe(false);
  });

  it('should filter by companyId when provided', async () => {
    const f1 = await createBatchDirectYieldFixture(MONTH);
    const f2 = await createPerUnitBOMFixture(MONTH);

    await recalculateMonthCosts(MONTH, f1.company.id);

    // Only f1's product should have history
    const h1 = await prisma.productCostHistory.findMany({
      where: { productId: f1.product.id },
    });
    const h2 = await prisma.productCostHistory.findMany({
      where: { productId: f2.product.id },
    });

    expect(h1.length).toBeGreaterThanOrEqual(1);
    expect(h2.length).toBe(0);
  });

  it('should skip inactive products', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);

    const activeProduct = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'PER_UNIT_BOM',
      active: true,
    });

    const inactiveProduct = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'PER_UNIT_BOM',
      active: false,
    });

    // Setup BOM for active product
    const input = await createInputItem({ companyId: company.id, currentPrice: 100 });
    await prisma.perUnitBOM.create({
      data: { productId: activeProduct.id, inputId: input.id, qtyPerOut: 1, unitLabel: 'unit' },
    });

    // Setup allocations and production
    await prisma.globalAllocation.create({ data: { category: 'INDIRECTOS', lineId: line.id, percent: 0.50 } });
    await prisma.globalAllocation.create({ data: { category: 'EMPLEADOS', lineId: line.id, percent: 0.50 } });
    await createMonthlyProduction({ companyId: company.id, productId: activeProduct.id, month: MONTH, producedQuantity: 100 });

    await recalculateMonthCosts(MONTH, company.id);

    const activeHistory = await prisma.productCostHistory.findMany({
      where: { productId: activeProduct.id },
    });
    const inactiveHistory = await prisma.productCostHistory.findMany({
      where: { productId: inactiveProduct.id },
    });

    expect(activeHistory.length).toBeGreaterThanOrEqual(1);
    expect(inactiveHistory.length).toBe(0);
  });

  it('should continue processing when individual product fails', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);

    // Product 1: will fail (no recipe/config)
    const failProduct = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'BATCH',
    });

    // Product 2: will succeed
    const okProduct = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'PER_UNIT_BOM',
    });

    const input = await createInputItem({ companyId: company.id, currentPrice: 50 });
    await prisma.perUnitBOM.create({
      data: { productId: okProduct.id, inputId: input.id, qtyPerOut: 3, unitLabel: 'unit' },
    });

    await prisma.globalAllocation.create({ data: { category: 'INDIRECTOS', lineId: line.id, percent: 1.0 } });
    await prisma.globalAllocation.create({ data: { category: 'EMPLEADOS', lineId: line.id, percent: 1.0 } });
    await createMonthlyProduction({ companyId: company.id, productId: okProduct.id, month: MONTH, producedQuantity: 50 });

    // Should not throw even though failProduct errors
    await expect(
      recalculateMonthCosts(MONTH, company.id)
    ).resolves.toBeUndefined();

    // okProduct should still have history
    const history = await prisma.productCostHistory.findMany({
      where: { productId: okProduct.id },
    });
    expect(history.length).toBeGreaterThanOrEqual(1);
  });

  it('should upsert (update) when recalculating same month twice', async () => {
    const f = await createBatchDirectYieldFixture(MONTH);

    // First calculation
    await recalculateMonthCosts(MONTH, f.company.id);

    // Update input price
    await prisma.inputItem.update({
      where: { id: f.flour.id },
      data: { currentPrice: 300 }, // was 150
    });

    // Second calculation (upsert)
    await recalculateMonthCosts(MONTH, f.company.id);

    const history = await prisma.productCostHistory.findMany({
      where: { productId: f.product.id, month: MONTH },
    });

    // Should only have one record (upserted, not duplicated)
    expect(history.length).toBe(1);

    // Direct cost should reflect new price: (10*300 + 5*200 + 2*300) / 95 = 4600/95
    expect(history[0].directPerOutput.toNumber()).toBeCloseTo(4600 / 95, 2);
  });
});

// ============================================================================
// Integration: Full Cost Flow
// ============================================================================

describe('Integration: Full cost calculation flow', () => {
  it('should produce consistent results across the entire pipeline', async () => {
    const f = await createBatchDirectYieldFixture(MONTH);

    // Step 1: Calculate recipe cost
    const recipeCost = await calculateRecipeCost(f.recipe.id);
    expect(recipeCost.costPerBatch).toBe(3100);

    // Step 2: Calculate direct cost
    const directCost = await calculateDirectCostPerOutput(f.product.id, MONTH);
    expect(directCost).toBeCloseTo(3100 / 95, 2);

    // Step 3: Calculate indirect cost
    const indirectCost = await calculateIndirectCostPerOutput(f.line.id, MONTH);
    expect(indirectCost).toBe(48);

    // Step 4: Calculate employee cost
    const employeeCost = await calculateEmployeeCostPerOutput(f.line.id, MONTH);
    expect(employeeCost).toBe(300);

    // Step 5: Full product cost
    const fullCost = await calculateProductCost(f.product.id, MONTH);
    expect(fullCost.directPerOutput).toBeCloseTo(directCost, 4);
    expect(fullCost.indirectPerOutput).toBe(indirectCost);
    expect(fullCost.employeesPerOutput).toBe(employeeCost);
    expect(fullCost.totalPerOutput).toBeCloseTo(directCost + indirectCost + employeeCost, 4);

    // Step 6: Recalculate and verify history
    await recalculateMonthCosts(MONTH, f.company.id);

    const history = await prisma.productCostHistory.findMany({
      where: { productId: f.product.id, month: MONTH },
    });
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].totalPerOutput.toNumber()).toBeCloseTo(fullCost.totalPerOutput, 2);
  });

  it('should handle multi-product lines with shared allocation', async () => {
    const company = await createCompany();
    const line = await createLine(company.id, 'Shared Line');

    // Two products on same line
    const product1 = await createCostProduct({
      name: 'Product A',
      lineId: line.id,
      companyId: company.id,
      costMethod: 'PER_UNIT_BOM',
    });
    const product2 = await createCostProduct({
      name: 'Product B',
      lineId: line.id,
      companyId: company.id,
      costMethod: 'PER_UNIT_BOM',
    });

    const input = await createInputItem({ companyId: company.id, currentPrice: 100 });

    await prisma.perUnitBOM.create({
      data: { productId: product1.id, inputId: input.id, qtyPerOut: 2, unitLabel: 'un' },
    });
    await prisma.perUnitBOM.create({
      data: { productId: product2.id, inputId: input.id, qtyPerOut: 5, unitLabel: 'un' },
    });

    const employee = await createCostEmployee({
      companyId: company.id,
      grossSalary: 1000000,
      payrollTaxes: 250000,
    });

    await prisma.globalAllocation.create({ data: { category: 'INDIRECTOS', lineId: line.id, percent: 1.0 } });
    await prisma.globalAllocation.create({ data: { category: 'EMPLEADOS', lineId: line.id, percent: 1.0 } });

    await prisma.monthlyIndirect.create({
      data: { category: 'UTILITIES', label: 'Elec', amount: 100000, month: MONTH, companyId: company.id },
    });

    // Product A: 300 units, Product B: 700 units = 1000 total
    await createMonthlyProduction({ companyId: company.id, productId: product1.id, month: MONTH, producedQuantity: 300 });
    await createMonthlyProduction({ companyId: company.id, productId: product2.id, month: MONTH, producedQuantity: 700 });

    const cost1 = await calculateProductCost(product1.id, MONTH);
    const cost2 = await calculateProductCost(product2.id, MONTH);

    // Both should have same indirect and employee per output (shared line, same total production)
    expect(cost1.indirectPerOutput).toBe(cost2.indirectPerOutput);
    expect(cost1.employeesPerOutput).toBe(cost2.employeesPerOutput);

    // Indirect per output = 100000 * 1.0 / 1000 = 100
    expect(cost1.indirectPerOutput).toBe(100);

    // Employee per output = 1250000 * 1.0 / 1000 = 1250
    expect(cost1.employeesPerOutput).toBe(1250);

    // Direct costs differ
    expect(cost1.directPerOutput).toBe(200);  // 2 * 100
    expect(cost2.directPerOutput).toBe(500);  // 5 * 100
  });
});

// ============================================================================
// Regression Tests
// ============================================================================

describe('Regression tests', () => {
  it('should handle Decimal precision correctly (no floating point drift)', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({
      lineId: line.id,
      companyId: company.id,
      costMethod: 'PER_UNIT_BOM',
    });

    // Use values that commonly cause floating point issues
    const input1 = await createInputItem({ companyId: company.id, currentPrice: 0.1 });
    const input2 = await createInputItem({ companyId: company.id, currentPrice: 0.2 });

    await prisma.perUnitBOM.create({
      data: { productId: product.id, inputId: input1.id, qtyPerOut: 3, unitLabel: 'un' },
    });
    await prisma.perUnitBOM.create({
      data: { productId: product.id, inputId: input2.id, qtyPerOut: 7, unitLabel: 'un' },
    });

    const cost = await calculateDirectCostPerOutput(product.id, MONTH);

    // 3 * 0.1 + 7 * 0.2 = 0.3 + 1.4 = 1.7
    expect(cost).toBeCloseTo(1.7, 4);
  });

  it('should handle very large production quantities', async () => {
    const company = await createCompany();
    const line = await createLine(company.id);
    const product = await createCostProduct({ lineId: line.id, companyId: company.id });

    await prisma.globalAllocation.create({ data: { category: 'INDIRECTOS', lineId: line.id, percent: 0.50 } });
    await prisma.monthlyIndirect.create({
      data: { category: 'UTILITIES', label: 'X', amount: 1000000, month: MONTH, companyId: company.id },
    });
    await createMonthlyProduction({ companyId: company.id, productId: product.id, month: MONTH, producedQuantity: 999999 });

    const cost = await calculateIndirectCostPerOutput(line.id, MONTH);

    // 1000000 * 0.50 / 999999 ≈ 0.5000005
    expect(cost).toBeCloseTo(500000 / 999999, 4);
  });

  it('should handle recipe with many items correctly', async () => {
    const company = await createCompany();
    const items: Awaited<ReturnType<typeof createInputItem>>[] = [];

    for (let i = 0; i < 20; i++) {
      items.push(await createInputItem({
        companyId: company.id,
        name: `Input-${i}`,
        currentPrice: (i + 1) * 10,
      }));
    }

    const recipe = await createRecipe({
      companyId: company.id,
      inputItems: items.map((item, i) => ({
        inputItemId: item.id,
        quantity: i + 1,
      })),
    });

    const cost = await calculateRecipeCost(recipe.id);

    // Sum of (i+1) * (i+1)*10 for i=0..19
    // = Sum of (i+1)^2 * 10
    let expected = 0;
    for (let i = 0; i < 20; i++) {
      expected += (i + 1) * ((i + 1) * 10);
    }
    expect(cost.costPerBatch).toBe(expected);
  });

  it('should correctly handle month boundary dates', async () => {
    const company = await createCompany();
    const input = await createInputItem({ companyId: company.id, currentPrice: 100 });

    // Price effective exactly on last day of June
    await addInputPriceHistory(input.id, company.id, new Date('2024-06-30'), 75);

    const price = await getEffectiveInputPrice(input.id, '2024-06');
    expect(price).toBe(75);
  });

  it('should handle January correctly (month parsing)', async () => {
    const company = await createCompany();
    const input = await createInputItem({ companyId: company.id, currentPrice: 100 });

    await addInputPriceHistory(input.id, company.id, new Date('2024-01-01'), 50);

    const price = await getEffectiveInputPrice(input.id, '2024-01');
    expect(price).toBe(50);
  });

  it('should handle December correctly (month parsing)', async () => {
    const company = await createCompany();
    const input = await createInputItem({ companyId: company.id, currentPrice: 100 });

    await addInputPriceHistory(input.id, company.id, new Date('2024-12-01'), 60);

    const price = await getEffectiveInputPrice(input.id, '2024-12');
    expect(price).toBe(60);
  });
});
