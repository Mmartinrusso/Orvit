/**
 * API: /api/panol/conteo/[id]/finalize
 *
 * POST — Aplica ajustes de inventario y marca la sesión como COMPLETED
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;
    const sessionId = parseInt(id);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const companyId = user!.companyId;
    const userId = user!.id;

    // Verify session
    const session = await prisma.stockCountSession.findFirst({
      where: { id: sessionId, companyId, status: 'IN_PROGRESS' },
      include: {
        items: {
          where: { countedQty: { not: null }, difference: { not: 0 } },
          include: { tool: { select: { id: true, name: true, stockQuantity: true } } },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Sesión no encontrada o no está en progreso' },
        { status: 404 },
      );
    }

    const itemsToAdjust = session.items;

    if (itemsToAdjust.length === 0) {
      // No adjustments needed — just complete the session
      await prisma.stockCountSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return NextResponse.json({ success: true, adjustedCount: 0, errorCount: 0 });
    }

    // Apply adjustments via the movements API pattern (direct Prisma for atomicity)
    let successCount = 0;
    let errorCount = 0;
    const successfulItemIds: number[] = [];

    for (const item of itemsToAdjust) {
      try {
        await prisma.$transaction([
          // Create movement record
          prisma.toolMovement.create({
            data: {
              type: 'ADJUSTMENT',
              quantity: item.difference,
              reason: `Ajuste por conteo físico - ${item.notes || 'Sin observaciones'}`,
              toolId: item.toolId,
              userId,
            },
          }),
          // Update tool stock
          prisma.tool.update({
            where: { id: item.toolId },
            data: { stockQuantity: item.tool.stockQuantity + item.difference },
          }),
        ]);
        successCount++;
        successfulItemIds.push(item.id);
      } catch (err) {
        console.error(`[finalize] Error adjusting tool ${item.toolId}:`, err);
        errorCount++;
      }
    }

    // Mark successful items as adjusted
    if (successfulItemIds.length > 0) {
      await prisma.stockCountItem.updateMany({
        where: { id: { in: successfulItemIds } },
        data: { status: 'adjusted', adjustedAt: new Date() },
      });
    }

    // Update session
    const isFullyComplete = errorCount === 0;
    await prisma.stockCountSession.update({
      where: { id: sessionId },
      data: {
        adjustedItems: successCount,
        ...(isFullyComplete
          ? { status: 'COMPLETED', completedAt: new Date() }
          : {}),
      },
    });

    return NextResponse.json({
      success: true,
      adjustedCount: successCount,
      errorCount,
      completed: isFullyComplete,
    });
  } catch (err) {
    console.error('[POST /api/panol/conteo/[id]/finalize]', err);
    return NextResponse.json({ error: 'Error al finalizar conteo' }, { status: 500 });
  }
}
