/**
 * Collection Action Detail API - O2C Phase 5
 *
 * Get, update, or complete a collection action.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get action detail
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COBRANZAS_VIEW);
    if (error) return error;

    const { id } = await params;
    const actionId = parseInt(id);

    if (!actionId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const action = await prisma.collectionAction.findUnique({
      where: { id: actionId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            creditLimit: true,
            currentBalance: true,
          },
        },
        invoice: {
          select: {
            id: true,
            numero: true,
            fecha: true,
            fechaVencimiento: true,
            total: true,
            saldoPendiente: true,
          },
        },
      },
    });

    if (!action) {
      return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 });
    }

    return NextResponse.json(action);
  } catch (error) {
    console.error('Error fetching action:', error);
    return NextResponse.json(
      { error: 'Error al obtener acción' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH - Update action (complete, escalate, reschedule)
// ═══════════════════════════════════════════════════════════════════════════════

interface UpdateActionRequest {
  action?: 'complete' | 'escalate' | 'reschedule';
  resultado?: string;
  proximaAccion?: string;
  promesaPago?: string;
  promesaMonto?: number;
  descripcion?: string;
  estado?: string;
  asignadoA?: number;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COBRANZAS_MANAGE);
    if (error) return error;

    const { id } = await params;
    const actionId = parseInt(id);
    const body: UpdateActionRequest = await req.json();

    if (!actionId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existingAction = await prisma.collectionAction.findUnique({
      where: { id: actionId },
    });

    if (!existingAction) {
      return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 });
    }

    switch (body.action) {
      case 'complete': {
        await prisma.collectionAction.update({
          where: { id: actionId },
          data: {
            estado: 'COMPLETADA',
            resultado: body.resultado,
            proximaAccion: body.proximaAccion ? new Date(body.proximaAccion) : null,
            promesaPago: body.promesaPago ? new Date(body.promesaPago) : null,
            promesaMonto: body.promesaMonto,
          },
        });

        // If there's a next action date, create a follow-up action
        if (body.proximaAccion) {
          await prisma.collectionAction.create({
            data: {
              clientId: existingAction.clientId,
              invoiceId: existingAction.invoiceId,
              tipo: 'LLAMADA',
              estado: 'PENDIENTE',
              fecha: new Date(body.proximaAccion),
              descripcion: `Seguimiento: ${body.resultado}`,
              asignadoA: existingAction.asignadoA || user!.id,
              docType: existingAction.docType,
              companyId: existingAction.companyId,
              createdBy: user!.id,
            },
          });
        }

        return NextResponse.json({
          success: true,
          message: 'Acción completada',
        });
      }

      case 'escalate': {
        await prisma.collectionAction.update({
          where: { id: actionId },
          data: {
            estado: 'ESCALADA',
            resultado: body.resultado || 'Escalado a nivel superior',
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Acción escalada',
        });
      }

      case 'reschedule': {
        if (!body.proximaAccion) {
          return NextResponse.json(
            { error: 'proximaAccion requerida para reprogramar' },
            { status: 400 }
          );
        }

        await prisma.collectionAction.update({
          where: { id: actionId },
          data: {
            fecha: new Date(body.proximaAccion),
            descripcion: body.descripcion || existingAction.descripcion,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Acción reprogramada',
        });
      }

      default: {
        // General update
        await prisma.collectionAction.update({
          where: { id: actionId },
          data: {
            ...(body.estado && { estado: body.estado as any }),
            ...(body.resultado && { resultado: body.resultado }),
            ...(body.descripcion && { descripcion: body.descripcion }),
            ...(body.asignadoA && { asignadoA: body.asignadoA }),
            ...(body.proximaAccion && { proximaAccion: new Date(body.proximaAccion) }),
            ...(body.promesaPago && { promesaPago: new Date(body.promesaPago) }),
            ...(body.promesaMonto !== undefined && { promesaMonto: body.promesaMonto }),
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Acción actualizada',
        });
      }
    }
  } catch (error) {
    console.error('Error updating action:', error);
    return NextResponse.json(
      { error: 'Error al actualizar acción' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE - Delete action (only if pending)
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COBRANZAS_MANAGE);
    if (error) return error;

    const { id } = await params;
    const actionId = parseInt(id);

    if (!actionId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const action = await prisma.collectionAction.findUnique({
      where: { id: actionId },
    });

    if (!action) {
      return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 });
    }

    if (action.estado !== 'PENDIENTE') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar acciones pendientes' },
        { status: 422 }
      );
    }

    await prisma.collectionAction.delete({
      where: { id: actionId },
    });

    return NextResponse.json({
      success: true,
      message: 'Acción eliminada',
    });
  } catch (error) {
    console.error('Error deleting action:', error);
    return NextResponse.json(
      { error: 'Error al eliminar acción' },
      { status: 500 }
    );
  }
}
