/**
 * API: /api/panol/lots
 *
 * GET - Listar lotes de inventario con instalaciones
 * POST - Crear nuevo lote
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('panol.view_products');
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);

    const toolId = searchParams.get('toolId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const withInstallations = searchParams.get('withInstallations') === 'true';
    const expiringDays = searchParams.get('expiringDays');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = { companyId };

    if (toolId) {
      where.toolId = parseInt(toolId);
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { lotNumber: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { tool: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Filtrar lotes próximos a vencer
    if (expiringDays) {
      const daysAhead = parseInt(expiringDays);
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + daysAhead);
      where.expiresAt = {
        lte: expirationDate,
        gte: new Date()
      };
      where.status = 'AVAILABLE';
    }

    const [lots, total] = await Promise.all([
      prisma.inventoryLot.findMany({
        where,
        include: {
          tool: {
            select: {
              id: true,
              name: true,
              category: true,
              unit: true,
              itemType: true
            }
          },
          installations: withInstallations ? {
            include: {
              machine: { select: { id: true, name: true } },
              component: { select: { id: true, name: true } },
              installedBy: { select: { id: true, name: true } },
              removedBy: { select: { id: true, name: true } },
              workOrder: { select: { id: true, title: true } }
            },
            orderBy: { installedAt: 'desc' }
          } : false
        },
        orderBy: [
          { expiresAt: 'asc' },
          { receivedAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.inventoryLot.count({ where })
    ]);

    // Estadísticas
    const stats = await prisma.inventoryLot.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { id: true },
      _sum: { remainingQty: true }
    });

    // Lotes próximos a vencer (30 días)
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

    const expiringCount = await prisma.inventoryLot.count({
      where: {
        companyId,
        status: 'AVAILABLE',
        expiresAt: {
          lte: thirtyDaysAhead,
          gte: new Date()
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: lots,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        byStatus: stats.reduce((acc, s) => {
          acc[s.status] = { count: s._count.id, quantity: s._sum.remainingQty || 0 };
          return acc;
        }, {} as Record<string, { count: number; quantity: number }>),
        expiringSoon: expiringCount
      }
    });

  } catch (error) {
    console.error('Error en GET /api/panol/lots:', error);
    return NextResponse.json(
      { error: 'Error al obtener lotes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = await requirePermission('panol.create_product');
    if (error) return error;

    const companyId = authUser!.companyId;
    const body = await request.json();

    const { toolId, lotNumber, serialNumber, quantity, expiresAt, unitCost, notes } = body;

    if (!toolId || !lotNumber || !quantity) {
      return NextResponse.json(
        { error: 'toolId, lotNumber y quantity son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el tool existe
    const tool = await prisma.tool.findFirst({
      where: { id: parseInt(toolId), companyId }
    });

    if (!tool) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });
    }

    // Verificar que el lote no exista
    const existing = await prisma.inventoryLot.findFirst({
      where: { toolId: parseInt(toolId), lotNumber, companyId }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un lote con ese número para este item' },
        { status: 400 }
      );
    }

    const lot = await prisma.inventoryLot.create({
      data: {
        toolId: parseInt(toolId),
        lotNumber,
        serialNumber: serialNumber || null,
        quantity: parseInt(quantity),
        remainingQty: parseInt(quantity),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        unitCost: unitCost ? parseFloat(unitCost) : null,
        notes: notes || null,
        companyId
      },
      include: {
        tool: { select: { id: true, name: true } }
      }
    });

    return NextResponse.json({
      success: true,
      data: lot,
      message: `Lote ${lotNumber} creado correctamente`
    });

  } catch (error) {
    console.error('Error en POST /api/panol/lots:', error);
    return NextResponse.json(
      { error: 'Error al crear lote' },
      { status: 500 }
    );
  }
}
