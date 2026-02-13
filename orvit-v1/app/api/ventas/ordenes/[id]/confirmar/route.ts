import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { confirmOrderSchema } from '@/lib/ventas/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/ventas/idempotency-helper';
import { validateTransition, SaleStatus } from '@/lib/ventas/state-machine';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Confirmar orden de venta
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_CONFIRM);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key
    const idempotencyKey = getIdempotencyKey(request);

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const validationResult = confirmOrderSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos de solicitud inválidos',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { ignorarAlertasStock, ignorarLimiteCredito } = validationResult.data;

    // Execute with idempotency support
    const idempotencyResult = await withIdempotency(
      idempotencyKey,
      companyId,
      'CONFIRM_SALE',
      async () => {
        // Verificar que existe
        const orden = await prisma.sale.findFirst({
          where: { id, companyId },
          include: {
            items: {
              include: {
                product: {
                  select: { id: true, name: true, currentStock: true, code: true }
                }
              }
            },
            client: {
              select: { id: true, legalName: true, creditLimit: true, currentBalance: true }
            }
          }
        });

        if (!orden) {
          throw new Error('NOT_FOUND');
        }

        // Si ya está confirmada, retornar idempotente (operación ya completada)
        if (orden.estado === 'CONFIRMADA') {
          return {
            message: 'Orden de venta ya estaba confirmada',
            orden,
            alertasStock: undefined,
            alreadyConfirmed: true
          };
        }

        // Validar transición de estado usando state machine
        const transitionValidation = validateTransition({
          documentType: 'sale',
          documentId: orden.id,
          fromState: orden.estado,
          toState: SaleStatus.CONFIRMADA,
          userId: user!.id,
        });

        if (!transitionValidation.valid) {
          throw new Error(`INVALID_TRANSITION:${transitionValidation.error}`);
        }

        // Obtener configuración de ventas
        const salesConfig = await prisma.salesConfig.findUnique({
          where: { companyId }
        });

        // Verificar stock disponible
        const alertasStock: string[] = [];
        for (const item of orden.items) {
          if (item.product?.currentStock !== null && item.product?.currentStock !== undefined) {
            const stockDisponible = Number(item.product.currentStock);
            const cantidadSolicitada = Number(item.cantidad);

            if (cantidadSolicitada > stockDisponible) {
              alertasStock.push(
                `${item.product.name} (${item.product.code}): solicita ${cantidadSolicitada}, disponible ${stockDisponible}`
              );
            }
          }
        }

        // Si hay alertas de stock y la config no permite ventas sin stock, bloquear
        if (alertasStock.length > 0) {
          // Si ignorarAlertasStock=true, el usuario explícitamente autoriza continuar
          if (!ignorarAlertasStock) {
            // Verificar configuración: si permite venta sin stock, solo alertar
            if (!salesConfig?.permitirVentaSinStock) {
              throw new Error(`STOCK_INSUFFICIENT:${JSON.stringify(alertasStock)}`);
            }
            // Si permite, devolver alerta para confirmación del usuario
            throw new Error(`STOCK_ALERT:${JSON.stringify(alertasStock)}`);
          }
        }

        // Verificar límite de crédito del cliente
        if (orden.client.creditLimit) {
          const limiteCredito = Number(orden.client.creditLimit);
          const deudaActual = Number(orden.client.currentBalance || 0);
          const totalOrden = Number(orden.total);

          if (deudaActual + totalOrden > limiteCredito && !ignorarLimiteCredito) {
            throw new Error(`CREDIT_LIMIT:${JSON.stringify({
              limiteCredito,
              deudaActual,
              totalOrden,
              exceso: (deudaActual + totalOrden) - limiteCredito
            })}`);
          }
        }

        // Confirmar orden y decrementar stock en transacción atómica
        const ordenConfirmada = await prisma.$transaction(async (tx) => {
          // Actualizar estado de la orden
          const updated = await tx.sale.update({
            where: { id },
            data: {
              estado: 'CONFIRMADA',
              fechaConfirmacion: new Date(),
            }
          });

          // Decrementar stock físico de productos (si está habilitado en config)
          if (salesConfig?.decrementarStockEnConfirmacion !== false) {
            for (const item of orden.items) {
              if (item.productId && item.product) {
              const cantidadADecrementar = Number(item.cantidad);
              const stockAnterior = Number(item.product.currentStock);
              const stockPosterior = stockAnterior - cantidadADecrementar;

              // Decrementar currentStock del producto
              await tx.product.update({
                where: { id: item.productId },
                data: {
                  currentStock: {
                    decrement: cantidadADecrementar
                  }
                }
              });

              // Registrar movimiento de stock (auditoría/trazabilidad)
              await tx.productStockMovement.create({
                data: {
                  productId: item.productId,
                  companyId,
                  tipo: 'SALIDA',
                  cantidad: cantidadADecrementar,
                  stockAnterior,
                  stockPosterior,
                  sourceType: 'SALE',
                  sourceId: id.toString(),
                  sourceNumber: orden.numero || `VTA-${id}`,
                  motivo: `Venta confirmada - ${item.descripcion}`,
                  createdBy: user!.id,
                }
              });
              }
            }
          }

          return updated;
        });

        // Registrar auditoría
        await logSalesStatusChange({
          entidad: 'sale',
          entidadId: id,
          estadoAnterior: 'BORRADOR',
          estadoNuevo: 'CONFIRMADA',
          companyId,
          userId: user!.id,
        });

        return {
          message: 'Orden de venta confirmada correctamente',
          orden: ordenConfirmada,
          alertasStock: alertasStock.length > 0 ? alertasStock : undefined
        };
      },
      {
        entityType: 'Sale',
        getEntityId: () => id,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: 200,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error confirmando orden de venta:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle custom errors
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Orden de venta no encontrada' }, { status: 404 });
      }
      if (error.message.startsWith('INVALID_STATE:')) {
        const estado = error.message.split(':')[1];
        return NextResponse.json(
          { error: `No se puede confirmar una orden en estado ${estado}` },
          { status: 400 }
        );
      }
      if (error.message.startsWith('STOCK_ALERT:')) {
        const alertasStock = JSON.parse(error.message.split(':').slice(1).join(':'));
        return NextResponse.json({
          error: 'Hay productos con stock insuficiente',
          alertasStock,
          requiereConfirmacion: true,
          tipo: 'ADVERTENCIA' // Puede continuar con confirmación
        }, { status: 400 });
      }
      if (error.message.startsWith('STOCK_INSUFFICIENT:')) {
        const alertasStock = JSON.parse(error.message.split(':').slice(1).join(':'));
        return NextResponse.json({
          error: 'Stock insuficiente. No se permite la venta sin stock según configuración',
          alertasStock,
          requiereConfirmacion: false,
          tipo: 'BLOQUEANTE' // No puede continuar
        }, { status: 400 });
      }
      if (error.message.startsWith('CREDIT_LIMIT:')) {
        const data = JSON.parse(error.message.split(':').slice(1).join(':'));
        return NextResponse.json({
          error: 'El cliente excede su límite de crédito',
          ...data,
          requiereConfirmacion: true
        }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: 'Error al confirmar la orden de venta' },
      { status: 500 }
    );
  }
}
