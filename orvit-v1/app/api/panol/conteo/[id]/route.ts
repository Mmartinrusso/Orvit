/**
 * API: /api/panol/conteo/[id]
 *
 * GET   — Detalle de una sesión con todos sus items
 * PATCH — Guardar progreso de conteo (batch update de items)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, error } = await requirePermission('panol.view_products');
    if (error) return error;

    const { id } = await params;
    const sessionId = parseInt(id);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const session = await prisma.stockCountSession.findFirst({
      where: { id: sessionId, companyId: user!.companyId },
      include: {
        items: {
          include: {
            tool: {
              select: {
                id: true, name: true, code: true, itemType: true,
                category: true, location: true, stockQuantity: true,
                minStockLevel: true, isCritical: true,
              },
            },
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, session });
  } catch (err) {
    console.error('[GET /api/panol/conteo/[id]]', err);
    return NextResponse.json({ error: 'Error al obtener sesión' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, error } = await requirePermission('panol.register_movement');
    if (error) return error;

    const { id } = await params;
    const sessionId = parseInt(id);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verify session belongs to company and is in progress
    const session = await prisma.stockCountSession.findFirst({
      where: { id: sessionId, companyId: user!.companyId, status: 'IN_PROGRESS' },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Sesión no encontrada o no está en progreso' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { items } = body as {
      items: Array<{
        toolId: number;
        countedQty: number | null;
        notes?: string;
      }>;
    };

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Se requiere un array de items' }, { status: 400 });
    }

    // Fetch existing items to get systemQty for difference calculation
    const existingItems = await prisma.stockCountItem.findMany({
      where: { sessionId },
      select: { toolId: true, systemQty: true, countedQty: true },
    });
    const systemQtyMap = new Map(existingItems.map((i) => [i.toolId, i.systemQty]));
    const updatedToolIds = new Set(items.map((i) => i.toolId));

    // Build update operations
    const txOps = items.map((item) => {
      const countedQty = item.countedQty !== null && !isNaN(item.countedQty) && item.countedQty >= 0
        ? item.countedQty
        : null;
      const systemQty = systemQtyMap.get(item.toolId) ?? 0;
      const difference = countedQty !== null ? countedQty - systemQty : 0;

      return prisma.stockCountItem.updateMany({
        where: { sessionId, toolId: item.toolId },
        data: {
          countedQty,
          difference,
          notes: item.notes ?? null,
          status: countedQty !== null ? 'counted' : 'pending',
        },
      });
    });

    // Count total counted items after this save
    let totalCounted = 0;
    for (const existing of existingItems) {
      if (updatedToolIds.has(existing.toolId)) {
        const incoming = items.find((i) => i.toolId === existing.toolId);
        if (incoming && incoming.countedQty !== null && !isNaN(incoming.countedQty) && incoming.countedQty >= 0) {
          totalCounted++;
        }
      } else if (existing.countedQty !== null) {
        totalCounted++;
      }
    }

    await prisma.$transaction([
      ...txOps,
      prisma.stockCountSession.update({
        where: { id: sessionId },
        data: { countedItems: totalCounted },
      }),
    ]);

    return NextResponse.json({ success: true, countedItems: totalCounted });
  } catch (err) {
    console.error('[PATCH /api/panol/conteo/[id]]', err);
    return NextResponse.json({ error: 'Error al guardar progreso' }, { status: 500 });
  }
}
