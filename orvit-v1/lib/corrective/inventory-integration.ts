/**
 * Integración de Soluciones con Inventario
 *
 * Cuando se cierra una falla con repuestos usados, este módulo:
 * 1. Busca los repuestos en el inventario (Tool)
 * 2. Descuenta el stock automáticamente
 * 3. Crea los movimientos de inventario correspondientes
 * 4. Verifica niveles mínimos y genera alertas si es necesario
 */

import { prisma } from '@/lib/prisma';

export interface SparePartUsed {
  id?: number | string;  // ID del Tool (si existe en inventario)
  toolId?: number;       // ID del Tool (alternativo)
  name: string;
  quantity: number;
  unit?: string;
}

export interface InventoryDeductionResult {
  success: boolean;
  processedParts: {
    toolId: number;
    name: string;
    quantityDeducted: number;
    previousStock: number;
    newStock: number;
    stockAlert?: 'SIN_STOCK' | 'STOCK_MINIMO' | null;
  }[];
  errors: {
    partName: string;
    error: string;
  }[];
  totalDeducted: number;
  totalErrors: number;
}

/**
 * Descuenta automáticamente los repuestos usados del inventario
 *
 * @param sparePartsUsed - Array de repuestos usados (del JSON de la solución)
 * @param workOrderId - ID de la orden de trabajo (para referencia)
 * @param userId - ID del usuario que aplicó la solución
 * @param companyId - ID de la empresa
 * @returns Resultado de la operación con detalle de cada repuesto
 */
export async function deductSparePartsFromInventory(
  sparePartsUsed: SparePartUsed[] | null | undefined,
  workOrderId: number | null,
  userId: number,
  companyId: number
): Promise<InventoryDeductionResult> {
  const result: InventoryDeductionResult = {
    success: true,
    processedParts: [],
    errors: [],
    totalDeducted: 0,
    totalErrors: 0
  };

  // Si no hay repuestos, retornar éxito vacío
  if (!sparePartsUsed || !Array.isArray(sparePartsUsed) || sparePartsUsed.length === 0) {
    return result;
  }

  // Filtrar solo los que tienen ID (están vinculados al inventario)
  const partsWithId = sparePartsUsed.filter(part => {
    const partId = part.id || part.toolId;
    return partId && !isNaN(Number(partId));
  });

  if (partsWithId.length === 0) {
    // No hay repuestos vinculados al inventario
    return result;
  }

  // Obtener IDs únicos
  const toolIds = [...new Set(partsWithId.map(p => Number(p.id || p.toolId)))];

  // Obtener todos los tools en una sola query
  const tools = await prisma.tool.findMany({
    where: {
      id: { in: toolIds },
      companyId: companyId,
      // Solo herramientas/repuestos que tienen stock gestionado
      itemType: { in: ['REPUESTO', 'CONSUMIBLE', 'SPARE_PART', 'CONSUMABLE'] }
    },
    select: {
      id: true,
      name: true,
      stockQuantity: true,
      minStockLevel: true,
      itemType: true
    }
  });

  const toolsMap = new Map(tools.map(t => [t.id, t]));

  // Procesar cada repuesto
  for (const part of partsWithId) {
    const toolId = Number(part.id || part.toolId);
    const quantity = Number(part.quantity) || 1;
    const tool = toolsMap.get(toolId);

    // Si no encontramos el tool, podría ser que no está en inventario o es de otra empresa
    if (!tool) {
      // No es un error crítico, solo significa que no está en el inventario gestionado
      console.log(`ℹ️ Repuesto ${part.name} (ID: ${toolId}) no encontrado en inventario gestionado`);
      continue;
    }

    // Verificar stock disponible
    if (tool.stockQuantity < quantity) {
      result.errors.push({
        partName: tool.name,
        error: `Stock insuficiente. Disponible: ${tool.stockQuantity}, Solicitado: ${quantity}`
      });
      result.totalErrors++;
      continue;
    }

    try {
      // Descontar stock usando una transacción
      const newStock = tool.stockQuantity - quantity;

      await prisma.$transaction([
        // Actualizar stock
        prisma.tool.update({
          where: { id: toolId },
          data: {
            stockQuantity: newStock,
            updatedAt: new Date()
          }
        }),
        // Crear movimiento de stock
        prisma.toolMovement.create({
          data: {
            toolId: toolId,
            type: 'OUT',
            quantity: quantity,
            reason: workOrderId
              ? `Usado en resolución de falla (OT #${workOrderId})`
              : 'Usado en resolución de falla',
            userId: userId,
            description: `Descontado automáticamente al cerrar falla`
          }
        })
      ]);

      // Determinar alerta de stock
      let stockAlert: 'SIN_STOCK' | 'STOCK_MINIMO' | null = null;
      if (newStock === 0) {
        stockAlert = 'SIN_STOCK';
      } else if (newStock <= tool.minStockLevel) {
        stockAlert = 'STOCK_MINIMO';
      }

      result.processedParts.push({
        toolId: toolId,
        name: tool.name,
        quantityDeducted: quantity,
        previousStock: tool.stockQuantity,
        newStock: newStock,
        stockAlert
      });

      result.totalDeducted++;

      console.log(`✅ Stock descontado: ${tool.name} (-${quantity}), nuevo stock: ${newStock}`);

      // Si hay alerta de stock, enviar notificación (fire-and-forget)
      if (stockAlert && typeof fetch !== 'undefined') {
        fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/notifications/stock-check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: companyId,
            toolId: toolId
          })
        }).catch(err => {
          console.error('⚠️ Error enviando notificación de stock:', err);
        });
      }

    } catch (error) {
      console.error(`❌ Error descontando stock de ${tool.name}:`, error);
      result.errors.push({
        partName: tool.name,
        error: (error as Error).message
      });
      result.totalErrors++;
    }
  }

  // Marcar como fallo si hubo errores críticos
  if (result.totalErrors > 0 && result.totalDeducted === 0) {
    result.success = false;
  }

  return result;
}

/**
 * Verifica si hay repuestos vinculados al inventario en la lista
 * Útil para mostrar warning al usuario antes de cerrar
 */
export async function checkSparePartsInventoryStatus(
  sparePartsUsed: SparePartUsed[] | null | undefined,
  companyId: number
): Promise<{
  hasLinkedParts: boolean;
  linkedParts: { id: number; name: string; currentStock: number; requestedQty: number; hasEnoughStock: boolean }[];
  unlinkedParts: { name: string; quantity: number }[];
}> {
  const result = {
    hasLinkedParts: false,
    linkedParts: [] as { id: number; name: string; currentStock: number; requestedQty: number; hasEnoughStock: boolean }[],
    unlinkedParts: [] as { name: string; quantity: number }[]
  };

  if (!sparePartsUsed || !Array.isArray(sparePartsUsed) || sparePartsUsed.length === 0) {
    return result;
  }

  // Separar partes con ID y sin ID
  const partsWithId: SparePartUsed[] = [];
  const partsWithoutId: SparePartUsed[] = [];

  for (const part of sparePartsUsed) {
    const partId = part.id || part.toolId;
    if (partId && !isNaN(Number(partId))) {
      partsWithId.push(part);
    } else {
      partsWithoutId.push(part);
    }
  }

  // Partes sin ID van a unlinkedParts
  result.unlinkedParts = partsWithoutId.map(p => ({
    name: p.name,
    quantity: Number(p.quantity) || 1
  }));

  if (partsWithId.length === 0) {
    return result;
  }

  // Obtener info de inventario
  const toolIds = [...new Set(partsWithId.map(p => Number(p.id || p.toolId)))];

  const tools = await prisma.tool.findMany({
    where: {
      id: { in: toolIds },
      companyId: companyId
    },
    select: {
      id: true,
      name: true,
      stockQuantity: true
    }
  });

  const toolsMap = new Map(tools.map(t => [t.id, t]));

  for (const part of partsWithId) {
    const toolId = Number(part.id || part.toolId);
    const quantity = Number(part.quantity) || 1;
    const tool = toolsMap.get(toolId);

    if (tool) {
      result.hasLinkedParts = true;
      result.linkedParts.push({
        id: toolId,
        name: tool.name,
        currentStock: tool.stockQuantity,
        requestedQty: quantity,
        hasEnoughStock: tool.stockQuantity >= quantity
      });
    } else {
      // El ID existe pero no encontramos el tool (puede ser de otra empresa)
      result.unlinkedParts.push({
        name: part.name,
        quantity: quantity
      });
    }
  }

  return result;
}
