/**
 * Servicio de Cálculo de Costos de Productos
 *
 * Este servicio maneja el cálculo y actualización de costos para productos de venta.
 * Soporta tres tipos de costo:
 * - PRODUCTION: Calcula el costo sumando los insumos de una receta
 * - PURCHASE: Calcula el costo usando promedio ponderado al registrar compras
 * - MANUAL: El costo se ingresa manualmente
 */

import { prisma } from '@/lib/prisma';
import { ProductCostType } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

export interface WeightedAverageCostParams {
  productId: string;
  purchaseQuantity: number;
  purchaseUnitPrice: number;
  sourceDocumentId?: string;
  sourceDocumentType?: string;
  userId?: number;
  notes?: string;
}

export interface RecipeCostParams {
  productId: string;
  recipeId: string;
  userId?: number;
  notes?: string;
}

export interface ManualCostParams {
  productId: string;
  newCost: number;
  userId?: number;
  notes?: string;
}

export interface CostUpdateResult {
  success: boolean;
  previousCost: number | null;
  newCost: number;
  calculationMethod: string;
  logId?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CÁLCULO DE COSTO PROMEDIO PONDERADO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula y actualiza el costo de un producto usando promedio ponderado.
 *
 * Fórmula: (stock_actual × costo_actual + cantidad_compra × precio_compra) / stock_nuevo
 *
 * Se usa cuando se registra una compra para productos tipo PURCHASE.
 */
export async function updateCostByWeightedAverage(
  params: WeightedAverageCostParams
): Promise<CostUpdateResult> {
  const { productId, purchaseQuantity, purchaseUnitPrice, sourceDocumentId, sourceDocumentType, userId, notes } = params;

  try {
    // Obtener producto actual
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        companyId: true,
        costPrice: true,
        currentStock: true,
        costType: true,
        weightedAverageCost: true,
        costCalculationStock: true,
      },
    });

    if (!product) {
      return { success: false, previousCost: null, newCost: 0, calculationMethod: 'WEIGHTED_AVERAGE', error: 'Producto no encontrado' };
    }

    // Usar el costo actual (puede ser costPrice o weightedAverageCost)
    const currentCost = product.weightedAverageCost ?? product.costPrice;
    const currentStock = product.costCalculationStock ?? product.currentStock;

    // Calcular nuevo costo promedio ponderado
    // Si no hay stock previo, el nuevo costo es simplemente el precio de compra
    let newCost: number;
    if (currentStock <= 0 || currentCost === 0) {
      newCost = purchaseUnitPrice;
    } else {
      const totalCurrentValue = currentStock * currentCost;
      const totalPurchaseValue = purchaseQuantity * purchaseUnitPrice;
      const newStock = currentStock + purchaseQuantity;
      newCost = (totalCurrentValue + totalPurchaseValue) / newStock;
    }

    // Redondear a 4 decimales
    newCost = Math.round(newCost * 10000) / 10000;

    const newStock = currentStock + purchaseQuantity;

    // Actualizar producto y crear log en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar producto
      await tx.product.update({
        where: { id: productId },
        data: {
          costPrice: newCost,
          weightedAverageCost: newCost,
          costCalculationStock: newStock,
          lastCostUpdate: new Date(),
        },
      });

      // Crear log de cambio
      const log = await tx.productCostLog.create({
        data: {
          productId,
          companyId: product.companyId,
          previousCost: currentCost,
          newCost,
          previousStock: currentStock,
          newStock,
          changeSource: 'PURCHASE',
          sourceDocumentId,
          sourceDocumentType,
          purchaseQuantity,
          purchaseUnitPrice,
          calculationMethod: 'WEIGHTED_AVERAGE',
          createdById: userId,
          notes,
        },
      });

      return log;
    });

    return {
      success: true,
      previousCost: currentCost,
      newCost,
      calculationMethod: 'WEIGHTED_AVERAGE',
      logId: result.id,
    };
  } catch (error) {
    console.error('[ProductCost] Error en updateCostByWeightedAverage:', error);
    return {
      success: false,
      previousCost: null,
      newCost: 0,
      calculationMethod: 'WEIGHTED_AVERAGE',
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CÁLCULO DE COSTO DESDE RECETA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula el costo de un producto sumando el costo de los insumos de su receta.
 *
 * Se usa para productos tipo PRODUCTION.
 */
export async function updateCostFromRecipe(
  params: RecipeCostParams
): Promise<CostUpdateResult> {
  const { productId, recipeId, userId, notes } = params;

  try {
    // Obtener producto
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        companyId: true,
        costPrice: true,
        costType: true,
      },
    });

    if (!product) {
      return { success: false, previousCost: null, newCost: 0, calculationMethod: 'RECIPE_SUM', error: 'Producto no encontrado' };
    }

    // Obtener receta con sus items
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        items: {
          include: {
            input: true,
          },
        },
      },
    });

    if (!recipe) {
      return { success: false, previousCost: product.costPrice, newCost: 0, calculationMethod: 'RECIPE_SUM', error: 'Receta no encontrada' };
    }

    // Calcular costo total de los insumos
    let totalCost = 0;
    for (const item of recipe.items) {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.input.currentPrice);
      totalCost += quantity * unitPrice;
    }

    // Si la receta produce múltiples unidades, dividir el costo
    const outputQuantity = recipe.outputQuantity ? Number(recipe.outputQuantity) : 1;
    const costPerUnit = outputQuantity > 0 ? totalCost / outputQuantity : totalCost;

    // Redondear a 4 decimales
    const newCost = Math.round(costPerUnit * 10000) / 10000;
    const previousCost = product.costPrice;

    // Actualizar producto y crear log
    const result = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          costPrice: newCost,
          lastCostUpdate: new Date(),
          recipeId,
        },
      });

      const log = await tx.productCostLog.create({
        data: {
          productId,
          companyId: product.companyId,
          previousCost,
          newCost,
          changeSource: 'RECIPE_UPDATE',
          sourceDocumentId: recipeId,
          sourceDocumentType: 'Recipe',
          calculationMethod: 'RECIPE_SUM',
          createdById: userId,
          notes: notes || `Calculado desde receta: ${recipe.name}`,
        },
      });

      return log;
    });

    return {
      success: true,
      previousCost,
      newCost,
      calculationMethod: 'RECIPE_SUM',
      logId: result.id,
    };
  } catch (error) {
    console.error('[ProductCost] Error en updateCostFromRecipe:', error);
    return {
      success: false,
      previousCost: null,
      newCost: 0,
      calculationMethod: 'RECIPE_SUM',
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTUALIZACIÓN MANUAL DE COSTO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Actualiza el costo de un producto manualmente.
 *
 * Se usa para productos tipo MANUAL o cuando se necesita ajustar el costo.
 */
export async function updateCostManually(
  params: ManualCostParams
): Promise<CostUpdateResult> {
  const { productId, newCost, userId, notes } = params;

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        companyId: true,
        costPrice: true,
      },
    });

    if (!product) {
      return { success: false, previousCost: null, newCost: 0, calculationMethod: 'MANUAL', error: 'Producto no encontrado' };
    }

    const previousCost = product.costPrice;

    const result = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          costPrice: newCost,
          lastCostUpdate: new Date(),
        },
      });

      const log = await tx.productCostLog.create({
        data: {
          productId,
          companyId: product.companyId,
          previousCost,
          newCost,
          changeSource: 'MANUAL',
          calculationMethod: 'MANUAL',
          createdById: userId,
          notes,
        },
      });

      return log;
    });

    return {
      success: true,
      previousCost,
      newCost,
      calculationMethod: 'MANUAL',
      logId: result.id,
    };
  } catch (error) {
    console.error('[ProductCost] Error en updateCostManually:', error);
    return {
      success: false,
      previousCost: null,
      newCost: 0,
      calculationMethod: 'MANUAL',
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OBTENER HISTORIAL DE COSTOS
// ═══════════════════════════════════════════════════════════════════════════

export interface CostHistoryFilters {
  productId?: string;
  companyId: number;
  changeSource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export async function getCostHistory(filters: CostHistoryFilters) {
  const { productId, companyId, changeSource, startDate, endDate, limit = 50, offset = 0 } = filters;

  const where: any = { companyId };

  if (productId) where.productId = productId;
  if (changeSource) where.changeSource = changeSource;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.productCostLog.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.productCostLog.count({ where }),
  ]);

  return { logs, total };
}

// ═══════════════════════════════════════════════════════════════════════════
// CAMBIAR TIPO DE COSTO DE PRODUCTO
// ═══════════════════════════════════════════════════════════════════════════

interface ChangeCostTypeParams {
  productId: string;
  newCostType: ProductCostType;
  recipeId?: string;     // Requerido si newCostType es PRODUCTION
  purchaseInputId?: string; // Requerido si newCostType es PURCHASE
  userId?: number;
}

export async function changeCostType(params: ChangeCostTypeParams): Promise<{ success: boolean; error?: string }> {
  const { productId, newCostType, recipeId, purchaseInputId, userId } = params;

  try {
    // Validaciones
    if (newCostType === 'PRODUCTION' && !recipeId) {
      return { success: false, error: 'Debe seleccionar una receta para productos de producción' };
    }

    if (newCostType === 'PURCHASE' && !purchaseInputId) {
      return { success: false, error: 'Debe seleccionar un insumo de compra para productos de reventa' };
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, companyId: true, costPrice: true, costType: true },
    });

    if (!product) {
      return { success: false, error: 'Producto no encontrado' };
    }

    await prisma.$transaction(async (tx) => {
      // Actualizar tipo de costo
      await tx.product.update({
        where: { id: productId },
        data: {
          costType: newCostType,
          recipeId: newCostType === 'PRODUCTION' ? recipeId : null,
          purchaseInputId: newCostType === 'PURCHASE' ? purchaseInputId : null,
          // Resetear campos de cálculo si cambia el tipo
          weightedAverageCost: newCostType === 'PURCHASE' ? product.costPrice : null,
          costCalculationStock: newCostType === 'PURCHASE' ? 0 : null,
          lastCostUpdate: new Date(),
        },
      });

      // Registrar el cambio de tipo
      await tx.productCostLog.create({
        data: {
          productId,
          companyId: product.companyId,
          previousCost: product.costPrice,
          newCost: product.costPrice,
          changeSource: 'MANUAL',
          calculationMethod: 'TYPE_CHANGE',
          createdById: userId,
          notes: `Cambio de tipo de costo: ${product.costType} → ${newCostType}`,
        },
      });
    });

    // Si el nuevo tipo es PRODUCTION, recalcular desde receta
    if (newCostType === 'PRODUCTION' && recipeId) {
      await updateCostFromRecipe({ productId, recipeId, userId, notes: 'Costo inicial desde receta' });
    }

    return { success: true };
  } catch (error) {
    console.error('[ProductCost] Error en changeCostType:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}
