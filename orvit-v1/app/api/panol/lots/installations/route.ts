/**
 * API: /api/panol/lots/installations
 *
 * GET - Listar instalaciones de lotes (trazabilidad)
 * POST - Registrar instalación de un lote
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

    const lotId = searchParams.get('lotId');
    const machineId = searchParams.get('machineId');
    const componentId = searchParams.get('componentId');
    const workOrderId = searchParams.get('workOrderId');
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = { companyId };

    if (lotId) where.lotId = parseInt(lotId);
    if (machineId) where.machineId = parseInt(machineId);
    if (componentId) where.componentId = parseInt(componentId);
    if (workOrderId) where.workOrderId = parseInt(workOrderId);
    if (activeOnly) where.removedAt = null;

    const [installations, total] = await Promise.all([
      prisma.lotInstallation.findMany({
        where,
        include: {
          lot: {
            include: {
              tool: { select: { id: true, name: true, category: true, unit: true } }
            }
          },
          machine: { select: { id: true, name: true, code: true } },
          component: { select: { id: true, name: true } },
          installedBy: { select: { id: true, name: true } },
          removedBy: { select: { id: true, name: true } },
          workOrder: { select: { id: true, title: true, status: true } }
        },
        orderBy: { installedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.lotInstallation.count({ where })
    ]);

    // Estadísticas
    const [activeCount, removedCount, byMachine] = await Promise.all([
      prisma.lotInstallation.count({
        where: { companyId, removedAt: null }
      }),
      prisma.lotInstallation.count({
        where: { companyId, removedAt: { not: null } }
      }),
      prisma.lotInstallation.groupBy({
        by: ['machineId'],
        where: { companyId, removedAt: null },
        _count: { id: true }
      })
    ]);

    return NextResponse.json({
      success: true,
      data: installations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        active: activeCount,
        removed: removedCount,
        machinesWithInstallations: byMachine.length
      }
    });

  } catch (error) {
    console.error('Error en GET /api/panol/lots/installations:', error);
    return NextResponse.json(
      { error: 'Error al obtener instalaciones' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = await requirePermission('panol.register_movement');
    if (error) return error;

    const companyId = authUser!.companyId;
    const userId = authUser!.id;
    const body = await request.json();

    const { lotId, machineId, componentId, quantity, workOrderId, notes } = body;

    if (!lotId || !machineId) {
      return NextResponse.json(
        { error: 'lotId y machineId son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el lote existe y tiene cantidad disponible
    const lot = await prisma.inventoryLot.findFirst({
      where: { id: parseInt(lotId), companyId }
    });

    if (!lot) {
      return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 });
    }

    const installQty = quantity ? parseInt(quantity) : 1;

    if (lot.remainingQty < installQty) {
      return NextResponse.json(
        { error: `Cantidad insuficiente en el lote. Disponible: ${lot.remainingQty}` },
        { status: 400 }
      );
    }

    // Verificar máquina
    const machine = await prisma.machine.findFirst({
      where: { id: parseInt(machineId), companyId }
    });

    if (!machine) {
      return NextResponse.json({ error: 'Máquina no encontrada' }, { status: 404 });
    }

    // Crear instalación y actualizar lote
    const [installation, updatedLot] = await prisma.$transaction([
      prisma.lotInstallation.create({
        data: {
          lotId: parseInt(lotId),
          machineId: parseInt(machineId),
          componentId: componentId ? parseInt(componentId) : null,
          quantity: installQty,
          installedById: userId,
          workOrderId: workOrderId ? parseInt(workOrderId) : null,
          notes: notes || null,
          companyId
        },
        include: {
          lot: { include: { tool: { select: { name: true } } } },
          machine: { select: { name: true } }
        }
      }),
      prisma.inventoryLot.update({
        where: { id: parseInt(lotId) },
        data: {
          remainingQty: { decrement: installQty },
          status: lot.remainingQty - installQty === 0 ? 'DEPLETED' : 'AVAILABLE'
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      data: installation,
      message: `Instalado ${installQty} unidad(es) de lote ${lot.lotNumber} en ${machine.name}`
    });

  } catch (error) {
    console.error('Error en POST /api/panol/lots/installations:', error);
    return NextResponse.json(
      { error: 'Error al registrar instalación' },
      { status: 500 }
    );
  }
}
