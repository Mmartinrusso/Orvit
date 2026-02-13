import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { prisma } from '@/lib/prisma';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * GET - Get RMA details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_VIEW);
    if (error) return error;

    const viewMode = getViewMode(request);

    const rma = await prisma.saleRMA.findFirst({
      where: applyViewMode({ id: params.id }, viewMode, user!.companyId),
      include: {
        client: true,
        solicitante: {
          select: { id: true, name: true, email: true },
        },
        aprobador: {
          select: { id: true, name: true },
        },
        procesador: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, code: true, image: true },
            },
          },
        },
        historial: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!rma) {
      return NextResponse.json({ error: 'RMA no encontrado' }, { status: 404 });
    }

    return NextResponse.json(rma);
  } catch (error) {
    console.error('Error fetching RMA:', error);
    return NextResponse.json({ error: 'Error al obtener RMA' }, { status: 500 });
  }
}

/**
 * PUT - Update RMA or change status
 *
 * Body:
 * - action: 'aprobar' | 'rechazar' | 'recibir' | 'procesar' | 'cerrar'
 * - notas: Optional notes
 * - ... action-specific fields
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_EDIT);
    if (error) return error;

    const body = await request.json();
    const { action, notas, ...data } = body;

    const viewMode = getViewMode(request);

    // Get current RMA
    const rma = await prisma.saleRMA.findFirst({
      where: applyViewMode({ id: params.id }, viewMode, user!.companyId),
    });

    if (!rma) {
      return NextResponse.json({ error: 'RMA no encontrado' }, { status: 404 });
    }

    let updatedRMA;
    let newStatus = rma.estado;

    switch (action) {
      case 'aprobar':
        if (rma.estado !== 'SOLICITADO' && rma.estado !== 'EN_REVISION') {
          return NextResponse.json(
            { error: 'RMA no puede ser aprobado en este estado' },
            { status: 400 }
          );
        }
        updatedRMA = await prisma.saleRMA.update({
          where: { id: params.id },
          data: {
            estado: 'APROBADO',
            aprobadoPor: user!.id,
            fechaAprobacion: new Date(),
          },
        });
        newStatus = 'APROBADO';
        break;

      case 'rechazar':
        if (rma.estado !== 'SOLICITADO' && rma.estado !== 'EN_REVISION') {
          return NextResponse.json(
            { error: 'RMA no puede ser rechazado en este estado' },
            { status: 400 }
          );
        }
        updatedRMA = await prisma.saleRMA.update({
          where: { id: params.id },
          data: {
            estado: 'RECHAZADO',
            aprobadoPor: user!.id,
            fechaAprobacion: new Date(),
          },
        });
        newStatus = 'RECHAZADO';
        break;

      case 'recibir':
        if (rma.estado !== 'APROBADO' && rma.estado !== 'EN_TRANSITO') {
          return NextResponse.json(
            { error: 'RMA no puede ser recibido en este estado' },
            { status: 400 }
          );
        }
        updatedRMA = await prisma.saleRMA.update({
          where: { id: params.id },
          data: {
            estado: 'RECIBIDO',
            fechaRecepcion: new Date(),
            estadoProducto: data.estadoProducto || 'RECIBIDO',
            fotoRecepcion: data.fotos || [],
          },
        });
        newStatus = 'RECIBIDO';
        break;

      case 'procesar':
        if (rma.estado !== 'RECIBIDO' && rma.estado !== 'EN_EVALUACION') {
          return NextResponse.json(
            { error: 'RMA no puede ser procesado en este estado' },
            { status: 400 }
          );
        }
        updatedRMA = await prisma.saleRMA.update({
          where: { id: params.id },
          data: {
            estado: 'PROCESADO',
            procesadoPor: user!.id,
            tipoResolucion: data.tipoResolucion,
            creditNoteId: data.creditNoteId,
            nuevaVentaId: data.nuevaVentaId,
            montoDevuelto: data.montoDevuelto,
          },
        });
        newStatus = 'PROCESADO';
        break;

      case 'cerrar':
        if (rma.estado !== 'PROCESADO') {
          return NextResponse.json(
            { error: 'RMA no puede ser cerrado en este estado' },
            { status: 400 }
          );
        }
        updatedRMA = await prisma.saleRMA.update({
          where: { id: params.id },
          data: {
            estado: 'CERRADO',
            fechaCierre: new Date(),
          },
        });
        newStatus = 'CERRADO';
        break;

      default:
        // Update general fields
        updatedRMA = await prisma.saleRMA.update({
          where: { id: params.id },
          data: {
            ...data,
          },
        });
    }

    // Create history entry
    if (action && newStatus !== rma.estado) {
      await prisma.saleRMAHistory.create({
        data: {
          rmaId: params.id,
          estadoAnterior: rma.estado,
          estadoNuevo: newStatus,
          userId: user!.id,
          notas: notas || `Acción: ${action}`,
        },
      });
    }

    return NextResponse.json(updatedRMA);
  } catch (error) {
    console.error('Error updating RMA:', error);
    return NextResponse.json({ error: 'Error al actualizar RMA' }, { status: 500 });
  }
}

/**
 * DELETE - Cancel RMA
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.FACTURAS_EDIT);
    if (error) return error;

    const viewMode = getViewMode(request);

    const rma = await prisma.saleRMA.findFirst({
      where: applyViewMode({ id: params.id }, viewMode, user!.companyId),
    });

    if (!rma) {
      return NextResponse.json({ error: 'RMA no encontrado' }, { status: 404 });
    }

    if (rma.estado === 'PROCESADO' || rma.estado === 'CERRADO') {
      return NextResponse.json(
        { error: 'No se puede cancelar un RMA procesado o cerrado' },
        { status: 400 }
      );
    }

    await prisma.saleRMA.update({
      where: { id: params.id },
      data: { estado: 'CANCELADO' },
    });

    await prisma.saleRMAHistory.create({
      data: {
        rmaId: params.id,
        estadoAnterior: rma.estado,
        estadoNuevo: 'CANCELADO',
        userId: user!.id,
        notas: 'RMA cancelado',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error canceling RMA:', error);
    return NextResponse.json({ error: 'Error al cancelar RMA' }, { status: 500 });
  }
}
