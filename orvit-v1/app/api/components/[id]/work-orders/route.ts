import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/components/[id]/work-orders - Obtener órdenes de trabajo de un componente
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const componentId = parseInt(params.id);

    if (isNaN(componentId)) {
      return NextResponse.json(
        { error: 'ID de componente inválido' },
        { status: 400 }
      );
    }

    // Obtener work orders que tienen este componente asignado
    const workOrders = await prisma.workOrder.findMany({
      where: {
        componentId: componentId,
      },
      include: {
        machine: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedWorker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      workOrders,
      total: workOrders.length,
    });
  } catch (error) {
    console.error('Error fetching component work orders:', error);
    return NextResponse.json(
      { error: 'Error al obtener las órdenes de trabajo' },
      { status: 500 }
    );
  }
}
