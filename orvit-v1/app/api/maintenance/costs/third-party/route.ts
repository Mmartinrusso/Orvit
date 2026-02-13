/**
 * API: /api/maintenance/costs/third-party
 *
 * GET - Listar costos de terceros
 * POST - Agregar costo de tercero a una OT
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { calculateWorkOrderCost } from '@/lib/maintenance-costs/calculator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/maintenance/costs/third-party
 * Listar costos de terceros con filtros
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const { searchParams } = new URL(request.url);

    const workOrderId = searchParams.get('workOrderId');
    const supplier = searchParams.get('supplier');
    const costType = searchParams.get('costType');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = { companyId };

    if (workOrderId) {
      where.workOrderId = parseInt(workOrderId);
    }

    if (supplier) {
      where.supplierName = { contains: supplier, mode: 'insensitive' };
    }

    if (costType) {
      where.costType = costType;
    }

    const costs = await prisma.thirdPartyCost.findMany({
      where,
      include: {
        workOrder: {
          select: {
            id: true,
            title: true,
            machine: { select: { name: true } }
          }
        },
        createdBy: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Estadísticas
    const stats = await prisma.thirdPartyCost.groupBy({
      by: ['costType'],
      where: { companyId },
      _sum: { amount: true },
      _count: { id: true }
    });

    return NextResponse.json({
      success: true,
      data: costs.map(c => ({
        id: c.id,
        workOrderId: c.workOrderId,
        workOrderTitle: c.workOrder.title,
        machineName: c.workOrder.machine?.name,
        supplierName: c.supplierName,
        supplierRUT: c.supplierRUT,
        description: c.description,
        amount: Number(c.amount),
        currency: c.currency,
        costType: c.costType,
        invoiceNumber: c.invoiceNumber,
        invoiceDate: c.invoiceDate,
        createdAt: c.createdAt,
        createdBy: c.createdBy?.name
      })),
      stats: stats.map(s => ({
        costType: s.costType,
        total: Number(s._sum.amount),
        count: s._count.id
      }))
    });

  } catch (error) {
    console.error('Error en GET /api/maintenance/costs/third-party:', error);
    return NextResponse.json(
      { error: 'Error al obtener costos de terceros' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/maintenance/costs/third-party
 * Agregar costo de tercero a una OT
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;
    const body = await request.json();

    const {
      workOrderId,
      supplierName,
      supplierRUT,
      description,
      amount,
      currency = 'ARS',
      costType = 'SERVICE',
      invoiceNumber,
      invoiceDate
    } = body;

    // Validaciones
    if (!workOrderId || !supplierName || !amount) {
      return NextResponse.json(
        { error: 'workOrderId, supplierName y amount son requeridos' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'El monto debe ser mayor a 0' },
        { status: 400 }
      );
    }

    const validCostTypes = ['LABOR', 'PARTS', 'SERVICE', 'TRANSPORT', 'OTHER'];
    if (!validCostTypes.includes(costType)) {
      return NextResponse.json(
        { error: `Tipo de costo inválido. Usar: ${validCostTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Verificar que la OT existe
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: parseInt(workOrderId), companyId }
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    // Crear costo de tercero
    const cost = await prisma.thirdPartyCost.create({
      data: {
        workOrderId: parseInt(workOrderId),
        companyId,
        supplierName,
        supplierRUT: supplierRUT || null,
        description: description || null,
        amount: parseFloat(amount),
        currency,
        costType,
        invoiceNumber: invoiceNumber || null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        createdById: userId
      },
      include: {
        workOrder: { select: { title: true } },
        createdBy: { select: { name: true } }
      }
    });

    // Recalcular costos de la OT
    try {
      await calculateWorkOrderCost(parseInt(workOrderId), companyId);
    } catch (calcError) {
      console.warn('⚠️ No se pudo recalcular costos:', calcError);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: cost.id,
        workOrderId: cost.workOrderId,
        workOrderTitle: cost.workOrder.title,
        supplierName: cost.supplierName,
        amount: Number(cost.amount),
        costType: cost.costType,
        createdAt: cost.createdAt
      },
      message: `Costo agregado: $${cost.amount} de ${cost.supplierName}`
    });

  } catch (error) {
    console.error('Error en POST /api/maintenance/costs/third-party:', error);
    return NextResponse.json(
      { error: 'Error al crear costo de tercero' },
      { status: 500 }
    );
  }
}
