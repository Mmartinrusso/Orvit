import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { loggers } from '@/lib/logger';

// Types for cost calculation
export interface CostCalculationResult {
  directPerOutput: number;
  indirectPerOutput: number;
  employeesPerOutput: number;
  totalPerOutput: number;
}

export interface RecipeCost {
  costPerBatch?: number;
  costPerM3?: number;
}

export interface ProductionData {
  productId: string;
  producedQuantity: number;
}

export interface LineProductionData {
  lineId: string;
  totalProduction: number;
  products: ProductionData[];
}

/**
 * Get effective compensation for an employee at a specific month
 */
export async function getEffectiveEmployeeComp(employeeId: string, month: string): Promise<{ grossSalary: number; payrollTaxes: number }> {
  const [year, monthNum] = month.split('-');
  const endOfMonth = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59, 999);

  const compHistory = await prisma.employeeCompHistory.findFirst({
    where: {
      employeeId,
      effectiveFrom: { lte: endOfMonth },
    },
    orderBy: { effectiveFrom: 'desc' },
    select: { grossSalary: true, payrollTaxes: true },
  });

  if (compHistory) {
    return {
      grossSalary: compHistory.grossSalary.toNumber(),
      payrollTaxes: compHistory.payrollTaxes.toNumber(),
    };
  }

  const employee = await prisma.costEmployee.findUnique({
    where: { id: employeeId },
    select: { grossSalary: true, payrollTaxes: true },
  });

  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`);
  }

  return {
    grossSalary: employee.grossSalary.toNumber(),
    payrollTaxes: employee.payrollTaxes.toNumber(),
  };
}

/**
 * Batch get effective compensation for multiple employees at a specific month.
 * Avoids N+1 by fetching all history records in a single query.
 */
export async function getEffectiveEmployeeCompBatch(
  employees: { id: string; grossSalary: Decimal; payrollTaxes: Decimal }[],
  month: string
): Promise<Map<string, { grossSalary: number; payrollTaxes: number }>> {
  const [year, monthNum] = month.split('-');
  const endOfMonth = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59, 999);
  const employeeIds = employees.map(e => e.id);

  // Single query: get the latest comp history for all employees at once
  const allHistory = await prisma.employeeCompHistory.findMany({
    where: {
      employeeId: { in: employeeIds },
      effectiveFrom: { lte: endOfMonth },
    },
    orderBy: { effectiveFrom: 'desc' },
    select: { employeeId: true, grossSalary: true, payrollTaxes: true, effectiveFrom: true },
  });

  // Keep only the most recent record per employee
  const latestByEmployee = new Map<string, { grossSalary: number; payrollTaxes: number }>();
  for (const record of allHistory) {
    if (!latestByEmployee.has(record.employeeId)) {
      latestByEmployee.set(record.employeeId, {
        grossSalary: record.grossSalary.toNumber(),
        payrollTaxes: record.payrollTaxes.toNumber(),
      });
    }
  }

  // For employees without history, use their current compensation
  const result = new Map<string, { grossSalary: number; payrollTaxes: number }>();
  for (const emp of employees) {
    const fromHistory = latestByEmployee.get(emp.id);
    result.set(emp.id, fromHistory ?? {
      grossSalary: emp.grossSalary.toNumber(),
      payrollTaxes: emp.payrollTaxes.toNumber(),
    });
  }

  return result;
}

/**
 * Get effective price for an input item at a specific month
 */
export async function getEffectiveInputPrice(inputId: string, month: string): Promise<number> {
  // Convert month to end of month date for comparison
  const [year, monthNum] = month.split('-');
  const endOfMonth = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59, 999);

  // Get the most recent price history record that's effective by the end of the month
  const priceHistory = await prisma.inputPriceHistory.findFirst({
    where: {
      inputId,
      effectiveFrom: { lte: endOfMonth },
    },
    orderBy: { effectiveFrom: 'desc' },
    select: { price: true },
  });

  if (priceHistory) {
    return priceHistory.price.toNumber();
  }

  // Fallback to current price if no history found
  const input = await prisma.inputItem.findUnique({
    where: { id: inputId },
    select: { currentPrice: true },
  });

  if (!input) {
    throw new Error(`Input item not found: ${inputId}`);
  }

  return input.currentPrice.toNumber();
}

/**
 * Calculate recipe cost based on input items and their prices effective for a specific month
 */
export async function calculateRecipeCost(recipeId: string, month?: string): Promise<RecipeCost> {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      base: true,
      items: {
        select: {
          inputId: true,
          quantity: true,
          input: {
            select: { currentPrice: true },
          },
        },
      },
    },
  });

  if (!recipe) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }

  let totalCost = 0;

  // Pre-load all input prices in a single query to avoid N+1
  let priceMap: Map<string, number> | null = null;
  if (month) {
    const [year, monthNum] = month.split('-');
    const endOfMonth = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59, 999);
    const inputIds = recipe.items.map(i => i.inputId);

    const allPrices = await prisma.inputPriceHistory.findMany({
      where: {
        inputId: { in: inputIds },
        effectiveFrom: { lte: endOfMonth },
      },
      orderBy: { effectiveFrom: 'desc' },
      select: { inputId: true, price: true },
    });

    priceMap = new Map<string, number>();
    for (const p of allPrices) {
      if (!priceMap.has(p.inputId)) {
        priceMap.set(p.inputId, p.price.toNumber());
      }
    }
  }

  for (const item of recipe.items) {
    const unitPrice = priceMap?.get(item.inputId) ?? item.input.currentPrice.toNumber();
    const itemCost = item.quantity.toNumber() * unitPrice;
    totalCost += itemCost;
  }

  const result: RecipeCost = {};

  if (recipe.base === 'PER_BATCH') {
    result.costPerBatch = totalCost;
  } else {
    result.costPerM3 = totalCost;
  }

  return result;
}

/**
 * Calculate direct cost per output for a product based on its cost method
 */
export async function calculateDirectCostPerOutput(
  productId: string,
  month: string
): Promise<number> {
  const product = await prisma.costProduct.findUnique({
    where: { id: productId },
    select: {
      id: true,
      costMethod: true,
      lineId: true,
      yieldConfig: true,
      volumetricParam: { select: { m3PerOutput: true } },
      perUnitBOM: {
        select: {
          qtyPerOut: true,
          input: { select: { currentPrice: true } },
        },
      },
    },
  });

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  switch (product.costMethod) {
    case 'BATCH':
      return calculateBatchDirectCost(product, month);
    case 'VOLUMETRIC':
      return calculateVolumetricDirectCost(product, month);
    case 'PER_UNIT_BOM':
      return calculatePerUnitBOMDirectCost(product);
    default:
      throw new Error(`Unknown cost method: ${product.costMethod}`);
  }
}

/**
 * Calculate direct cost for BATCH method
 */
async function calculateBatchDirectCost(product: any, month: string): Promise<number> {
  if (!product.yieldConfig) {
    throw new Error(`Yield config not found for product: ${product.id}`);
  }

  // Get active recipe for this product
  const activeRecipe = await prisma.recipe.findFirst({
    where: {
      scopeType: 'PRODUCT',
      scopeId: product.id,
      isActive: true,
    },
  });

  if (!activeRecipe) {
    // Try to find line-level recipe
    const lineRecipe = await prisma.recipe.findFirst({
      where: {
        scopeType: 'LINE',
        scopeId: product.lineId,
        isActive: true,
      },
    });

    if (!lineRecipe) {
      throw new Error(`No active recipe found for product: ${product.id}`);
    }
    
    return calculateBatchCostFromRecipe(lineRecipe, product.yieldConfig, month);
  }

  return calculateBatchCostFromRecipe(activeRecipe, product.yieldConfig, month);
}

/**
 * Calculate batch cost from recipe and yield config
 */
async function calculateBatchCostFromRecipe(recipe: any, yieldConfig: any, month?: string): Promise<number> {
  const recipeCost = await calculateRecipeCost(recipe.id, month);
  
  let costPerBatch = 0;
  
  if (recipe.base === 'PER_BATCH') {
    costPerBatch = recipeCost.costPerBatch || 0;
  } else {
    // PER_M3 recipe, need to convert to batch
    if (!yieldConfig.m3PerBatch) {
      throw new Error('m3PerBatch required for PER_M3 recipe');
    }
    costPerBatch = (recipeCost.costPerM3 || 0) * yieldConfig.m3PerBatch.toNumber();
  }

  // Calculate outputs per batch considering yields and scraps
  let outputsPerBatch = 0;

  if (yieldConfig.intermediatesPerBatch && yieldConfig.outputsPerIntermediate) {
    // Encadenado (Batch→Intermedio→Salida)
    const intermediatesStd = yieldConfig.intermediatesPerBatch.toNumber() * 
      (1 - (yieldConfig.scrapA?.toNumber() || 0));
    const outputsStd = intermediatesStd * yieldConfig.outputsPerIntermediate.toNumber() * 
      (1 - (yieldConfig.scrapB?.toNumber() || 0));
    outputsPerBatch = outputsStd;
  } else if (yieldConfig.outputsPerBatch) {
    // Directo (Batch→Salida)
    const outputsStd = yieldConfig.outputsPerBatch.toNumber() * 
      (1 - (yieldConfig.scrapGlobal?.toNumber() || 0));
    outputsPerBatch = outputsStd;
  } else {
    throw new Error('Invalid yield configuration');
  }

  if (outputsPerBatch <= 0) {
    throw new Error('Invalid outputs per batch calculation');
  }

  return costPerBatch / outputsPerBatch;
}

/**
 * Calculate direct cost for VOLUMETRIC method
 */
async function calculateVolumetricDirectCost(product: any, month: string): Promise<number> {
  if (!product.volumetricParam) {
    throw new Error(`Volumetric param not found for product: ${product.id}`);
  }

  // Get active recipe (should be PER_M3)
  const activeRecipe = await prisma.recipe.findFirst({
    where: {
      OR: [
        { scopeType: 'PRODUCT', scopeId: product.id, isActive: true },
        { scopeType: 'LINE', scopeId: product.lineId, isActive: true },
      ],
    },
  });

  if (!activeRecipe) {
    throw new Error(`No active recipe found for product: ${product.id}`);
  }

  const recipeCost = await calculateRecipeCost(activeRecipe.id);
  const costPerM3 = recipeCost.costPerM3 || recipeCost.costPerBatch || 0;
  
  return costPerM3 * product.volumetricParam.m3PerOutput.toNumber();
}

/**
 * Calculate direct cost for PER_UNIT_BOM method
 */
async function calculatePerUnitBOMDirectCost(product: any): Promise<number> {
  if (!product.perUnitBOM || product.perUnitBOM.length === 0) {
    throw new Error(`Per unit BOM not found for product: ${product.id}`);
  }

  let totalCost = 0;

  for (const bomItem of product.perUnitBOM) {
    const itemCost = bomItem.qtyPerOut.toNumber() * bomItem.input.currentPrice.toNumber();
    totalCost += itemCost;
  }

  return totalCost;
}

/**
 * Get production data by line for a given month
 */
export async function getProductionByLine(month: string): Promise<LineProductionData[]> {
  const productions = await prisma.monthlyProduction.findMany({
    where: { month },
    select: {
      productId: true,
      producedQuantity: true,
      product: {
        select: { lineId: true },
      },
    },
  });

  const lineMap = new Map<string, LineProductionData>();

  for (const prod of productions) {
    const lineId = prod.product.lineId;
    
    if (!lineMap.has(lineId)) {
      lineMap.set(lineId, {
        lineId,
        totalProduction: 0,
        products: [],
      });
    }

    const lineData = lineMap.get(lineId)!;
    const quantity = prod.producedQuantity.toNumber();
    
    lineData.totalProduction += quantity;
    lineData.products.push({
      productId: prod.productId,
      producedQuantity: quantity,
    });
  }

  return Array.from(lineMap.values());
}

/**
 * Calculate indirect cost per output for a line
 */
export async function calculateIndirectCostPerOutput(
  lineId: string,
  month: string
): Promise<number> {
  // Get total indirect costs for the month
  const indirectCosts = await prisma.monthlyIndirect.findMany({
    where: { month },
    select: { amount: true },
  });

  const totalIndirectCosts = indirectCosts.reduce(
    (sum, cost) => sum + cost.amount.toNumber(),
    0
  );

  // Get allocation percentage for this line
  const allocation = await prisma.globalAllocation.findUnique({
    where: {
      category_lineId: {
        category: 'INDIRECTOS',
        lineId,
      },
    },
  });

  if (!allocation) {
    throw new Error(`Indirect allocation not found for line: ${lineId}`);
  }

  const lineIndirectCosts = totalIndirectCosts * allocation.percent.toNumber();

  // Get total production for this line
  const lineProduction = await getProductionByLine(month);
  const thisLineProduction = lineProduction.find(lp => lp.lineId === lineId);

  if (!thisLineProduction || thisLineProduction.totalProduction === 0) {
    return 0;
  }

  return lineIndirectCosts / thisLineProduction.totalProduction;
}

/**
 * Calculate employee cost per output for a line
 */
export async function calculateEmployeeCostPerOutput(
  lineId: string,
  month: string
): Promise<number> {
  // Get all active employees with needed fields
  const employees = await prisma.costEmployee.findMany({
    where: { active: true },
    select: { id: true, grossSalary: true, payrollTaxes: true },
  });

  // Batch fetch effective compensation for all employees (1 query instead of N)
  const compMap = await getEffectiveEmployeeCompBatch(employees, month);

  let totalEmployeeCosts = 0;
  for (const emp of employees) {
    const comp = compMap.get(emp.id);
    if (comp) {
      totalEmployeeCosts += comp.grossSalary + comp.payrollTaxes;
    } else {
      totalEmployeeCosts += emp.grossSalary.toNumber() + emp.payrollTaxes.toNumber();
    }
  }

  // Get allocation percentage for this line
  const allocation = await prisma.globalAllocation.findUnique({
    where: {
      category_lineId: {
        category: 'EMPLEADOS',
        lineId,
      },
    },
  });

  if (!allocation) {
    throw new Error(`Employee allocation not found for line: ${lineId}`);
  }

  const lineEmployeeCosts = totalEmployeeCosts * allocation.percent.toNumber();

  // Get total production for this line
  const lineProduction = await getProductionByLine(month);
  const thisLineProduction = lineProduction.find(lp => lp.lineId === lineId);

  if (!thisLineProduction || thisLineProduction.totalProduction === 0) {
    return 0;
  }

  return lineEmployeeCosts / thisLineProduction.totalProduction;
}

/**
 * Calculate complete cost breakdown for a product in a given month
 */
export async function calculateProductCost(
  productId: string,
  month: string
): Promise<CostCalculationResult> {
  const product = await prisma.costProduct.findUnique({
    where: { id: productId },
    select: { id: true, lineId: true },
  });

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const [directPerOutput, indirectPerOutput, employeesPerOutput] = await Promise.all([
    calculateDirectCostPerOutput(productId, month),
    calculateIndirectCostPerOutput(product.lineId, month),
    calculateEmployeeCostPerOutput(product.lineId, month),
  ]);
  const totalPerOutput = directPerOutput + indirectPerOutput + employeesPerOutput;

  return {
    directPerOutput,
    indirectPerOutput,
    employeesPerOutput,
    totalPerOutput,
  };
}

/**
 * Recalculate costs for all products in a given month
 */
export async function recalculateMonthCosts(month: string, companyId?: number): Promise<void> {
  const whereClause: any = { active: true };
  if (companyId) {
    whereClause.companyId = companyId;
  }

  const products = await prisma.costProduct.findMany({
    where: whereClause,
    select: { id: true, lineId: true, companyId: true, costMethod: true },
  });

  // Calculate all product costs and collect upsert operations
  const upsertOps: any[] = [];
  for (const product of products) {
    try {
      const costResult = await calculateProductCost(product.id, month);

      upsertOps.push(
        prisma.productCostHistory.upsert({
          where: {
            productId_month: {
              productId: product.id,
              month,
            },
          },
          update: {
            directPerOutput: new Decimal(costResult.directPerOutput),
            indirectPerOutput: new Decimal(costResult.indirectPerOutput),
            employeesPerOutput: new Decimal(costResult.employeesPerOutput),
            totalPerOutput: new Decimal(costResult.totalPerOutput),
            manualOverride: false,
          },
          create: {
            companyId: product.companyId,
            productId: product.id,
            month,
            directPerOutput: new Decimal(costResult.directPerOutput),
            indirectPerOutput: new Decimal(costResult.indirectPerOutput),
            employeesPerOutput: new Decimal(costResult.employeesPerOutput),
            totalPerOutput: new Decimal(costResult.totalPerOutput),
            manualOverride: false,
          },
        })
      );
    } catch (error) {
      loggers.costs.error({ productId: product.id, err: error }, 'Error calculating product cost');
    }
  }

  // Batch upsert in a single transaction instead of individual queries
  if (upsertOps.length > 0) {
    await prisma.$transaction(upsertOps);
  }
}


