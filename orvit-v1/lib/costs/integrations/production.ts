/**
 * Centro de Costos V2 - Integración con Producción
 *
 * Lee datos de MonthlyProduction y Recipe para calcular
 * el costo de producción basado en consumo de insumos.
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export interface ProductionCostData {
  totalProductionCost: number;
  unitsProduced: number;
  productCount: number;
  inputsConsumed: InputConsumption[];
  byProduct: ProductProductionSummary[];
  details: ProductionDetail[];
}

export interface InputConsumption {
  inputId: string;
  inputName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface ProductProductionSummary {
  productId: string;
  productName: string;
  quantity: number;
  inputCost: number;
  hasRecipe: boolean;
}

export interface ProductionDetail {
  productId: string;
  productName: string;
  producedQuantity: number;
  recipeId: string | null;
  recipeName: string | null;
  inputs: InputConsumption[];
  totalCost: number;
}

/**
 * Obtiene los costos de producción para un mes específico.
 * Calcula el consumo de insumos basado en recetas activas.
 *
 * @param companyId - ID de la empresa
 * @param month - Mes en formato "YYYY-MM" (ej: "2026-01")
 */
export async function getProductionCostsForMonth(
  companyId: number,
  month: string
): Promise<ProductionCostData> {
  // Obtener producción mensual
  const productions = await prisma.monthlyProduction.findMany({
    where: {
      companyId,
      month
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          lineId: true
        }
      }
    }
  });

  // Si no hay producción, retornar valores en cero
  if (productions.length === 0) {
    return {
      totalProductionCost: 0,
      unitsProduced: 0,
      productCount: 0,
      inputsConsumed: [],
      byProduct: [],
      details: []
    };
  }

  let totalProductionCost = 0;
  let totalUnitsProduced = 0;
  const details: ProductionDetail[] = [];
  const byProduct: ProductProductionSummary[] = [];
  const inputConsumptionMap = new Map<string, InputConsumption>();

  for (const production of productions) {
    const productId = production.productId;
    const producedQuantity = toNumber(production.producedQuantity);
    totalUnitsProduced += producedQuantity;

    // Buscar receta activa para este producto
    // La receta puede estar vinculada por scopeType='PRODUCT' y scopeId=productId
    // o por scopeType='LINE' y scopeId=lineId
    const recipe = await prisma.recipe.findFirst({
      where: {
        companyId,
        isActive: true,
        OR: [
          { scopeType: 'PRODUCT', scopeId: productId },
          { scopeType: 'LINE', scopeId: production.product.lineId }
        ]
      },
      include: {
        items: {
          include: {
            input: {
              select: {
                id: true,
                name: true,
                currentPrice: true,
                unitLabel: true
              }
            }
          }
        }
      },
      orderBy: { version: 'desc' }  // Última versión
    });

    const inputsForProduct: InputConsumption[] = [];
    let productCost = 0;

    if (recipe) {
      // Calcular consumo de insumos según receta
      for (const item of recipe.items) {
        const recipeQty = toNumber(item.quantity);
        const unitCost = toNumber(item.input.currentPrice);

        // Consumo = cantidad receta * producción
        // Si la receta es PER_BATCH, ajustar según outputQuantity
        let consumed = recipeQty * producedQuantity;

        // Si la receta tiene outputQuantity, dividir proporcionalmente
        // (receta para X unidades, producimos Y)
        // Por ahora asumimos que la receta es por unidad
        const itemCost = consumed * unitCost;
        productCost += itemCost;

        const inputConsumption: InputConsumption = {
          inputId: item.input.id,
          inputName: item.input.name,
          quantity: consumed,
          unitCost,
          totalCost: itemCost
        };

        inputsForProduct.push(inputConsumption);

        // Acumular en mapa global de consumos
        if (inputConsumptionMap.has(item.input.id)) {
          const existing = inputConsumptionMap.get(item.input.id)!;
          existing.quantity += consumed;
          existing.totalCost += itemCost;
        } else {
          inputConsumptionMap.set(item.input.id, { ...inputConsumption });
        }
      }
    }

    totalProductionCost += productCost;

    byProduct.push({
      productId,
      productName: production.product.name,
      quantity: producedQuantity,
      inputCost: productCost,
      hasRecipe: !!recipe
    });

    details.push({
      productId,
      productName: production.product.name,
      producedQuantity,
      recipeId: recipe?.id || null,
      recipeName: recipe?.name || null,
      inputs: inputsForProduct,
      totalCost: productCost
    });
  }

  // Convertir mapa de consumos a array
  const inputsConsumed = Array.from(inputConsumptionMap.values())
    .sort((a, b) => b.totalCost - a.totalCost);

  return {
    totalProductionCost,
    unitsProduced: totalUnitsProduced,
    productCount: productions.length,
    inputsConsumed,
    byProduct,
    details
  };
}

/**
 * Obtiene la cantidad de registros de producción mensual
 * (para verificación de prerrequisitos)
 */
export async function getProductionCount(companyId: number): Promise<number> {
  return prisma.monthlyProduction.count({
    where: { companyId }
  });
}

/**
 * Obtiene la cantidad de recetas activas
 */
export async function getActiveRecipesCount(companyId: number): Promise<number> {
  return prisma.recipe.count({
    where: {
      companyId,
      isActive: true
    }
  });
}

/**
 * Helper para convertir Decimal de Prisma a number
 */
function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value);
}
