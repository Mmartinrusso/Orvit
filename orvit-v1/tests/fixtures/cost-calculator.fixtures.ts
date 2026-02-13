/**
 * Cost Calculator Test Fixtures
 *
 * Realistic data sets for testing the cost calculation engine.
 * Based on a bakery/manufacturing scenario with batch, volumetric,
 * and per-unit BOM cost methods.
 */
import { getTestPrisma } from '../setup/db-setup';
import { createCompany } from '../factories/company.factory';
import {
  createLine,
  createCostProduct,
  createInputItem,
  createCostEmployee,
  createRecipe,
  createIndirectItem,
  createMonthlyProduction,
} from '../factories/cost.factory';

const prisma = getTestPrisma();

// ============================================================================
// Types
// ============================================================================

export interface BatchProductFixture {
  company: Awaited<ReturnType<typeof createCompany>>;
  line: Awaited<ReturnType<typeof createLine>>;
  product: Awaited<ReturnType<typeof createCostProduct>>;
  flour: Awaited<ReturnType<typeof createInputItem>>;
  sugar: Awaited<ReturnType<typeof createInputItem>>;
  yeast: Awaited<ReturnType<typeof createInputItem>>;
  recipe: Awaited<ReturnType<typeof createRecipe>>;
  yieldConfig: any;
  employee: Awaited<ReturnType<typeof createCostEmployee>>;
  indirectItem: Awaited<ReturnType<typeof createIndirectItem>>;
  indirectAllocation: any;
  employeeAllocation: any;
  monthlyProduction: Awaited<ReturnType<typeof createMonthlyProduction>>;
  monthlyIndirect: any;
}

export interface VolumetricProductFixture {
  company: Awaited<ReturnType<typeof createCompany>>;
  line: Awaited<ReturnType<typeof createLine>>;
  product: Awaited<ReturnType<typeof createCostProduct>>;
  cement: Awaited<ReturnType<typeof createInputItem>>;
  sand: Awaited<ReturnType<typeof createInputItem>>;
  recipe: Awaited<ReturnType<typeof createRecipe>>;
  volumetricParam: any;
  employee: Awaited<ReturnType<typeof createCostEmployee>>;
  indirectAllocation: any;
  employeeAllocation: any;
  monthlyProduction: Awaited<ReturnType<typeof createMonthlyProduction>>;
  monthlyIndirect: any;
}

export interface PerUnitBOMFixture {
  company: Awaited<ReturnType<typeof createCompany>>;
  line: Awaited<ReturnType<typeof createLine>>;
  product: Awaited<ReturnType<typeof createCostProduct>>;
  wood: Awaited<ReturnType<typeof createInputItem>>;
  screws: Awaited<ReturnType<typeof createInputItem>>;
  perUnitBOM: any[];
  employee: Awaited<ReturnType<typeof createCostEmployee>>;
  indirectAllocation: any;
  employeeAllocation: any;
  monthlyProduction: Awaited<ReturnType<typeof createMonthlyProduction>>;
  monthlyIndirect: any;
}

// ============================================================================
// BATCH Product with Direct Yield (Batch → Output)
// ============================================================================

/**
 * Creates a batch product with simple direct yield:
 *   Recipe: 10kg flour ($150/kg) + 5kg sugar ($200/kg) + 2kg yeast ($300/kg)
 *   Batch cost = 10*150 + 5*200 + 2*300 = 1500 + 1000 + 600 = $3100
 *   Yield: 100 outputs per batch, 5% scrap
 *   Effective outputs = 100 * (1 - 0.05) = 95
 *   Direct cost per output = 3100 / 95 ≈ $32.63
 *
 *   Employee: $600,000 salary + $150,000 taxes = $750,000 total
 *   Allocation: 40% to this line
 *   Line employee cost = $750,000 * 0.40 = $300,000
 *   Production: 1000 units
 *   Employee per output = $300,000 / 1000 = $300
 *
 *   Indirect: $80,000 electricity
 *   Allocation: 60% to this line
 *   Line indirect cost = $80,000 * 0.60 = $48,000
 *   Indirect per output = $48,000 / 1000 = $48
 */
export async function createBatchDirectYieldFixture(
  month = '2024-06'
): Promise<BatchProductFixture> {
  const company = await createCompany({ name: 'Bakery Corp' });
  const line = await createLine(company.id, 'Bread Line');

  const product = await createCostProduct({
    name: 'White Bread',
    lineId: line.id,
    companyId: company.id,
    costMethod: 'BATCH',
  });

  const flour = await createInputItem({ name: 'Flour', companyId: company.id, currentPrice: 150, unitLabel: 'kg' });
  const sugar = await createInputItem({ name: 'Sugar', companyId: company.id, currentPrice: 200, unitLabel: 'kg' });
  const yeast = await createInputItem({ name: 'Yeast', companyId: company.id, currentPrice: 300, unitLabel: 'kg' });

  const recipe = await createRecipe({
    name: 'White Bread Recipe',
    companyId: company.id,
    scopeType: 'PRODUCT',
    scopeId: product.id,
    inputItems: [
      { inputItemId: flour.id, quantity: 10, unitLabel: 'kg' },
      { inputItemId: sugar.id, quantity: 5, unitLabel: 'kg' },
      { inputItemId: yeast.id, quantity: 2, unitLabel: 'kg' },
    ],
  });

  // Activate recipe
  await prisma.recipe.update({ where: { id: recipe.id }, data: { isActive: true } });

  // Direct yield: 100 outputs/batch, 5% scrap
  const yieldConfig = await prisma.yieldConfig.create({
    data: {
      productId: product.id,
      outputsPerBatch: 100,
      scrapGlobal: 0.05,
    },
  });

  const employee = await createCostEmployee({
    name: 'Baker Joe',
    companyId: company.id,
    grossSalary: 600000,
    payrollTaxes: 150000,
  });

  const indirectItem = await createIndirectItem({
    label: 'Electricity',
    code: `ELEC-${Date.now()}`,
    companyId: company.id,
    currentPrice: 80000,
  });

  // Allocations
  const indirectAllocation = await prisma.globalAllocation.create({
    data: { category: 'INDIRECTOS', lineId: line.id, percent: 0.60 },
  });

  const employeeAllocation = await prisma.globalAllocation.create({
    data: { category: 'EMPLEADOS', lineId: line.id, percent: 0.40 },
  });

  // Monthly data
  const monthlyProduction = await createMonthlyProduction({
    companyId: company.id,
    productId: product.id,
    month,
    producedQuantity: 1000,
  });

  const monthlyIndirect = await prisma.monthlyIndirect.create({
    data: {
      category: 'UTILITIES',
      label: 'Electricity',
      amount: 80000,
      month,
      companyId: company.id,
      itemId: indirectItem.id,
    },
  });

  return {
    company, line, product, flour, sugar, yeast, recipe, yieldConfig,
    employee, indirectItem, indirectAllocation, employeeAllocation,
    monthlyProduction, monthlyIndirect,
  };
}

// ============================================================================
// BATCH Product with Chained Yield (Batch → Intermediate → Output)
// ============================================================================

/**
 * Creates a batch product with chained yield:
 *   Recipe: 10kg flour ($150/kg) + 5kg sugar ($200/kg)
 *   Batch cost = 10*150 + 5*200 = 1500 + 1000 = $2500
 *   Yield: 20 intermediates/batch, scrapA=10%, 5 outputs/intermediate, scrapB=8%
 *   Effective intermediates = 20 * (1 - 0.10) = 18
 *   Effective outputs = 18 * 5 * (1 - 0.08) = 18 * 4.6 = 82.8
 *   Direct cost per output = 2500 / 82.8 ≈ $30.19
 */
export async function createBatchChainedYieldFixture(
  month = '2024-06'
): Promise<BatchProductFixture> {
  const company = await createCompany({ name: 'Pasta Corp' });
  const line = await createLine(company.id, 'Pasta Line');

  const product = await createCostProduct({
    name: 'Fresh Pasta',
    lineId: line.id,
    companyId: company.id,
    costMethod: 'BATCH',
  });

  const flour = await createInputItem({ name: 'Semolina', companyId: company.id, currentPrice: 150, unitLabel: 'kg' });
  const sugar = await createInputItem({ name: 'Egg Mix', companyId: company.id, currentPrice: 200, unitLabel: 'kg' });

  const recipe = await createRecipe({
    name: 'Pasta Recipe',
    companyId: company.id,
    scopeType: 'PRODUCT',
    scopeId: product.id,
    inputItems: [
      { inputItemId: flour.id, quantity: 10, unitLabel: 'kg' },
      { inputItemId: sugar.id, quantity: 5, unitLabel: 'kg' },
    ],
  });

  await prisma.recipe.update({ where: { id: recipe.id }, data: { isActive: true } });

  // Chained yield: 20 intermediates/batch, 10% scrapA, 5 outputs/intermediate, 8% scrapB
  const yieldConfig = await prisma.yieldConfig.create({
    data: {
      productId: product.id,
      intermediatesPerBatch: 20,
      scrapA: 0.10,
      outputsPerIntermediate: 5,
      scrapB: 0.08,
      usesIntermediate: true,
    },
  });

  const employee = await createCostEmployee({
    name: 'Pasta Chef',
    companyId: company.id,
    grossSalary: 700000,
    payrollTaxes: 175000,
  });

  const indirectItem = await createIndirectItem({
    label: 'Gas',
    code: `GAS-${Date.now()}`,
    companyId: company.id,
    currentPrice: 50000,
  });

  const indirectAllocation = await prisma.globalAllocation.create({
    data: { category: 'INDIRECTOS', lineId: line.id, percent: 0.50 },
  });

  const employeeAllocation = await prisma.globalAllocation.create({
    data: { category: 'EMPLEADOS', lineId: line.id, percent: 0.35 },
  });

  const monthlyProduction = await createMonthlyProduction({
    companyId: company.id,
    productId: product.id,
    month,
    producedQuantity: 500,
  });

  const monthlyIndirect = await prisma.monthlyIndirect.create({
    data: {
      category: 'UTILITIES',
      label: 'Gas',
      amount: 50000,
      month,
      companyId: company.id,
      itemId: indirectItem.id,
    },
  });

  return {
    company, line, product, flour, sugar,
    yeast: flour, // placeholder - not used in chained
    recipe, yieldConfig,
    employee, indirectItem, indirectAllocation, employeeAllocation,
    monthlyProduction, monthlyIndirect,
  };
}

// ============================================================================
// VOLUMETRIC Product
// ============================================================================

/**
 * Creates a volumetric product:
 *   Recipe (PER_M3): 300kg cement ($50/kg) + 700kg sand ($20/kg)
 *   Cost per M3 = 300*50 + 700*20 = 15000 + 14000 = $29,000/m3
 *   m3PerOutput = 0.05 m3 per unit
 *   Direct cost per output = 29,000 * 0.05 = $1,450
 */
export async function createVolumetricProductFixture(
  month = '2024-06'
): Promise<VolumetricProductFixture> {
  const company = await createCompany({ name: 'Concrete Corp' });
  const line = await createLine(company.id, 'Block Line');

  const product = await createCostProduct({
    name: 'Concrete Block',
    lineId: line.id,
    companyId: company.id,
    costMethod: 'VOLUMETRIC',
  });

  const cement = await createInputItem({ name: 'Cement', companyId: company.id, currentPrice: 50, unitLabel: 'kg' });
  const sand = await createInputItem({ name: 'Sand', companyId: company.id, currentPrice: 20, unitLabel: 'kg' });

  const recipe = await createRecipe({
    name: 'Concrete Mix',
    companyId: company.id,
    scopeType: 'PRODUCT',
    scopeId: product.id,
    inputItems: [
      { inputItemId: cement.id, quantity: 300, unitLabel: 'kg' },
      { inputItemId: sand.id, quantity: 700, unitLabel: 'kg' },
    ],
  });

  // Set recipe base to PER_M3 and activate
  await prisma.recipe.update({
    where: { id: recipe.id },
    data: { isActive: true, base: 'PER_M3' },
  });

  const volumetricParam = await prisma.volumetricParam.create({
    data: { productId: product.id, m3PerOutput: 0.05 },
  });

  const employee = await createCostEmployee({
    name: 'Block Maker',
    companyId: company.id,
    grossSalary: 500000,
    payrollTaxes: 125000,
  });

  const indirectAllocation = await prisma.globalAllocation.create({
    data: { category: 'INDIRECTOS', lineId: line.id, percent: 0.30 },
  });

  const employeeAllocation = await prisma.globalAllocation.create({
    data: { category: 'EMPLEADOS', lineId: line.id, percent: 0.25 },
  });

  const monthlyProduction = await createMonthlyProduction({
    companyId: company.id,
    productId: product.id,
    month,
    producedQuantity: 2000,
  });

  const monthlyIndirect = await prisma.monthlyIndirect.create({
    data: {
      category: 'UTILITIES',
      label: 'Water',
      amount: 40000,
      month,
      companyId: company.id,
    },
  });

  return {
    company, line, product, cement, sand, recipe, volumetricParam,
    employee, indirectAllocation, employeeAllocation,
    monthlyProduction, monthlyIndirect,
  };
}

// ============================================================================
// PER_UNIT_BOM Product
// ============================================================================

/**
 * Creates a PER_UNIT_BOM product:
 *   BOM: 2 boards of wood ($500/board) + 20 screws ($10/screw)
 *   Direct cost per output = 2*500 + 20*10 = 1000 + 200 = $1,200
 */
export async function createPerUnitBOMFixture(
  month = '2024-06'
): Promise<PerUnitBOMFixture> {
  const company = await createCompany({ name: 'Furniture Corp' });
  const line = await createLine(company.id, 'Assembly Line');

  const product = await createCostProduct({
    name: 'Wooden Shelf',
    lineId: line.id,
    companyId: company.id,
    costMethod: 'PER_UNIT_BOM',
  });

  const wood = await createInputItem({ name: 'Wood Board', companyId: company.id, currentPrice: 500, unitLabel: 'unit' });
  const screws = await createInputItem({ name: 'Screws', companyId: company.id, currentPrice: 10, unitLabel: 'unit' });

  // Create BOM entries
  const bomWood = await prisma.perUnitBOM.create({
    data: { productId: product.id, inputId: wood.id, qtyPerOut: 2, unitLabel: 'unit' },
  });
  const bomScrews = await prisma.perUnitBOM.create({
    data: { productId: product.id, inputId: screws.id, qtyPerOut: 20, unitLabel: 'unit' },
  });

  const employee = await createCostEmployee({
    name: 'Carpenter',
    companyId: company.id,
    grossSalary: 550000,
    payrollTaxes: 137500,
  });

  const indirectAllocation = await prisma.globalAllocation.create({
    data: { category: 'INDIRECTOS', lineId: line.id, percent: 0.45 },
  });

  const employeeAllocation = await prisma.globalAllocation.create({
    data: { category: 'EMPLEADOS', lineId: line.id, percent: 0.50 },
  });

  const monthlyProduction = await createMonthlyProduction({
    companyId: company.id,
    productId: product.id,
    month,
    producedQuantity: 200,
  });

  const monthlyIndirect = await prisma.monthlyIndirect.create({
    data: {
      category: 'UTILITIES',
      label: 'Power Tools',
      amount: 30000,
      month,
      companyId: company.id,
    },
  });

  return {
    company, line, product, wood, screws,
    perUnitBOM: [bomWood, bomScrews],
    employee, indirectAllocation, employeeAllocation,
    monthlyProduction, monthlyIndirect,
  };
}

// ============================================================================
// Helper: Add Price History
// ============================================================================

export async function addInputPriceHistory(
  inputId: string,
  companyId: number,
  effectiveFrom: Date,
  price: number
) {
  return prisma.inputPriceHistory.create({
    data: { inputId, companyId, effectiveFrom, price },
  });
}

export async function addEmployeeCompHistory(
  employeeId: string,
  companyId: number,
  effectiveFrom: Date,
  grossSalary: number,
  payrollTaxes: number
) {
  return prisma.employeeCompHistory.create({
    data: { employeeId, companyId, effectiveFrom, grossSalary, payrollTaxes },
  });
}
