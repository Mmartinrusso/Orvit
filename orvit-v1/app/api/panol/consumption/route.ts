/**
 * API: /api/panol/consumption
 *
 * GET - Obtener consumo de repuestos por OT, máquina, o período
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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
    const machineId = searchParams.get('machineId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const groupBy = searchParams.get('groupBy') || 'workOrder'; // workOrder, machine, tool, day

    // Filtros base
    const where: any = {
      companyId,
      status: { in: ['PICKED', 'RETURNED'] }
    };

    if (workOrderId) {
      where.workOrderId = parseInt(workOrderId);
    }

    if (machineId) {
      where.workOrder = {
        machineId: parseInt(machineId)
      };
    }

    if (from || to) {
      where.pickedAt = {};
      if (from) where.pickedAt.gte = new Date(from);
      if (to) where.pickedAt.lte = new Date(to);
    }

    // Obtener reservaciones con datos completos
    const reservations = await prisma.sparePartReservation.findMany({
      where,
      include: {
        tool: {
          select: {
            id: true,
            name: true,
            category: true,
            unit: true,
            cost: true
          }
        },
        workOrder: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            machine: {
              select: { id: true, name: true, code: true }
            },
            completedDate: true
          }
        },
        pickedBy: { select: { id: true, name: true } }
      },
      orderBy: { pickedAt: 'desc' }
    });

    // Calcular consumo efectivo (picked - returned)
    const consumptionByOT: Record<number, {
      workOrder: any;
      items: Array<{
        tool: any;
        reserved: number;
        picked: number;
        returned: number;
        consumed: number;
        cost: number;
      }>;
      totalCost: number;
    }> = {};

    reservations.forEach(res => {
      const woId = res.workOrderId;
      if (!consumptionByOT[woId]) {
        consumptionByOT[woId] = {
          workOrder: res.workOrder,
          items: [],
          totalCost: 0
        };
      }

      const consumed = res.status === 'RETURNED' ? 0 : res.quantity;
      const cost = (res.tool?.cost || 0) * consumed;

      consumptionByOT[woId].items.push({
        tool: res.tool,
        reserved: res.quantity,
        picked: res.status === 'PICKED' ? res.quantity : 0,
        returned: res.status === 'RETURNED' ? res.quantity : 0,
        consumed,
        cost
      });
      consumptionByOT[woId].totalCost += cost;
    });

    // Estadísticas generales
    const totalConsumed = reservations.reduce((acc, r) =>
      acc + (r.status === 'RETURNED' ? 0 : r.quantity), 0
    );
    const totalCost = reservations.reduce((acc, r) =>
      acc + (r.status === 'RETURNED' ? 0 : r.quantity * (r.tool?.cost || 0)), 0
    );
    const uniqueTools = new Set(reservations.map(r => r.toolId)).size;
    const uniqueOTs = new Set(reservations.map(r => r.workOrderId)).size;

    // Top consumidores
    const toolConsumption: Record<number, { tool: any; total: number; cost: number }> = {};
    reservations.forEach(res => {
      const consumed = res.status === 'RETURNED' ? 0 : res.quantity;
      if (consumed > 0) {
        if (!toolConsumption[res.toolId]) {
          toolConsumption[res.toolId] = { tool: res.tool, total: 0, cost: 0 };
        }
        toolConsumption[res.toolId].total += consumed;
        toolConsumption[res.toolId].cost += consumed * (res.tool?.cost || 0);
      }
    });

    const topTools = Object.values(toolConsumption)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Consumo por máquina
    const machineConsumption: Record<number, { machine: any; total: number; cost: number; ots: number }> = {};
    reservations.forEach(res => {
      const machineData = res.workOrder?.machine;
      if (machineData) {
        const consumed = res.status === 'RETURNED' ? 0 : res.quantity;
        if (!machineConsumption[machineData.id]) {
          machineConsumption[machineData.id] = {
            machine: machineData,
            total: 0,
            cost: 0,
            ots: new Set()
          } as any;
        }
        machineConsumption[machineData.id].total += consumed;
        machineConsumption[machineData.id].cost += consumed * (res.tool?.cost || 0);
        (machineConsumption[machineData.id] as any).ots.add(res.workOrderId);
      }
    });

    const topMachines = Object.values(machineConsumption)
      .map(m => ({ ...m, ots: (m as any).ots.size }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      data: {
        byWorkOrder: Object.values(consumptionByOT),
        summary: {
          totalConsumed,
          totalCost,
          uniqueTools,
          uniqueOTs
        },
        topTools,
        topMachines
      }
    });

  } catch (error) {
    console.error('Error en GET /api/panol/consumption:', error);
    return NextResponse.json(
      { error: 'Error al obtener consumo' },
      { status: 500 }
    );
  }
}
