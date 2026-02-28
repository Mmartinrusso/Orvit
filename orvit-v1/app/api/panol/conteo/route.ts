/**
 * API: /api/panol/conteo
 *
 * GET  — Lista sesiones de conteo físico (paginado)
 * POST — Crea una nueva sesión de conteo con items
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { user, error } = await requirePermission('panol.view_products');
    if (error) return error;

    const companyId = user!.companyId;

    const sessions = await prisma.stockCountSession.findMany({
      where: { companyId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ success: true, sessions });
  } catch (err) {
    console.error('[GET /api/panol/conteo]', err);
    return NextResponse.json({ error: 'Error al listar sesiones' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('panol.register_movement');
    if (error) return error;

    const companyId = user!.companyId;
    const userId = user!.id;

    const body = await request.json();
    const { categoryFilter, locationFilter } = body as {
      categoryFilter?: string;
      locationFilter?: string;
    };

    // Cancel any existing IN_PROGRESS session for this company
    await prisma.stockCountSession.updateMany({
      where: { companyId, status: 'IN_PROGRESS' },
      data: { status: 'CANCELLED' },
    });

    // Build tool filter
    const toolWhere: Record<string, unknown> = { companyId };
    if (categoryFilter && categoryFilter !== 'all') {
      toolWhere.category = categoryFilter;
    }
    if (locationFilter && locationFilter !== 'all') {
      toolWhere.location = locationFilter;
    }

    // Get tools matching filter
    const tools = await prisma.tool.findMany({
      where: toolWhere,
      select: { id: true, stockQuantity: true },
    });

    if (tools.length === 0) {
      return NextResponse.json(
        { error: 'No hay items que incluir con esos filtros' },
        { status: 400 },
      );
    }

    // Create session + items in transaction
    const session = await prisma.stockCountSession.create({
      data: {
        companyId,
        createdById: userId,
        categoryFilter: categoryFilter || null,
        locationFilter: locationFilter || null,
        totalItems: tools.length,
        items: {
          create: tools.map((tool) => ({
            toolId: tool.id,
            systemQty: tool.stockQuantity,
          })),
        },
      },
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

    return NextResponse.json({ success: true, session }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/panol/conteo]', err);
    return NextResponse.json({ error: 'Error al crear sesión de conteo' }, { status: 500 });
  }
}
