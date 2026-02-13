/**
 * Payment Dispute Detail API - O2C Phase 5
 *
 * Get, update, or resolve a dispute.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get dispute detail
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COBRANZAS_VIEW);
    if (error) return error;

    const { id } = await params;
    const disputeId = parseInt(id);

    if (!disputeId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const dispute = await prisma.paymentDispute.findUnique({
      where: { id: disputeId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        invoice: {
          select: {
            id: true,
            numero: true,
            fecha: true,
            total: true,
            saldoPendiente: true,
            items: {
              select: {
                id: true,
                productId: true,
                product: { select: { name: true } },
                cantidad: true,
                precioUnitario: true,
              },
            },
          },
        },
        delivery: {
          select: { id: true, numero: true, estado: true },
        },
        creditNote: {
          select: { id: true, numero: true, total: true, fiscalStatus: true },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: 'Disputa no encontrada' }, { status: 404 });
    }

    return NextResponse.json(dispute);
  } catch (error) {
    console.error('Error fetching dispute:', error);
    return NextResponse.json(
      { error: 'Error al obtener disputa' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH - Update dispute (change status, resolve, link credit note)
// ═══════════════════════════════════════════════════════════════════════════════

interface UpdateDisputeRequest {
  action?: 'investigate' | 'pendingClient' | 'pendingInternal' | 'resolve' | 'close';
  estado?: string;
  resolucion?: string;
  resolucionNotas?: string;
  creditNoteId?: number;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COBRANZAS_MANAGE);
    if (error) return error;

    const { id } = await params;
    const disputeId = parseInt(id);
    const body: UpdateDisputeRequest = await req.json();

    if (!disputeId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const dispute = await prisma.paymentDispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      return NextResponse.json({ error: 'Disputa no encontrada' }, { status: 404 });
    }

    if (dispute.estado === 'CERRADA') {
      return NextResponse.json(
        { error: 'No se puede modificar una disputa cerrada' },
        { status: 422 }
      );
    }

    switch (body.action) {
      case 'investigate': {
        await prisma.paymentDispute.update({
          where: { id: disputeId },
          data: { estado: 'EN_INVESTIGACION' },
        });

        return NextResponse.json({
          success: true,
          message: 'Disputa en investigación',
        });
      }

      case 'pendingClient': {
        await prisma.paymentDispute.update({
          where: { id: disputeId },
          data: { estado: 'PENDIENTE_CLIENTE' },
        });

        return NextResponse.json({
          success: true,
          message: 'Disputa pendiente de cliente',
        });
      }

      case 'pendingInternal': {
        await prisma.paymentDispute.update({
          where: { id: disputeId },
          data: { estado: 'PENDIENTE_INTERNO' },
        });

        return NextResponse.json({
          success: true,
          message: 'Disputa pendiente interno',
        });
      }

      case 'resolve': {
        if (!body.resolucion) {
          return NextResponse.json(
            { error: 'resolucion requerida' },
            { status: 400 }
          );
        }

        await prisma.paymentDispute.update({
          where: { id: disputeId },
          data: {
            estado: 'RESUELTA',
            resolucion: body.resolucion as any,
            resolucionNotas: body.resolucionNotas,
            resolucionPor: user!.id,
            resolucionAt: new Date(),
            creditNoteId: body.creditNoteId,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Disputa resuelta',
        });
      }

      case 'close': {
        await prisma.paymentDispute.update({
          where: { id: disputeId },
          data: { estado: 'CERRADA' },
        });

        return NextResponse.json({
          success: true,
          message: 'Disputa cerrada',
        });
      }

      default: {
        // General update
        await prisma.paymentDispute.update({
          where: { id: disputeId },
          data: {
            ...(body.estado && { estado: body.estado as any }),
            ...(body.resolucionNotas && { resolucionNotas: body.resolucionNotas }),
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Disputa actualizada',
        });
      }
    }
  } catch (error) {
    console.error('Error updating dispute:', error);
    return NextResponse.json(
      { error: 'Error al actualizar disputa' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE - Delete dispute (only if open)
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COBRANZAS_MANAGE);
    if (error) return error;

    const { id } = await params;
    const disputeId = parseInt(id);

    if (!disputeId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const dispute = await prisma.paymentDispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      return NextResponse.json({ error: 'Disputa no encontrada' }, { status: 404 });
    }

    if (dispute.estado !== 'ABIERTA') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar disputas abiertas' },
        { status: 422 }
      );
    }

    await prisma.paymentDispute.delete({
      where: { id: disputeId },
    });

    return NextResponse.json({
      success: true,
      message: 'Disputa eliminada',
    });
  } catch (error) {
    console.error('Error deleting dispute:', error);
    return NextResponse.json(
      { error: 'Error al eliminar disputa' },
      { status: 500 }
    );
  }
}
