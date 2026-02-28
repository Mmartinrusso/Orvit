import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { consumeReservationsForDispatch } from '@/lib/almacen/reservation-service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  DespachoStatus,
  DespachoType,
  InventoryItemType,
  StockMovementType,
  MaterialRequestStatus,
} from '@prisma/client';
import { requirePermission } from '@/lib/auth/shared-helpers';

/**
 * GET /api/almacen/despachos
 *
 * Query params:
 * - companyId: number (required)
 * - estado: string (optional)
 * - tipo: string (optional)
 * - warehouseId: number (optional)
 * - materialRequestId: number (optional)
 * - workOrderId: number (optional)
 * - productionOrderId: number (optional)
 * - page: number (optional)
 * - pageSize: number (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Permission check: almacen.dispatch.view
    const { user, error: authError } = await requirePermission('almacen.dispatch.view');
    if (authError) return authError;

    const { searchParams } = new URL(request.url);

    const companyId = Number(searchParams.get('companyId'));
    if (!companyId || isNaN(companyId)) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = { companyId };

    const estado = searchParams.get('estado');
    if (estado) where.estado = estado as DespachoStatus;

    const tipo = searchParams.get('tipo');
    if (tipo) where.tipo = tipo as DespachoType;

    const warehouseId = searchParams.get('warehouseId');
    if (warehouseId) where.warehouseId = Number(warehouseId);

    const materialRequestId = searchParams.get('materialRequestId');
    if (materialRequestId) where.materialRequestId = Number(materialRequestId);

    const workOrderId = searchParams.get('workOrderId');
    if (workOrderId) where.workOrderId = Number(workOrderId);

    const productionOrderId = searchParams.get('productionOrderId');
    if (productionOrderId) where.productionOrderId = Number(productionOrderId);

    const page = Number(searchParams.get('page')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 20;

    const [despachos, total] = await Promise.all([
      prisma.despacho.findMany({
        where,
        include: {
          items: {
            include: {
              supplierItem: {
                select: { id: true, nombre: true, codigoProveedor: true, unidad: true },
              },
              tool: {
                select: { id: true, name: true, code: true },
              },
              stockLocation: {
                select: { id: true, ubicacion: true },
              },
            },
          },
          warehouse: {
            select: { id: true, nombre: true },
          },
          materialRequest: {
            select: { id: true, numero: true },
          },
          workOrder: {
            select: { id: true, title: true },
          },
          productionOrder: {
            select: { id: true, code: true },
          },
          despachador: {
            select: { id: true, name: true },
          },
          receptor: {
            select: { id: true, name: true },
          },
          destinatario: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.despacho.count({ where }),
    ]);

    return NextResponse.json({
      despachos,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error en GET /api/almacen/despachos:', error);
    return NextResponse.json(
      { error: 'Error al obtener despachos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/almacen/despachos
 *
 * Create a new despacho
 *
 * Body:
 * - tipo: DespachoType
 * - warehouseId: number
 * - materialRequestId?: number
 * - workOrderId?: number
 * - productionOrderId?: number
 * - destinatarioId?: number
 * - despachadorId: number
 * - notas?: string
 * - companyId: number
 * - items: Array<{
 *     itemType: InventoryItemType
 *     supplierItemId?: number
 *     toolId?: number
 *     stockLocationId?: number
 *     lote?: string
 *     cantidadSolicitada: number
 *     cantidadDespachada: number
 *     unidad: string
 *     notas?: string
 *   }>
 */
export async function POST(request: NextRequest) {
  try {
    // Permission check: almacen.dispatch.create
    const { user, error } = await requirePermission('almacen.dispatch.create');
    if (error) return error;

    const body = await request.json();
    const {
      tipo,
      warehouseId,
      materialRequestId,
      workOrderId,
      productionOrderId,
      destinatarioId,
      despachadorId,
      notas,
      companyId,
      items,
    } = body;

    if (!tipo || !warehouseId || !despachadorId || !companyId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'tipo, warehouseId, despachadorId, companyId e items son requeridos' },
        { status: 400 }
      );
    }

    // Generate despacho number
    const lastDespacho = await prisma.despacho.findFirst({
      where: { companyId: Number(companyId) },
      orderBy: { id: 'desc' },
      select: { numero: true },
    });

    const nextNumber = lastDespacho
      ? String(Number(lastDespacho.numero.replace(/\D/g, '')) + 1).padStart(6, '0')
      : '000001';
    const numero = `DS-${nextNumber}`;

    // Create despacho with items in transaction
    const despacho = await prisma.$transaction(async (tx) => {
      const newDespacho = await tx.despacho.create({
        data: {
          numero,
          tipo: tipo as DespachoType,
          estado: DespachoStatus.BORRADOR,
          warehouseId: Number(warehouseId),
          materialRequestId: materialRequestId ? Number(materialRequestId) : null,
          workOrderId: workOrderId ? Number(workOrderId) : null,
          productionOrderId: productionOrderId ? Number(productionOrderId) : null,
          destinatarioId: destinatarioId ? Number(destinatarioId) : null,
          despachadorId: Number(despachadorId),
          notas,
          companyId: Number(companyId),
          items: {
            create: items.map((item: any) => ({
              itemType: item.itemType as InventoryItemType,
              supplierItemId: item.supplierItemId ? Number(item.supplierItemId) : null,
              toolId: item.toolId ? Number(item.toolId) : null,
              stockLocationId: item.stockLocationId ? Number(item.stockLocationId) : null,
              lote: item.lote,
              cantidadSolicitada: item.cantidadSolicitada,
              cantidadDespachada: item.cantidadDespachada,
              unidad: item.unidad,
              notas: item.notas,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return newDespacho;
    });

    return NextResponse.json({ despacho });
  } catch (error) {
    console.error('Error en POST /api/almacen/despachos:', error);
    return NextResponse.json(
      { error: 'Error al crear despacho' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/almacen/despachos
 *
 * Update despacho status (prepare, ready, dispatch, receive, cancel)
 *
 * Body:
 * - id: number (required)
 * - action: 'prepare' | 'ready' | 'dispatch' | 'receive' | 'cancel'
 * - userId: number (required for some actions)
 * - firmaUrl?: string (for receive)
 * - firmaHash?: string (for receive)
 * - motivo?: string (for cancel)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, userId, firmaUrl, firmaHash, motivo } = body;

    if (!id || !action) {
      return NextResponse.json(
        { error: 'id y action son requeridos' },
        { status: 400 }
      );
    }

    // Permission check per action
    const actionPermissionMap: Record<string, string> = {
      prepare: 'almacen.dispatch.process',
      ready: 'almacen.dispatch.process',
      dispatch: 'almacen.dispatch.confirm',
      receive: 'almacen.dispatch.receive',
      cancel: 'almacen.dispatch.cancel',
    };
    const requiredPerm = actionPermissionMap[action];
    if (requiredPerm) {
      const { user, error: authError } = await requirePermission(requiredPerm);
      if (authError) return authError;
    }

    const despacho = await prisma.despacho.findUnique({
      where: { id: Number(id) },
      include: {
        items: {
          include: {
            supplierItem: true,
            stockLocation: true,
          },
        },
        materialRequest: {
          include: {
            reservations: {
              where: {
                estado: { in: ['ACTIVA', 'CONSUMIDA_PARCIAL'] },
              },
            },
          },
        },
      },
    });

    if (!despacho) {
      return NextResponse.json(
        { error: 'Despacho no encontrado' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'prepare': {
        if (despacho.estado !== DespachoStatus.BORRADOR) {
          return NextResponse.json(
            { error: 'Solo se pueden preparar despachos en estado BORRADOR' },
            { status: 400 }
          );
        }

        const updated = await prisma.despacho.update({
          where: { id: Number(id) },
          data: { estado: DespachoStatus.EN_PREPARACION },
        });

        return NextResponse.json({ despacho: updated });
      }

      case 'ready': {
        if (despacho.estado !== DespachoStatus.EN_PREPARACION) {
          return NextResponse.json(
            { error: 'Solo se pueden marcar como listos despachos EN_PREPARACION' },
            { status: 400 }
          );
        }

        const updated = await prisma.despacho.update({
          where: { id: Number(id) },
          data: { estado: DespachoStatus.LISTO_DESPACHO },
        });

        return NextResponse.json({ despacho: updated });
      }

      case 'dispatch': {
        if (despacho.estado !== DespachoStatus.LISTO_DESPACHO &&
            despacho.estado !== DespachoStatus.EN_PREPARACION) {
          return NextResponse.json(
            { error: 'Solo se pueden despachar despachos LISTO_DESPACHO o EN_PREPARACION' },
            { status: 400 }
          );
        }

        // Process dispatch in transaction
        await prisma.$transaction(async (tx) => {
          // Create stock movements and update stock for each item
          for (const item of despacho.items) {
            if (item.itemType === 'SUPPLIER_ITEM' && item.supplierItemId) {
              // Get current stock
              const stockLocation = await tx.stockLocation.findUnique({
                where: {
                  warehouseId_supplierItemId: {
                    warehouseId: despacho.warehouseId,
                    supplierItemId: item.supplierItemId,
                  },
                },
              });

              if (!stockLocation) {
                throw new Error(`Stock no encontrado para item ${item.supplierItemId}`);
              }

              const currentQty = Number(stockLocation.cantidad);
              const dispatchQty = Number(item.cantidadDespachada);
              const newQty = currentQty - dispatchQty;

              if (newQty < 0) {
                throw new Error(`Stock insuficiente para item ${item.supplierItemId}`);
              }

              // Create stock movement
              const movement = await tx.stockMovement.create({
                data: {
                  tipo: StockMovementType.DESPACHO,
                  cantidad: new Decimal(-dispatchQty), // Negative for outgoing
                  cantidadAnterior: new Decimal(currentQty),
                  cantidadPosterior: new Decimal(newQty),
                  costoUnitario: stockLocation.costoUnitario,
                  costoTotal: stockLocation.costoUnitario
                    ? new Decimal(Number(stockLocation.costoUnitario) * dispatchQty)
                    : null,
                  supplierItemId: item.supplierItemId,
                  warehouseId: despacho.warehouseId,
                  despachoId: despacho.id,
                  companyId: despacho.companyId,
                  userId: userId ? Number(userId) : despacho.despachadorId,
                },
              });

              // Update stock location
              await tx.stockLocation.update({
                where: { id: stockLocation.id },
                data: { cantidad: new Decimal(newQty) },
              });

              // Update despacho item with movement reference and cost
              await tx.despachoItem.update({
                where: { id: item.id },
                data: {
                  stockMovementId: movement.id,
                  costoUnitario: stockLocation.costoUnitario,
                  costoTotal: stockLocation.costoUnitario
                    ? new Decimal(Number(stockLocation.costoUnitario) * dispatchQty)
                    : null,
                },
              });
            }
          }

          // Consume reservations if from material request
          if (despacho.materialRequestId && despacho.materialRequest?.reservations) {
            const reservationConsumptions = despacho.items
              .filter((item) => item.itemType === 'SUPPLIER_ITEM' && item.supplierItemId)
              .map((item) => {
                // Find matching reservation
                const reservation = despacho.materialRequest?.reservations.find(
                  (r) => r.supplierItemId === item.supplierItemId
                );
                if (reservation) {
                  return {
                    reservationId: reservation.id,
                    cantidad: Number(item.cantidadDespachada),
                  };
                }
                return null;
              })
              .filter(Boolean) as Array<{ reservationId: number; cantidad: number }>;

            if (reservationConsumptions.length > 0) {
              await consumeReservationsForDispatch(
                reservationConsumptions,
                userId || despacho.despachadorId
              );
            }

            // Update material request items
            for (const item of despacho.items) {
              if (item.itemType === 'SUPPLIER_ITEM' && item.supplierItemId) {
                await tx.materialRequestItem.updateMany({
                  where: {
                    requestId: despacho.materialRequestId!,
                    supplierItemId: item.supplierItemId,
                  },
                  data: {
                    cantidadDespachada: {
                      increment: item.cantidadDespachada,
                    },
                  },
                });
              }
            }

            // Check if material request is fully dispatched
            const requestItems = await tx.materialRequestItem.findMany({
              where: { requestId: despacho.materialRequestId! },
            });

            const allDispatched = requestItems.every(
              (item) =>
                Number(item.cantidadDespachada) >= Number(item.cantidadAprobada || item.cantidadSolicitada)
            );

            const someDispatched = requestItems.some(
              (item) => Number(item.cantidadDespachada) > 0
            );

            if (allDispatched) {
              await tx.materialRequest.update({
                where: { id: despacho.materialRequestId! },
                data: { estado: MaterialRequestStatus.DESPACHADA },
              });
            } else if (someDispatched) {
              await tx.materialRequest.update({
                where: { id: despacho.materialRequestId! },
                data: { estado: MaterialRequestStatus.PARCIALMENTE_DESPACHADA },
              });
            }
          }

          // Update despacho
          await tx.despacho.update({
            where: { id: Number(id) },
            data: {
              estado: DespachoStatus.DESPACHADO,
              fechaDespacho: new Date(),
            },
          });
        });

        const updated = await prisma.despacho.findUnique({
          where: { id: Number(id) },
          include: { items: true },
        });

        return NextResponse.json({ despacho: updated });
      }

      case 'receive': {
        if (despacho.estado !== DespachoStatus.DESPACHADO) {
          return NextResponse.json(
            { error: 'Solo se pueden recibir despachos DESPACHADO' },
            { status: 400 }
          );
        }

        // Check if signature is required
        const companySettings = await prisma.companySettings.findUnique({
          where: { companyId: despacho.companyId },
        });

        if (companySettings?.requireDespachoSignature && !firmaUrl) {
          return NextResponse.json(
            { error: 'Se requiere firma digital para confirmar la recepción' },
            { status: 400 }
          );
        }

        const updated = await prisma.despacho.update({
          where: { id: Number(id) },
          data: {
            estado: DespachoStatus.RECIBIDO,
            fechaRecepcion: new Date(),
            receptorId: userId ? Number(userId) : null,
            firmaUrl,
            firmaHash,
            firmadoAt: firmaUrl ? new Date() : null,
          },
        });

        return NextResponse.json({ despacho: updated });
      }

      case 'cancel': {
        if (despacho.estado === DespachoStatus.DESPACHADO ||
            despacho.estado === DespachoStatus.RECIBIDO ||
            despacho.estado === DespachoStatus.CANCELADO) {
          return NextResponse.json(
            { error: 'No se puede cancelar este despacho' },
            { status: 400 }
          );
        }

        const updated = await prisma.despacho.update({
          where: { id: Number(id) },
          data: {
            estado: DespachoStatus.CANCELADO,
            notas: motivo
              ? `${despacho.notas || ''}\n[CANCELADO] ${motivo}`
              : despacho.notas,
          },
        });

        return NextResponse.json({ despacho: updated });
      }

      default:
        return NextResponse.json(
          { error: 'Acción no válida' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error en PATCH /api/almacen/despachos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar despacho' },
      { status: 500 }
    );
  }
}
