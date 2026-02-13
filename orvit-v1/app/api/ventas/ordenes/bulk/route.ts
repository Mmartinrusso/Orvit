import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { logSalesStatusChange, logSalesUpdate } from '@/lib/ventas/audit-helper';
import { validateTransition, SaleStatus } from '@/lib/ventas/state-machine';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

// Validation schemas
const bulkConfirmSchema = z.object({
  operation: z.literal('CONFIRM'),
  saleIds: z.array(z.number()).min(1, 'Debe seleccionar al menos una orden'),
  ignorarAlertasStock: z.boolean().default(false),
  ignorarLimiteCredito: z.boolean().default(false),
});

const bulkCancelSchema = z.object({
  operation: z.literal('CANCEL'),
  saleIds: z.array(z.number()).min(1, 'Debe seleccionar al menos una orden'),
  motivo: z.string().min(1, 'El motivo de cancelación es requerido').max(500),
});

const bulkUpdateStatusSchema = z.object({
  operation: z.literal('UPDATE_STATUS'),
  saleIds: z.array(z.number()).min(1, 'Debe seleccionar al menos una orden'),
  nuevoEstado: z.enum([
    'BORRADOR',
    'CONFIRMADA',
    'EN_PREPARACION',
    'PREPARADA',
    'EN_TRANSITO',
    'ENTREGADA',
    'FACTURADA',
    'CANCELADA'
  ]),
  motivo: z.string().optional(),
});

const bulkUpdateSellerSchema = z.object({
  operation: z.literal('UPDATE_SELLER'),
  saleIds: z.array(z.number()).min(1, 'Debe seleccionar al menos una orden'),
  nuevoVendedorId: z.number().int().positive('ID de vendedor inválido'),
});

const bulkUpdateDeliveryDateSchema = z.object({
  operation: z.literal('UPDATE_DELIVERY_DATE'),
  saleIds: z.array(z.number()).min(1, 'Debe seleccionar al menos una orden'),
  nuevaFecha: z.string().refine(val => !isNaN(Date.parse(val)), 'Fecha inválida'),
});

const bulkUpdateNotesSchema = z.object({
  operation: z.literal('UPDATE_NOTES'),
  saleIds: z.array(z.number()).min(1, 'Debe seleccionar al menos una orden'),
  notas: z.string().max(1000).optional(),
  notasInternas: z.string().max(1000).optional(),
  modo: z.enum(['REPLACE', 'APPEND']).default('REPLACE'),
});

const bulkDeleteSchema = z.object({
  operation: z.literal('DELETE'),
  saleIds: z.array(z.number()).min(1, 'Debe seleccionar al menos una orden'),
  forzar: z.boolean().default(false),
});

const bulkOperationSchema = z.discriminatedUnion('operation', [
  bulkConfirmSchema,
  bulkCancelSchema,
  bulkUpdateStatusSchema,
  bulkUpdateSellerSchema,
  bulkUpdateDeliveryDateSchema,
  bulkUpdateNotesSchema,
  bulkDeleteSchema,
]);

type BulkOperation = z.infer<typeof bulkOperationSchema>;

/**
 * POST - Execute bulk operations on sales orders
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_EDIT);
    if (authError) return authError;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);

    // Parse and validate request
    const body = await request.json();
    const validation = bulkOperationSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { error: 'Datos inválidos', details: errors },
        { status: 400 }
      );
    }

    const operation = validation.data;

    // Verify all sales exist and belong to company
    const sales = await prisma.sale.findMany({
      where: applyViewMode(
        {
          id: { in: operation.saleIds },
          companyId,
        },
        viewMode
      ),
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, stockQuantity: true }
            }
          }
        },
        client: {
          select: {
            id: true,
            legalName: true,
            name: true,
            creditLimit: true,
            currentBalance: true
          }
        }
      }
    });

    if (sales.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron órdenes válidas' },
        { status: 404 }
      );
    }

    if (sales.length !== operation.saleIds.length) {
      return NextResponse.json(
        {
          error: `Solo se encontraron ${sales.length} de ${operation.saleIds.length} órdenes solicitadas`,
          foundIds: sales.map(s => s.id),
          requestedIds: operation.saleIds
        },
        { status: 400 }
      );
    }

    // Execute operation based on type
    let result;
    switch (operation.operation) {
      case 'CONFIRM':
        result = await executeBulkConfirm(sales, operation, companyId, user!.id);
        break;
      case 'CANCEL':
        result = await executeBulkCancel(sales, operation, companyId, user!.id);
        break;
      case 'UPDATE_STATUS':
        result = await executeBulkUpdateStatus(sales, operation, companyId, user!.id);
        break;
      case 'UPDATE_SELLER':
        result = await executeBulkUpdateSeller(sales, operation, companyId, user!.id);
        break;
      case 'UPDATE_DELIVERY_DATE':
        result = await executeBulkUpdateDeliveryDate(sales, operation, companyId, user!.id);
        break;
      case 'UPDATE_NOTES':
        result = await executeBulkUpdateNotes(sales, operation, companyId, user!.id);
        break;
      case 'DELETE':
        result = await executeBulkDelete(sales, operation, companyId, user!.id);
        break;
      default:
        return NextResponse.json(
          { error: 'Operación no soportada' },
          { status: 400 }
        );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error en operación bulk de órdenes:', error);

    if (error instanceof Error) {
      // Handle specific errors
      if (error.message.startsWith('VALIDATION:')) {
        const details = error.message.split(':').slice(1).join(':');
        return NextResponse.json({ error: 'Error de validación', details }, { status: 400 });
      }
      if (error.message.startsWith('BUSINESS_RULE:')) {
        const details = error.message.split(':').slice(1).join(':');
        return NextResponse.json({ error: details }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: 'Error al ejecutar operación bulk' },
      { status: 500 }
    );
  }
}

/**
 * Bulk confirm sales orders
 */
async function executeBulkConfirm(
  sales: any[],
  operation: Extract<BulkOperation, { operation: 'CONFIRM' }>,
  companyId: number,
  userId: number
) {
  const results = {
    success: [] as number[],
    failed: [] as { id: number; error: string }[],
    warnings: [] as { id: number; warnings: string[] }[],
  };

  // Get sales config
  const salesConfig = await prisma.salesConfig.findUnique({
    where: { companyId }
  });

  for (const sale of sales) {
    try {
      // Validate state transition
      const transitionValidation = validateTransition({
        documentType: 'sale',
        documentId: sale.id,
        fromState: sale.estado,
        toState: SaleStatus.CONFIRMADA,
        userId,
      });

      if (!transitionValidation.valid) {
        results.failed.push({
          id: sale.id,
          error: `Transición inválida: ${transitionValidation.error}`
        });
        continue;
      }

      // Check if already confirmed (idempotent)
      if (sale.estado === 'CONFIRMADA') {
        results.success.push(sale.id);
        continue;
      }

      // Check stock
      const stockWarnings: string[] = [];
      for (const item of sale.items) {
        if (item.product?.stockQuantity !== null && item.product?.stockQuantity !== undefined) {
          const stockDisponible = Number(item.product.stockQuantity);
          if (item.cantidad > stockDisponible) {
            stockWarnings.push(
              `${item.product.name}: solicita ${item.cantidad}, disponible ${stockDisponible}`
            );
          }
        }
      }

      if (stockWarnings.length > 0 && !operation.ignorarAlertasStock) {
        results.failed.push({
          id: sale.id,
          error: `Stock insuficiente: ${stockWarnings.join('; ')}`
        });
        continue;
      }

      // Check credit limit
      if (sale.client.creditLimit && !operation.ignorarLimiteCredito) {
        const limiteCredito = Number(sale.client.creditLimit);
        const deudaActual = Number(sale.client.currentBalance || 0);
        const totalOrden = Number(sale.total);

        if (deudaActual + totalOrden > limiteCredito) {
          results.failed.push({
            id: sale.id,
            error: `Límite de crédito excedido: ${limiteCredito}, deuda actual: ${deudaActual}`
          });
          continue;
        }
      }

      // Confirm sale
      await prisma.$transaction(async (tx) => {
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            estado: 'CONFIRMADA',
            fechaConfirmacion: new Date(),
          }
        });

        // Create stock reservations if enabled
        if (salesConfig?.autoReserveStock) {
          for (const item of sale.items) {
            await tx.stockReservation.create({
              data: {
                productId: item.productId,
                saleId: sale.id,
                saleItemId: item.id,
                cantidad: item.cantidad,
                estado: 'RESERVADO',
                companyId,
              }
            });
          }
        }
      });

      // Log audit
      await logSalesStatusChange({
        entidad: 'sale',
        entidadId: sale.id,
        estadoAnterior: sale.estado,
        estadoNuevo: 'CONFIRMADA',
        companyId,
        userId,
      });

      results.success.push(sale.id);

      if (stockWarnings.length > 0) {
        results.warnings.push({ id: sale.id, warnings: stockWarnings });
      }
    } catch (error) {
      results.failed.push({
        id: sale.id,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  return {
    operation: 'CONFIRM',
    totalProcessed: sales.length,
    successCount: results.success.length,
    failedCount: results.failed.length,
    results,
    message: `${results.success.length} de ${sales.length} órdenes confirmadas correctamente`
  };
}

/**
 * Bulk cancel sales orders
 */
async function executeBulkCancel(
  sales: any[],
  operation: Extract<BulkOperation, { operation: 'CANCEL' }>,
  companyId: number,
  userId: number
) {
  const results = {
    success: [] as number[],
    failed: [] as { id: number; error: string }[],
  };

  for (const sale of sales) {
    try {
      // Validate state transition
      const transitionValidation = validateTransition({
        documentType: 'sale',
        documentId: sale.id,
        fromState: sale.estado,
        toState: SaleStatus.CANCELADA,
        userId,
      });

      if (!transitionValidation.valid) {
        results.failed.push({
          id: sale.id,
          error: `No se puede cancelar desde estado ${sale.estado}`
        });
        continue;
      }

      // Cancel sale and release stock reservations
      await prisma.$transaction(async (tx) => {
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            estado: 'CANCELADA',
            notasInternas: sale.notasInternas
              ? `${sale.notasInternas}\n\nCANCELADA: ${operation.motivo}`
              : `CANCELADA: ${operation.motivo}`
          }
        });

        // Release stock reservations
        await tx.stockReservation.updateMany({
          where: { saleId: sale.id, estado: 'RESERVADO' },
          data: { estado: 'CANCELADO' }
        });
      });

      // Log audit
      await logSalesStatusChange({
        entidad: 'sale',
        entidadId: sale.id,
        estadoAnterior: sale.estado,
        estadoNuevo: 'CANCELADA',
        companyId,
        userId,
        motivo: operation.motivo,
      });

      results.success.push(sale.id);
    } catch (error) {
      results.failed.push({
        id: sale.id,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  return {
    operation: 'CANCEL',
    totalProcessed: sales.length,
    successCount: results.success.length,
    failedCount: results.failed.length,
    results,
    message: `${results.success.length} de ${sales.length} órdenes canceladas correctamente`
  };
}

/**
 * Bulk update status
 */
async function executeBulkUpdateStatus(
  sales: any[],
  operation: Extract<BulkOperation, { operation: 'UPDATE_STATUS' }>,
  companyId: number,
  userId: number
) {
  const results = {
    success: [] as number[],
    failed: [] as { id: number; error: string }[],
  };

  for (const sale of sales) {
    try {
      // Validate state transition
      const transitionValidation = validateTransition({
        documentType: 'sale',
        documentId: sale.id,
        fromState: sale.estado,
        toState: operation.nuevoEstado as SaleStatus,
        userId,
      });

      if (!transitionValidation.valid) {
        results.failed.push({
          id: sale.id,
          error: `Transición inválida: ${sale.estado} → ${operation.nuevoEstado}`
        });
        continue;
      }

      await prisma.sale.update({
        where: { id: sale.id },
        data: { estado: operation.nuevoEstado as any }
      });

      // Log audit
      await logSalesStatusChange({
        entidad: 'sale',
        entidadId: sale.id,
        estadoAnterior: sale.estado,
        estadoNuevo: operation.nuevoEstado,
        companyId,
        userId,
        motivo: operation.motivo,
      });

      results.success.push(sale.id);
    } catch (error) {
      results.failed.push({
        id: sale.id,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  return {
    operation: 'UPDATE_STATUS',
    totalProcessed: sales.length,
    successCount: results.success.length,
    failedCount: results.failed.length,
    results,
    message: `${results.success.length} de ${sales.length} órdenes actualizadas correctamente`
  };
}

/**
 * Bulk update seller
 */
async function executeBulkUpdateSeller(
  sales: any[],
  operation: Extract<BulkOperation, { operation: 'UPDATE_SELLER' }>,
  companyId: number,
  userId: number
) {
  // Verify seller exists
  const seller = await prisma.employee.findFirst({
    where: { id: operation.nuevoVendedorId, companyId, active: true }
  });

  if (!seller) {
    throw new Error('VALIDATION:Vendedor no encontrado o inactivo');
  }

  const results = {
    success: [] as number[],
    failed: [] as { id: number; error: string }[],
  };

  for (const sale of sales) {
    try {
      // Only update draft or confirmed sales
      if (!['BORRADOR', 'CONFIRMADA'].includes(sale.estado)) {
        results.failed.push({
          id: sale.id,
          error: `No se puede cambiar vendedor en estado ${sale.estado}`
        });
        continue;
      }

      await prisma.sale.update({
        where: { id: sale.id },
        data: { sellerId: operation.nuevoVendedorId }
      });

      // Log audit
      await logSalesUpdate({
        entidad: 'sale',
        entidadId: sale.id,
        companyId,
        userId,
        changes: { sellerId: operation.nuevoVendedorId },
      });

      results.success.push(sale.id);
    } catch (error) {
      results.failed.push({
        id: sale.id,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  return {
    operation: 'UPDATE_SELLER',
    totalProcessed: sales.length,
    successCount: results.success.length,
    failedCount: results.failed.length,
    results,
    message: `${results.success.length} de ${sales.length} órdenes actualizadas correctamente`
  };
}

/**
 * Bulk update delivery date
 */
async function executeBulkUpdateDeliveryDate(
  sales: any[],
  operation: Extract<BulkOperation, { operation: 'UPDATE_DELIVERY_DATE' }>,
  companyId: number,
  userId: number
) {
  const nuevaFecha = new Date(operation.nuevaFecha);

  const results = {
    success: [] as number[],
    failed: [] as { id: number; error: string }[],
  };

  for (const sale of sales) {
    try {
      // Can't update delivered or invoiced orders
      if (['ENTREGADA', 'FACTURADA'].includes(sale.estado)) {
        results.failed.push({
          id: sale.id,
          error: `No se puede cambiar fecha en estado ${sale.estado}`
        });
        continue;
      }

      await prisma.sale.update({
        where: { id: sale.id },
        data: { fechaEntregaEstimada: nuevaFecha }
      });

      // Log audit
      await logSalesUpdate({
        entidad: 'sale',
        entidadId: sale.id,
        companyId,
        userId,
        changes: { fechaEntregaEstimada: nuevaFecha },
      });

      results.success.push(sale.id);
    } catch (error) {
      results.failed.push({
        id: sale.id,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  return {
    operation: 'UPDATE_DELIVERY_DATE',
    totalProcessed: sales.length,
    successCount: results.success.length,
    failedCount: results.failed.length,
    results,
    message: `${results.success.length} de ${sales.length} órdenes actualizadas correctamente`
  };
}

/**
 * Bulk update notes
 */
async function executeBulkUpdateNotes(
  sales: any[],
  operation: Extract<BulkOperation, { operation: 'UPDATE_NOTES' }>,
  companyId: number,
  userId: number
) {
  const results = {
    success: [] as number[],
    failed: [] as { id: number; error: string }[],
  };

  for (const sale of sales) {
    try {
      const updateData: any = {};

      if (operation.notas !== undefined) {
        updateData.notas = operation.modo === 'APPEND' && sale.notas
          ? `${sale.notas}\n\n${operation.notas}`
          : operation.notas;
      }

      if (operation.notasInternas !== undefined) {
        updateData.notasInternas = operation.modo === 'APPEND' && sale.notasInternas
          ? `${sale.notasInternas}\n\n${operation.notasInternas}`
          : operation.notasInternas;
      }

      await prisma.sale.update({
        where: { id: sale.id },
        data: updateData
      });

      // Log audit
      await logSalesUpdate({
        entidad: 'sale',
        entidadId: sale.id,
        companyId,
        userId,
        changes: updateData,
      });

      results.success.push(sale.id);
    } catch (error) {
      results.failed.push({
        id: sale.id,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  return {
    operation: 'UPDATE_NOTES',
    totalProcessed: sales.length,
    successCount: results.success.length,
    failedCount: results.failed.length,
    results,
    message: `${results.success.length} de ${sales.length} órdenes actualizadas correctamente`
  };
}

/**
 * Bulk delete sales orders
 */
async function executeBulkDelete(
  sales: any[],
  operation: Extract<BulkOperation, { operation: 'DELETE' }>,
  companyId: number,
  userId: number
) {
  const results = {
    success: [] as number[],
    failed: [] as { id: number; error: string }[],
  };

  for (const sale of sales) {
    try {
      // Only allow deleting BORRADOR unless forced
      if (sale.estado !== 'BORRADOR' && !operation.forzar) {
        results.failed.push({
          id: sale.id,
          error: `Solo se pueden eliminar órdenes en BORRADOR (actual: ${sale.estado})`
        });
        continue;
      }

      // Can't delete if invoiced or has related records
      if (sale.estado === 'FACTURADA') {
        results.failed.push({
          id: sale.id,
          error: 'No se puede eliminar una orden facturada'
        });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        // Delete related records
        await tx.saleItem.deleteMany({ where: { saleId: sale.id } });
        await tx.stockReservation.deleteMany({ where: { saleId: sale.id } });
        await tx.sale.delete({ where: { id: sale.id } });
      });

      results.success.push(sale.id);
    } catch (error) {
      results.failed.push({
        id: sale.id,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  return {
    operation: 'DELETE',
    totalProcessed: sales.length,
    successCount: results.success.length,
    failedCount: results.failed.length,
    results,
    message: `${results.success.length} de ${sales.length} órdenes eliminadas correctamente`
  };
}
