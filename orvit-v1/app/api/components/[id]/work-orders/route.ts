import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/components/[id]/work-orders - Obtener órdenes de trabajo de un componente
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const componentId = parseInt(params.id);

    if (isNaN(componentId)) {
      return NextResponse.json(
        { error: 'ID de componente inválido' },
        { status: 400 }
      );
    }

    // Verificar company boundary a través de la máquina
    const component = await prisma.component.findUnique({
      where: { id: componentId },
      select: { id: true, machine: { select: { companyId: true } } }
    });
    if (!component || component.machine.companyId !== auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
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
