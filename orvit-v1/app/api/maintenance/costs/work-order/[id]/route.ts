/**
 * API: /api/maintenance/costs/work-order/[id]
 *
 * GET - Obtener desglose de costos de una OT específica
 * POST - Recalcular costos de una OT
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { calculateWorkOrderCost } from '@/lib/maintenance-costs/calculator';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/maintenance/costs/work-order/[id]
 * Obtener desglose de costos de una OT
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    const workOrderId = parseInt(id);

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'ID de OT inválido' }, { status: 400 });
    }

    // Verificar que la OT existe y pertenece a la empresa
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId },
      select: {
        id: true,
        title: true,
        status: true,
        actualHours: true,
        completedDate: true,
        executorIds: true,
        machine: { select: { id: true, name: true } },
        sector: { select: { id: true, name: true } }
      }
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    // Obtener desglose de costos
    const costBreakdown = await prisma.maintenanceCostBreakdown.findUnique({
      where: { workOrderId }
    });

    // Obtener costos de terceros
    const thirdPartyCosts = await prisma.thirdPartyCost.findMany({
      where: { workOrderId },
      select: {
        id: true,
        supplierName: true,
        description: true,
        amount: true,
        costType: true,
        invoiceNumber: true,
        invoiceDate: true,
        createdAt: true
      }
    });

    // Obtener repuestos usados (reservas PICKED)
    const sparePartsUsed = await prisma.sparePartReservation.findMany({
      where: { workOrderId, status: 'PICKED' },
      include: {
        tool: {
          select: {
            id: true,
            name: true,
            cost: true,
            unit: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        workOrder,
        costBreakdown: costBreakdown ? {
          laborCost: Number(costBreakdown.laborCost),
          sparePartsCost: Number(costBreakdown.sparePartsCost),
          thirdPartyCost: Number(costBreakdown.thirdPartyCost),
          extrasCost: Number(costBreakdown.extrasCost),
          totalCost: Number(costBreakdown.totalCost),
          calculatedAt: costBreakdown.calculatedAt
        } : null,
        thirdPartyCosts: thirdPartyCosts.map(tc => ({
          ...tc,
          amount: Number(tc.amount)
        })),
        sparePartsUsed: sparePartsUsed.map(sp => ({
          toolId: sp.tool.id,
          toolName: sp.tool.name,
          quantity: sp.quantity,
          unitCost: sp.tool.cost ? Number(sp.tool.cost) : 0,
          totalCost: sp.quantity * (sp.tool.cost ? Number(sp.tool.cost) : 0),
          unit: sp.tool.unit
        }))
      }
    });

  } catch (error) {
    console.error('Error en GET /api/maintenance/costs/work-order/[id]:', error);
    return NextResponse.json(
      { error: 'Error al obtener costos de la OT' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/maintenance/costs/work-order/[id]
 * Recalcular costos de una OT
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    const workOrderId = parseInt(id);

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'ID de OT inválido' }, { status: 400 });
    }

    // Verificar que la OT existe
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId }
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    // Recalcular costos
    const costBreakdown = await calculateWorkOrderCost(workOrderId, companyId);

    return NextResponse.json({
      success: true,
      data: costBreakdown,
      message: 'Costos recalculados exitosamente'
    });

  } catch (error) {
    console.error('Error en POST /api/maintenance/costs/work-order/[id]:', error);
    return NextResponse.json(
      { error: 'Error al recalcular costos' },
      { status: 500 }
    );
  }
}
