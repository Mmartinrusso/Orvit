/**
 * API: /api/tools/reservations/[id]
 *
 * GET - Obtener detalle de una reserva
 * PATCH - Actualizar estado (pick, cancel, return)
 * DELETE - Eliminar reserva (solo si está en PENDING)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tools/reservations/[id]
 * Obtener detalle de una reserva específica
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission('panol.view_products');
    if (error) return error;

    const { id } = await params;
    const companyId = user!.companyId;

    const reservation = await prisma.sparePartReservation.findFirst({
      where: {
        id: parseInt(id),
        companyId
      },
      include: {
        tool: {
          select: {
            id: true,
            name: true,
            itemType: true,
            category: true,
            stockQuantity: true,
            minStockLevel: true,
            unit: true,
            location: true
          }
        },
        workOrder: {
          select: {
            id: true,
            title: true,
            status: true,
            type: true,
            priority: true,
            assignedTo: {
              select: { id: true, name: true }
            },
            machine: {
              select: { id: true, name: true }
            }
          }
        },
        pickedBy: {
          select: { id: true, name: true, email: true }
        },
        returnedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!reservation) {
      return NextResponse.json(
        { error: 'Reserva no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: reservation
    });

  } catch (error) {
    console.error('Error en GET /api/tools/reservations/[id]:', error);
    return NextResponse.json(
      { error: 'Error al obtener reserva' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tools/reservations/[id]
 * Actualizar estado de reserva: pick, cancel, return
 *
 * Body:
 * - action: 'pick' | 'cancel' | 'return'
 * - quantity?: number (opcional para retorno parcial)
 * - notes?: string
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { user: authUser, error } = await requirePermission('panol.register_movement');
    if (error) return error;

    const { id } = await params;
    const companyId = authUser!.companyId;
    const userId = authUser!.id;

    const body = await request.json();
    const { action, quantity, notes } = body;

    if (!action || !['pick', 'cancel', 'return'].includes(action)) {
      return NextResponse.json(
        { error: 'Acción inválida. Usar: pick, cancel, return' },
        { status: 400 }
      );
    }

    // Obtener reserva actual
    const reservation = await prisma.sparePartReservation.findFirst({
      where: {
        id: parseInt(id),
        companyId
      },
      include: {
        tool: true,
        workOrder: { select: { id: true, title: true } }
      }
    });

    if (!reservation) {
      return NextResponse.json(
        { error: 'Reserva no encontrada' },
        { status: 404 }
      );
    }

    // Ejecutar acción
    switch (action) {
      case 'pick':
        return await handlePick(reservation, userId, notes);

      case 'cancel':
        return await handleCancel(reservation, notes);

      case 'return':
        return await handleReturn(reservation, userId, quantity, notes);

      default:
        return NextResponse.json(
          { error: 'Acción no soportada' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error en PATCH /api/tools/reservations/[id]:', error);
    return NextResponse.json(
      { error: 'Error al actualizar reserva' },
      { status: 500 }
    );
  }
}

/**
 * Manejar picking de repuestos
 * - Cambia estado a PICKED
 * - Descuenta del stock real
 * - Crea movimiento de salida
 */
async function handlePick(reservation: any, userId: number, notes?: string) {
  if (reservation.status !== 'PENDING') {
    return NextResponse.json(
      { error: `No se puede retirar una reserva en estado ${reservation.status}` },
      { status: 400 }
    );
  }

  // Verificar stock disponible
  if (reservation.tool.stockQuantity < reservation.quantity) {
    return NextResponse.json(
      {
        error: `Stock insuficiente. Disponible: ${reservation.tool.stockQuantity}, Reservado: ${reservation.quantity}`,
        stockQuantity: reservation.tool.stockQuantity,
        reservedQuantity: reservation.quantity
      },
      { status: 400 }
    );
  }

  // Transacción: actualizar reserva, descontar stock, crear movimiento
  const [updated, tool, movement] = await prisma.$transaction([
    // Actualizar reserva
    prisma.sparePartReservation.update({
      where: { id: reservation.id },
      data: {
        status: 'PICKED',
        pickedAt: new Date(),
        pickedById: userId,
        notes: notes ? `${reservation.notes || ''}\n[PICKING] ${notes}`.trim() : reservation.notes
      }
    }),
    // Descontar stock
    prisma.tool.update({
      where: { id: reservation.toolId },
      data: {
        stockQuantity: {
          decrement: reservation.quantity
        }
      }
    }),
    // Crear movimiento de salida
    prisma.toolMovement.create({
      data: {
        toolId: reservation.toolId,
        type: 'OUT',
        quantity: reservation.quantity,
        reason: `Picking para OT #${reservation.workOrderId}`,
        description: notes || `Reserva #${reservation.id} - ${reservation.workOrder.title}`,
        userId
      }
    })
  ]);

  // Verificar stock bajo y notificar
  const newStock = reservation.tool.stockQuantity - reservation.quantity;
  if (newStock <= reservation.tool.minStockLevel && newStock > 0) {
    // Enviar notificación de stock bajo (async, no bloquea)
    triggerStockLowNotification(reservation.tool.companyId, reservation.toolId).catch(console.error);
  }

  return NextResponse.json({
    success: true,
    data: updated,
    message: `Retirado: ${reservation.quantity} ${reservation.tool.unit || 'unidades'} de ${reservation.tool.name}`,
    newStock
  });
}

/**
 * Manejar cancelación de reserva
 * - Solo permite cancelar si está en PENDING
 * - No afecta el stock (nunca se retiró)
 */
async function handleCancel(reservation: any, notes?: string) {
  if (reservation.status !== 'PENDING') {
    return NextResponse.json(
      { error: `No se puede cancelar una reserva en estado ${reservation.status}` },
      { status: 400 }
    );
  }

  const updated = await prisma.sparePartReservation.update({
    where: { id: reservation.id },
    data: {
      status: 'CANCELLED',
      notes: notes ? `${reservation.notes || ''}\n[CANCELADO] ${notes}`.trim() : reservation.notes
    }
  });

  return NextResponse.json({
    success: true,
    data: updated,
    message: `Reserva cancelada: ${reservation.quantity} ${reservation.tool.unit || 'unidades'} de ${reservation.tool.name}`
  });
}

/**
 * Manejar devolución de repuestos
 * - Solo permite devolver si está en PICKED
 * - Puede ser devolución total o parcial
 * - Devuelve stock
 */
async function handleReturn(reservation: any, userId: number, quantity?: number, notes?: string) {
  if (reservation.status !== 'PICKED') {
    return NextResponse.json(
      { error: `No se puede devolver una reserva en estado ${reservation.status}` },
      { status: 400 }
    );
  }

  const returnQuantity = quantity ? Math.min(quantity, reservation.quantity) : reservation.quantity;

  if (returnQuantity <= 0) {
    return NextResponse.json(
      { error: 'La cantidad a devolver debe ser mayor a 0' },
      { status: 400 }
    );
  }

  const isPartialReturn = returnQuantity < reservation.quantity;

  // Transacción: actualizar reserva, devolver stock, crear movimiento
  const [updated, tool, movement] = await prisma.$transaction([
    // Actualizar reserva
    prisma.sparePartReservation.update({
      where: { id: reservation.id },
      data: {
        status: isPartialReturn ? 'PICKED' : 'RETURNED', // Si es parcial, sigue PICKED
        returnedAt: isPartialReturn ? undefined : new Date(),
        returnedById: isPartialReturn ? undefined : userId,
        quantity: isPartialReturn ? reservation.quantity - returnQuantity : reservation.quantity,
        notes: notes
          ? `${reservation.notes || ''}\n[DEVOLUCIÓN${isPartialReturn ? ' PARCIAL' : ''}] ${returnQuantity} ${reservation.tool.unit || 'u.'} - ${notes}`.trim()
          : reservation.notes
      }
    }),
    // Devolver stock
    prisma.tool.update({
      where: { id: reservation.toolId },
      data: {
        stockQuantity: {
          increment: returnQuantity
        }
      }
    }),
    // Crear movimiento de entrada
    prisma.toolMovement.create({
      data: {
        toolId: reservation.toolId,
        type: 'IN',
        quantity: returnQuantity,
        reason: `Devolución${isPartialReturn ? ' parcial' : ''} de OT #${reservation.workOrderId}`,
        description: notes || `Reserva #${reservation.id} - ${reservation.workOrder.title}`,
        userId
      }
    })
  ]);

  return NextResponse.json({
    success: true,
    data: updated,
    message: isPartialReturn
      ? `Devolución parcial: ${returnQuantity} ${reservation.tool.unit || 'unidades'} de ${reservation.tool.name}. Quedan ${reservation.quantity - returnQuantity} en la OT.`
      : `Devolución completa: ${returnQuantity} ${reservation.tool.unit || 'unidades'} de ${reservation.tool.name}`,
    returnedQuantity: returnQuantity,
    isPartialReturn
  });
}

/**
 * DELETE /api/tools/reservations/[id]
 * Eliminar reserva (solo si está en PENDING o CANCELLED)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission('tools.delete');
    if (error) return error;

    const { id } = await params;
    const companyId = user!.companyId;

    const reservation = await prisma.sparePartReservation.findFirst({
      where: {
        id: parseInt(id),
        companyId
      }
    });

    if (!reservation) {
      return NextResponse.json(
        { error: 'Reserva no encontrada' },
        { status: 404 }
      );
    }

    if (!['PENDING', 'CANCELLED'].includes(reservation.status)) {
      return NextResponse.json(
        { error: `No se puede eliminar una reserva en estado ${reservation.status}. Primero debe devolverse.` },
        { status: 400 }
      );
    }

    await prisma.sparePartReservation.delete({
      where: { id: reservation.id }
    });

    return NextResponse.json({
      success: true,
      message: 'Reserva eliminada correctamente'
    });

  } catch (error) {
    console.error('Error en DELETE /api/tools/reservations/[id]:', error);
    return NextResponse.json(
      { error: 'Error al eliminar reserva' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Trigger notificación de stock bajo
 */
async function triggerStockLowNotification(companyId: number, toolId: number) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    await fetch(`${baseUrl}/api/notifications/stock-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, toolId })
    });
  } catch (error) {
    console.error('Error enviando notificación de stock bajo:', error);
  }
}
