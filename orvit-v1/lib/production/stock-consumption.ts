import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { StockMovementType } from '@prisma/client';

/**
 * Production Stock Consumption Service
 *
 * Handles automatic stock consumption when production is reported.
 * Links recipe ingredients (InputItem) to inventory items (SupplierItem).
 */

export interface MaterialRequirement {
  inputItemId: string;
  inputItemName: string;
  supplierItemId: number | null;
  supplierItemName: string | null;
  quantityPerUnit: number;
  totalQuantity: number;
  unit: string;
  conversionFactor: number;
  available?: number;
  hasStock: boolean;
}

export interface ConsumptionResult {
  success: boolean;
  movements: Array<{
    id: number;
    supplierItemId: number;
    quantity: number;
    previousQty: number;
    newQty: number;
  }>;
  errors: string[];
  warnings: string[];
}

/**
 * Calculate material requirements for a production order based on its recipe
 */
export async function calculateMaterialRequirements(
  productionOrderId: number,
  quantityToProduce?: number
): Promise<MaterialRequirement[]> {
  const order = await prisma.productionOrder.findUnique({
    where: { id: productionOrderId },
    include: {
      recipe: {
        include: {
          items: {
            include: {
              input: {
                include: {
                  supplierItem: {
                    select: {
                      id: true,
                      nombre: true,
                      unidad: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!order || !order.recipe) {
    return [];
  }

  const quantity = quantityToProduce ?? Number(order.plannedQuantity);
  const requirements: MaterialRequirement[] = [];

  // Calculate based on recipe base
  // Recipe can be PER_BATCH or PER_UNIT
  const recipeBase = order.recipe.base;
  const baseQty = Number(order.recipe.baseQty || 1);

  for (const item of order.recipe.items) {
    const input = item.input;
    const qtyPerRecipeBase = Number(item.quantity);
    const conversionFactor = Number(input.conversionFactor || 1);

    // Calculate total quantity needed
    let totalQuantity: number;
    if (recipeBase === 'PER_UNIT') {
      // Recipe defines qty per unit of output
      totalQuantity = qtyPerRecipeBase * quantity * conversionFactor;
    } else {
      // Recipe defines qty per batch, need to calculate batches
      const batches = quantity / baseQty;
      totalQuantity = qtyPerRecipeBase * batches * conversionFactor;
    }

    requirements.push({
      inputItemId: input.id,
      inputItemName: input.name,
      supplierItemId: input.supplierItemId,
      supplierItemName: input.supplierItem?.nombre || null,
      quantityPerUnit: qtyPerRecipeBase / baseQty,
      totalQuantity,
      unit: input.supplierItem?.unidad || input.unitLabel,
      conversionFactor,
      hasStock: !!input.supplierItemId,
    });
  }

  return requirements;
}

/**
 * Check stock availability for material requirements
 */
export async function checkStockAvailability(
  requirements: MaterialRequirement[],
  warehouseId: number,
  companyId: number
): Promise<MaterialRequirement[]> {
  const supplierItemIds = requirements
    .filter((r) => r.supplierItemId)
    .map((r) => r.supplierItemId as number);

  if (supplierItemIds.length === 0) {
    return requirements;
  }

  // Get current stock for all items
  const stockLocations = await prisma.stockLocation.findMany({
    where: {
      warehouseId,
      supplierItemId: { in: supplierItemIds },
      companyId,
    },
    select: {
      supplierItemId: true,
      cantidad: true,
      cantidadReservada: true,
    },
  });

  const stockMap = new Map<number, number>();
  for (const loc of stockLocations) {
    const available = Number(loc.cantidad) - Number(loc.cantidadReservada || 0);
    stockMap.set(loc.supplierItemId, available);
  }

  return requirements.map((req) => ({
    ...req,
    available: req.supplierItemId ? stockMap.get(req.supplierItemId) || 0 : undefined,
  }));
}

/**
 * Consume stock for a daily production report
 *
 * @param dailyReportId - The daily production report ID
 * @param warehouseId - The warehouse to consume from
 * @param userId - The user performing the consumption
 * @param allowNegative - Whether to allow negative stock (default: false)
 */
export async function consumeStockForProduction(
  dailyReportId: number,
  warehouseId: number,
  userId: number,
  allowNegative: boolean = false
): Promise<ConsumptionResult> {
  const result: ConsumptionResult = {
    success: true,
    movements: [],
    errors: [],
    warnings: [],
  };

  // Get the daily report with production order and recipe
  const dailyReport = await prisma.dailyProductionReport.findUnique({
    where: { id: dailyReportId },
    include: {
      productionOrder: {
        include: {
          recipe: {
            include: {
              items: {
                include: {
                  input: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!dailyReport) {
    result.success = false;
    result.errors.push('Reporte de producción no encontrado');
    return result;
  }

  if (!dailyReport.productionOrder?.recipe) {
    result.warnings.push('La orden de producción no tiene receta asociada');
    return result;
  }

  const companyId = dailyReport.companyId;
  const producedQty = Number(dailyReport.goodQuantity);
  const recipe = dailyReport.productionOrder.recipe;
  const baseQty = Number(recipe.baseQty || 1);

  // Check if consumption was already done for this report
  const existingMovements = await prisma.stockMovement.count({
    where: { dailyProductionReportId: dailyReportId },
  });

  if (existingMovements > 0) {
    result.warnings.push('El consumo de stock ya fue registrado para este reporte');
    return result;
  }

  // Calculate consumption for each recipe item
  const consumptions: Array<{
    inputItem: any;
    supplierItemId: number;
    quantity: number;
  }> = [];

  for (const recipeItem of recipe.items) {
    const input = recipeItem.input;

    if (!input.supplierItemId) {
      result.warnings.push(
        `Insumo "${input.name}" no tiene item de inventario vinculado`
      );
      continue;
    }

    const qtyPerBase = Number(recipeItem.quantity);
    const conversionFactor = Number(input.conversionFactor || 1);

    // Calculate consumption based on recipe base
    let consumption: number;
    if (recipe.base === 'PER_UNIT') {
      consumption = qtyPerBase * producedQty * conversionFactor;
    } else {
      const batches = producedQty / baseQty;
      consumption = qtyPerBase * batches * conversionFactor;
    }

    consumptions.push({
      inputItem: input,
      supplierItemId: input.supplierItemId,
      quantity: consumption,
    });
  }

  if (consumptions.length === 0) {
    result.warnings.push('No hay insumos con items de inventario vinculados');
    return result;
  }

  // Execute consumption in transaction
  try {
    await prisma.$transaction(async (tx) => {
      for (const consumption of consumptions) {
        // Get current stock
        const stockLocation = await tx.stockLocation.findUnique({
          where: {
            warehouseId_supplierItemId: {
              warehouseId,
              supplierItemId: consumption.supplierItemId,
            },
          },
        });

        const currentQty = stockLocation ? Number(stockLocation.cantidad) : 0;
        const newQty = currentQty - consumption.quantity;

        // Check for negative stock
        if (newQty < 0 && !allowNegative) {
          throw new Error(
            `Stock insuficiente para "${consumption.inputItem.name}": ` +
              `disponible ${currentQty.toFixed(2)}, necesario ${consumption.quantity.toFixed(2)}`
          );
        }

        // Update stock location
        if (stockLocation) {
          await tx.stockLocation.update({
            where: { id: stockLocation.id },
            data: { cantidad: new Decimal(Math.max(0, newQty)) },
          });
        } else if (allowNegative) {
          // Create with negative stock if allowed
          await tx.stockLocation.create({
            data: {
              warehouseId,
              supplierItemId: consumption.supplierItemId,
              cantidad: new Decimal(newQty),
              cantidadReservada: new Decimal(0),
              companyId,
            },
          });
        } else {
          throw new Error(
            `No hay stock de "${consumption.inputItem.name}" en el depósito seleccionado`
          );
        }

        // Create stock movement
        const movement = await tx.stockMovement.create({
          data: {
            tipo: StockMovementType.CONSUMO_PRODUCCION,
            cantidad: new Decimal(consumption.quantity),
            cantidadAnterior: new Decimal(currentQty),
            cantidadPosterior: new Decimal(newQty),
            supplierItemId: consumption.supplierItemId,
            warehouseId,
            productionOrderId: dailyReport.productionOrderId,
            dailyProductionReportId: dailyReportId,
            sourceNumber: dailyReport.productionOrder?.code,
            motivo: `Consumo de producción - ${producedQty} ${dailyReport.uom} producidos`,
            companyId,
            createdBy: userId,
          },
        });

        result.movements.push({
          id: movement.id,
          supplierItemId: consumption.supplierItemId,
          quantity: consumption.quantity,
          previousQty: currentQty,
          newQty,
        });
      }
    });
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : 'Error al consumir stock'
    );
  }

  return result;
}

/**
 * Reverse stock consumption for a daily production report
 * Used when a report is deleted or corrected
 */
export async function reverseStockConsumption(
  dailyReportId: number,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get all movements for this report
    const movements = await prisma.stockMovement.findMany({
      where: {
        dailyProductionReportId: dailyReportId,
        tipo: StockMovementType.CONSUMO_PRODUCCION,
      },
    });

    if (movements.length === 0) {
      return { success: true };
    }

    await prisma.$transaction(async (tx) => {
      for (const movement of movements) {
        // Restore stock
        const stockLocation = await tx.stockLocation.findUnique({
          where: {
            warehouseId_supplierItemId: {
              warehouseId: movement.warehouseId,
              supplierItemId: movement.supplierItemId,
            },
          },
        });

        if (stockLocation) {
          const currentQty = Number(stockLocation.cantidad);
          const restoredQty = currentQty + Number(movement.cantidad);

          await tx.stockLocation.update({
            where: { id: stockLocation.id },
            data: { cantidad: new Decimal(restoredQty) },
          });

          // Create reversal movement
          await tx.stockMovement.create({
            data: {
              tipo: StockMovementType.AJUSTE_POSITIVO,
              cantidad: movement.cantidad,
              cantidadAnterior: new Decimal(currentQty),
              cantidadPosterior: new Decimal(restoredQty),
              supplierItemId: movement.supplierItemId,
              warehouseId: movement.warehouseId,
              productionOrderId: movement.productionOrderId,
              motivo: `Reversión de consumo - Reporte #${dailyReportId}`,
              companyId: movement.companyId,
              createdBy: userId,
            },
          });
        }

        // Delete original movement
        await tx.stockMovement.delete({
          where: { id: movement.id },
        });
      }
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al revertir consumo',
    };
  }
}

/**
 * Get consumption summary for a production order
 */
export async function getProductionConsumptionSummary(
  productionOrderId: number
): Promise<{
  totalConsumed: Array<{
    supplierItemId: number;
    supplierItemName: string;
    totalQuantity: number;
    unit: string;
  }>;
  byReport: Array<{
    reportId: number;
    date: Date;
    producedQty: number;
    consumptions: Array<{
      supplierItemId: number;
      quantity: number;
    }>;
  }>;
}> {
  const movements = await prisma.stockMovement.findMany({
    where: {
      productionOrderId,
      tipo: StockMovementType.CONSUMO_PRODUCCION,
    },
    include: {
      supplierItem: {
        select: { id: true, nombre: true, unidad: true },
      },
      dailyReport: {
        select: { id: true, date: true, goodQuantity: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Aggregate by supplier item
  const totalsMap = new Map<
    number,
    { name: string; unit: string; total: number }
  >();

  for (const mov of movements) {
    const existing = totalsMap.get(mov.supplierItemId);
    if (existing) {
      existing.total += Number(mov.cantidad);
    } else {
      totalsMap.set(mov.supplierItemId, {
        name: mov.supplierItem.nombre,
        unit: mov.supplierItem.unidad,
        total: Number(mov.cantidad),
      });
    }
  }

  const totalConsumed = Array.from(totalsMap.entries()).map(([id, data]) => ({
    supplierItemId: id,
    supplierItemName: data.name,
    totalQuantity: data.total,
    unit: data.unit,
  }));

  // Group by report
  const byReportMap = new Map<
    number,
    {
      date: Date;
      producedQty: number;
      consumptions: Array<{ supplierItemId: number; quantity: number }>;
    }
  >();

  for (const mov of movements) {
    if (!mov.dailyReport) continue;

    const reportId = mov.dailyReport.id;
    const existing = byReportMap.get(reportId);

    if (existing) {
      existing.consumptions.push({
        supplierItemId: mov.supplierItemId,
        quantity: Number(mov.cantidad),
      });
    } else {
      byReportMap.set(reportId, {
        date: mov.dailyReport.date,
        producedQty: Number(mov.dailyReport.goodQuantity),
        consumptions: [
          {
            supplierItemId: mov.supplierItemId,
            quantity: Number(mov.cantidad),
          },
        ],
      });
    }
  }

  const byReport = Array.from(byReportMap.entries()).map(([reportId, data]) => ({
    reportId,
    ...data,
  }));

  return { totalConsumed, byReport };
}
