import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createBulkReservations, releaseReservationsForMaterialRequest } from '@/lib/almacen/reservation-service';
import {
  MaterialRequestStatus,
  MaterialRequestType,
  StockReservationType,
  Priority,
  InventoryItemType,
} from '@prisma/client';
import { requirePermission, checkPermission } from '@/lib/auth/shared-helpers';

/**
 * GET /api/almacen/requests
 *
 * Query params:
 * - companyId: number (required)
 * - estado: string (optional)
 * - tipo: string (optional)
 * - workOrderId: number (optional)
 * - productionOrderId: number (optional)
 * - solicitanteId: number (optional)
 * - page: number (optional)
 * - pageSize: number (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Permission check: almacen.request.view
    const { user, error: authError } = await requirePermission('almacen.request.view');
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

    // If user does NOT have almacen.request.view_all, filter to only their own requests
    const canViewAll = await checkPermission(user!.id, user!.companyId, 'almacen.request.view_all');
    if (!canViewAll) {
      where.solicitanteId = user!.id;
    }

    const estado = searchParams.get('estado');
    if (estado) where.estado = estado as MaterialRequestStatus;

    const tipo = searchParams.get('tipo');
    if (tipo) where.tipo = tipo as MaterialRequestType;

    const workOrderId = searchParams.get('workOrderId');
    if (workOrderId) where.workOrderId = Number(workOrderId);

    const productionOrderId = searchParams.get('productionOrderId');
    if (productionOrderId) where.productionOrderId = Number(productionOrderId);

    // Only allow solicitanteId filter override if user has view_all permission
    const solicitanteId = searchParams.get('solicitanteId');
    if (solicitanteId && canViewAll) where.solicitanteId = Number(solicitanteId);

    const page = Number(searchParams.get('page')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 20;

    const [requests, total] = await Promise.all([
      prisma.materialRequest.findMany({
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
            },
          },
          solicitante: {
            select: { id: true, name: true },
          },
          destinatario: {
            select: { id: true, name: true },
          },
          aprobadoByUser: {
            select: { id: true, name: true },
          },
          warehouse: {
            select: { id: true, nombre: true },
          },
          workOrder: {
            select: { id: true, title: true },
          },
          productionOrder: {
            select: { id: true, code: true },
          },
          _count: {
            select: { reservations: true, despachos: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.materialRequest.count({ where }),
    ]);

    return NextResponse.json({
      requests,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error en GET /api/almacen/requests:', error);
    return NextResponse.json(
      { error: 'Error al obtener solicitudes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/almacen/requests
 *
 * Create a new material request
 *
 * Body:
 * - tipo: MaterialRequestType
 * - urgencia?: Priority
 * - workOrderId?: number
 * - productionOrderId?: number
 * - proyectoId?: number
 * - solicitanteId: number
 * - destinatarioId?: number
 * - warehouseId?: number
 * - fechaNecesidad?: string (ISO date)
 * - motivo?: string
 * - notas?: string
 * - companyId: number
 * - items: Array<{
 *     itemType: InventoryItemType
 *     supplierItemId?: number
 *     toolId?: number
 *     cantidadSolicitada: number
 *     unidad: string
 *     notas?: string
 *   }>
 */
export async function POST(request: NextRequest) {
  try {
    // Permission check: almacen.request.create
    const { user, error } = await requirePermission('almacen.request.create');
    if (error) return error;

    const body = await request.json();
    const {
      tipo,
      urgencia = 'MEDIUM',
      workOrderId,
      productionOrderId,
      proyectoId,
      solicitanteId,
      destinatarioId,
      warehouseId,
      fechaNecesidad,
      motivo,
      notas,
      companyId,
      items,
    } = body;

    if (!tipo || !solicitanteId || !companyId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'tipo, solicitanteId, companyId e items son requeridos' },
        { status: 400 }
      );
    }

    // Generate request number
    const lastRequest = await prisma.materialRequest.findFirst({
      where: { companyId: Number(companyId) },
      orderBy: { id: 'desc' },
      select: { numero: true },
    });

    const nextNumber = lastRequest
      ? String(Number(lastRequest.numero.replace(/\D/g, '')) + 1).padStart(6, '0')
      : '000001';
    const numero = `SM-${nextNumber}`;

    // Create request with items in transaction
    const materialRequest = await prisma.$transaction(async (tx) => {
      const request = await tx.materialRequest.create({
        data: {
          numero,
          tipo: tipo as MaterialRequestType,
          estado: MaterialRequestStatus.BORRADOR,
          urgencia: urgencia as Priority,
          workOrderId: workOrderId ? Number(workOrderId) : null,
          productionOrderId: productionOrderId ? Number(productionOrderId) : null,
          proyectoId: proyectoId ? Number(proyectoId) : null,
          solicitanteId: Number(solicitanteId),
          destinatarioId: destinatarioId ? Number(destinatarioId) : null,
          warehouseId: warehouseId ? Number(warehouseId) : null,
          fechaNecesidad: fechaNecesidad ? new Date(fechaNecesidad) : null,
          motivo,
          notas,
          companyId: Number(companyId),
          items: {
            create: items.map((item: any) => ({
              itemType: item.itemType as InventoryItemType,
              supplierItemId: item.supplierItemId ? Number(item.supplierItemId) : null,
              toolId: item.toolId ? Number(item.toolId) : null,
              cantidadSolicitada: item.cantidadSolicitada,
              unidad: item.unidad,
              notas: item.notas,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return request;
    });

    return NextResponse.json({ request: materialRequest });
  } catch (error) {
    console.error('Error en POST /api/almacen/requests:', error);
    return NextResponse.json(
      { error: 'Error al crear solicitud' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/almacen/requests
 *
 * Update request status (submit, approve, reject, cancel)
 *
 * Body:
 * - id: number (required)
 * - action: 'submit' | 'approve' | 'reject' | 'cancel'
 * - userId: number (required for approve/reject)
 * - motivo?: string (for reject/cancel)
 * - cantidadesAprobadas?: Record<itemId, cantidad> (for partial approval)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, userId, motivo, cantidadesAprobadas } = body;

    if (!id || !action) {
      return NextResponse.json(
        { error: 'id y action son requeridos' },
        { status: 400 }
      );
    }

    // Permission check per action
    const actionPermissionMap: Record<string, string> = {
      submit: 'almacen.request.edit',
      approve: 'almacen.request.approve',
      reject: 'almacen.request.reject',
      cancel: 'almacen.request.cancel',
    };
    const requiredPerm = actionPermissionMap[action];
    if (requiredPerm) {
      const { user, error: authError } = await requirePermission(requiredPerm);
      if (authError) return authError;
    }

    const materialRequest = await prisma.materialRequest.findUnique({
      where: { id: Number(id) },
      include: {
        items: {
          include: {
            supplierItem: true,
          },
        },
      },
    });

    if (!materialRequest) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'submit': {
        if (materialRequest.estado !== MaterialRequestStatus.BORRADOR) {
          return NextResponse.json(
            { error: 'Solo se pueden enviar solicitudes en estado BORRADOR' },
            { status: 400 }
          );
        }

        const updated = await prisma.materialRequest.update({
          where: { id: Number(id) },
          data: { estado: MaterialRequestStatus.PENDIENTE_APROBACION },
        });

        return NextResponse.json({ request: updated });
      }

      case 'approve': {
        if (!userId) {
          return NextResponse.json(
            { error: 'userId es requerido para aprobar' },
            { status: 400 }
          );
        }

        if (materialRequest.estado !== MaterialRequestStatus.PENDIENTE_APROBACION) {
          return NextResponse.json(
            { error: 'Solo se pueden aprobar solicitudes PENDIENTE_APROBACION' },
            { status: 400 }
          );
        }

        // Update approved quantities if provided
        if (cantidadesAprobadas) {
          await Promise.all(
            Object.entries(cantidadesAprobadas).map(([itemId, cantidad]) =>
              prisma.materialRequestItem.update({
                where: { id: Number(itemId) },
                data: { cantidadAprobada: Number(cantidad) },
              })
            )
          );
        } else {
          // Approve all requested quantities
          await prisma.materialRequestItem.updateMany({
            where: { requestId: Number(id) },
            data: {
              cantidadAprobada: undefined, // Will be set from cantidadSolicitada in a loop
            },
          });

          // Set cantidadAprobada = cantidadSolicitada for each item
          for (const item of materialRequest.items) {
            await prisma.materialRequestItem.update({
              where: { id: item.id },
              data: { cantidadAprobada: item.cantidadSolicitada },
            });
          }
        }

        // Create reservations for supplier items
        const supplierItems = materialRequest.items.filter(
          (item) => item.itemType === 'SUPPLIER_ITEM' && item.supplierItemId
        );

        if (supplierItems.length > 0 && materialRequest.warehouseId) {
          const reservationResult = await createBulkReservations({
            items: supplierItems.map((item) => ({
              supplierItemId: item.supplierItemId!,
              warehouseId: materialRequest.warehouseId!,
              cantidad: Number(cantidadesAprobadas?.[item.id] ?? item.cantidadSolicitada),
            })),
            tipo: StockReservationType.SOLICITUD_MATERIAL,
            materialRequestId: Number(id),
            motivo: `Reserva para solicitud ${materialRequest.numero}`,
            companyId: materialRequest.companyId,
            createdBy: Number(userId),
            allowPartial: true,
          });

          // Update reserved quantities
          for (let i = 0; i < supplierItems.length; i++) {
            const result = reservationResult.reservations[i];
            if (result?.success) {
              await prisma.materialRequestItem.update({
                where: { id: supplierItems[i].id },
                data: { cantidadReservada: result.reservation!.cantidad },
              });
            }
          }
        }

        const updated = await prisma.materialRequest.update({
          where: { id: Number(id) },
          data: {
            estado: MaterialRequestStatus.APROBADA,
            fechaAprobacion: new Date(),
            aprobadoPor: Number(userId),
          },
        });

        return NextResponse.json({ request: updated });
      }

      case 'reject': {
        if (!userId) {
          return NextResponse.json(
            { error: 'userId es requerido para rechazar' },
            { status: 400 }
          );
        }

        if (materialRequest.estado !== MaterialRequestStatus.PENDIENTE_APROBACION) {
          return NextResponse.json(
            { error: 'Solo se pueden rechazar solicitudes PENDIENTE_APROBACION' },
            { status: 400 }
          );
        }

        const updated = await prisma.materialRequest.update({
          where: { id: Number(id) },
          data: {
            estado: MaterialRequestStatus.RECHAZADA,
            fechaAprobacion: new Date(),
            aprobadoPor: Number(userId),
            notas: motivo
              ? `${materialRequest.notas || ''}\n[RECHAZADA] ${motivo}`
              : materialRequest.notas,
          },
        });

        return NextResponse.json({ request: updated });
      }

      case 'cancel': {
        if (
          materialRequest.estado === MaterialRequestStatus.DESPACHADA ||
          materialRequest.estado === MaterialRequestStatus.CANCELADA
        ) {
          return NextResponse.json(
            { error: 'No se puede cancelar esta solicitud' },
            { status: 400 }
          );
        }

        // Release any reservations
        if (materialRequest.estado === MaterialRequestStatus.APROBADA ||
            materialRequest.estado === MaterialRequestStatus.PARCIALMENTE_DESPACHADA) {
          await releaseReservationsForMaterialRequest(
            Number(id),
            motivo || 'Solicitud cancelada'
          );
        }

        const updated = await prisma.materialRequest.update({
          where: { id: Number(id) },
          data: {
            estado: MaterialRequestStatus.CANCELADA,
            notas: motivo
              ? `${materialRequest.notas || ''}\n[CANCELADA] ${motivo}`
              : materialRequest.notas,
          },
        });

        return NextResponse.json({ request: updated });
      }

      default:
        return NextResponse.json(
          { error: 'Acción no válida' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error en PATCH /api/almacen/requests:', error);
    return NextResponse.json(
      { error: 'Error al actualizar solicitud' },
      { status: 500 }
    );
  }
}
