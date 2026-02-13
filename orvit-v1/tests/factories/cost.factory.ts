/**
 * Cost Factory
 *
 * Creates cost-related entities: employees, products, recipes, input items,
 * indirect items, lines, and monthly data.
 */
import { getTestPrisma } from '../setup/db-setup';

const prisma = getTestPrisma();

// ============================================================================
// Counters
// ============================================================================

let lineCounter = 0;
let productCounter = 0;
let inputCounter = 0;

// ============================================================================
// Line
// ============================================================================

export async function createLine(companyId: number, name?: string, code?: string) {
  const n = ++lineCounter;
  return prisma.line.create({
    data: {
      code: code || `LINE-${n}`,
      name: name || `Production Line ${n}`,
      companyId,
    },
  });
}

// ============================================================================
// Cost Product
// ============================================================================

interface CreateCostProductOptions {
  name?: string;
  lineId: string;
  companyId: number;
  measureKind?: 'UNIT' | 'LENGTH' | 'AREA' | 'VOLUME';
  costMethod?: 'BATCH' | 'VOLUMETRIC' | 'PER_UNIT_BOM' | 'REAL' | 'STANDARD';
  active?: boolean;
}

export async function createCostProduct(options: CreateCostProductOptions) {
  const n = ++productCounter;
  return prisma.costProduct.create({
    data: {
      name: options.name || `Product ${n}`,
      lineId: options.lineId,
      companyId: options.companyId,
      measureKind: options.measureKind || 'UNIT',
      costMethod: options.costMethod || 'BATCH',
      unitLabel: 'un',
      active: options.active ?? true,
    },
  });
}

// ============================================================================
// Input Item (Insumo)
// ============================================================================

interface CreateInputItemOptions {
  name?: string;
  companyId: number;
  unitLabel?: string;
  currentPrice?: number;
  supplier?: string;
}

export async function createInputItem(options: CreateInputItemOptions) {
  const n = ++inputCounter;
  return prisma.inputItem.create({
    data: {
      name: options.name || `Input ${n}`,
      companyId: options.companyId,
      unitLabel: options.unitLabel || 'kg',
      currentPrice: options.currentPrice || 100.0,
      supplier: options.supplier || `Supplier ${n}`,
    },
  });
}

// ============================================================================
// Cost Employee
// ============================================================================

interface CreateCostEmployeeOptions {
  name?: string;
  companyId: number;
  role?: string;
  grossSalary?: number;
  payrollTaxes?: number;
  active?: boolean;
}

export async function createCostEmployee(options: CreateCostEmployeeOptions) {
  return prisma.costEmployee.create({
    data: {
      name: options.name || `Employee ${Date.now()}`,
      companyId: options.companyId,
      role: options.role || 'Operator',
      grossSalary: options.grossSalary || 500000,
      payrollTaxes: options.payrollTaxes || 125000,
      active: options.active ?? true,
    },
  });
}

// ============================================================================
// Recipe
// ============================================================================

interface CreateRecipeOptions {
  name?: string;
  companyId: number;
  scopeType?: string;
  scopeId?: string;
  version?: number;
  inputItems?: Array<{
    inputItemId: string;
    quantity: number;
    unitLabel?: string;
  }>;
}

export async function createRecipe(options: CreateRecipeOptions) {
  const n = Date.now();
  const recipe = await prisma.recipe.create({
    data: {
      name: options.name || `Recipe ${n}`,
      companyId: options.companyId,
      scopeType: options.scopeType || 'COMPANY',
      scopeId: options.scopeId || String(options.companyId),
      version: options.version || 1,
    },
  });

  // Create recipe items if provided
  if (options.inputItems && options.inputItems.length > 0) {
    for (const item of options.inputItems) {
      await prisma.recipeItem.create({
        data: {
          recipeId: recipe.id,
          inputId: item.inputItemId,
          quantity: item.quantity,
          unitLabel: item.unitLabel || 'kg',
        },
      });
    }
  }

  return recipe;
}

// ============================================================================
// Indirect Item
// ============================================================================

interface CreateIndirectItemOptions {
  label?: string;
  code?: string;
  companyId: number;
  category?: 'FIXED' | 'VARIABLE' | 'SEMI_VARIABLE';
  currentPrice?: number;
}

export async function createIndirectItem(options: CreateIndirectItemOptions) {
  const n = Date.now();
  return prisma.indirectItem.create({
    data: {
      label: options.label || `Indirect ${n}`,
      code: options.code || `IND-${n}`,
      companyId: options.companyId,
      category: options.category || 'FIXED',
      currentPrice: options.currentPrice || 50000,
    },
  });
}

// ============================================================================
// Monthly Production
// ============================================================================

interface CreateMonthlyProductionOptions {
  companyId: number;
  productId: string;
  month: string; // 'YYYY-MM'
  producedQuantity?: number;
}

export async function createMonthlyProduction(options: CreateMonthlyProductionOptions) {
  return prisma.monthlyProduction.create({
    data: {
      companyId: options.companyId,
      productId: options.productId,
      month: options.month,
      producedQuantity: options.producedQuantity || 1000,
    },
  });
}

// ============================================================================
// Full Cost Setup
// ============================================================================

interface FullCostSetup {
  line: Awaited<ReturnType<typeof createLine>>;
  product: Awaited<ReturnType<typeof createCostProduct>>;
  inputItem1: Awaited<ReturnType<typeof createInputItem>>;
  inputItem2: Awaited<ReturnType<typeof createInputItem>>;
  recipe: Awaited<ReturnType<typeof createRecipe>>;
  employee: Awaited<ReturnType<typeof createCostEmployee>>;
  indirectItem: Awaited<ReturnType<typeof createIndirectItem>>;
}

/**
 * Create a complete cost setup with all related entities
 */
export async function createFullCostSetup(companyId: number): Promise<FullCostSetup> {
  const line = await createLine(companyId, 'Main Line');

  const product = await createCostProduct({
    name: 'Test Product',
    lineId: line.id,
    companyId,
    costMethod: 'BATCH',
  });

  const inputItem1 = await createInputItem({
    name: 'Flour',
    companyId,
    currentPrice: 150.0,
    unitLabel: 'kg',
  });

  const inputItem2 = await createInputItem({
    name: 'Sugar',
    companyId,
    currentPrice: 200.0,
    unitLabel: 'kg',
  });

  const recipe = await createRecipe({
    name: 'Main Recipe',
    companyId,
    inputItems: [
      { inputItemId: inputItem1.id, quantity: 10, unitLabel: 'kg' },
      { inputItemId: inputItem2.id, quantity: 5, unitLabel: 'kg' },
    ],
  });

  const employee = await createCostEmployee({
    name: 'Main Operator',
    companyId,
    grossSalary: 600000,
    payrollTaxes: 150000,
  });

  const indirectItem = await createIndirectItem({
    label: 'Electricity',
    code: `ELEC-${Date.now()}`,
    companyId,
    currentPrice: 80000,
  });

  return { line, product, inputItem1, inputItem2, recipe, employee, indirectItem };
}

/**
 * Reset counters
 */
export function resetCostCounters(): void {
  lineCounter = 0;
  productCounter = 0;
  inputCounter = 0;
}
