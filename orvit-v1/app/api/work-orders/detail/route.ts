import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * ✨ ENDPOINT AGREGADOR: Detalle completo de una orden de trabajo
 * Consolida todos los datos necesarios para el modal de detalle
 * 
 * ANTES: 3-5 requests
 * DESPUÉS: 1 request
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const workOrderId = searchParams.get('workOrderId') || searchParams.get('id');

    if (!workOrderId) {
      return NextResponse.json(
        { error: 'workOrderId es requerido' },
        { status: 400 }
      );
    }

    const workOrderIdNum = parseInt(workOrderId);

    // ✨ OPTIMIZACIÓN: Obtener todo en una query con includes
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderIdNum },
      include: {
        machine: {
          include: {
            sector: {
              select: {
                id: true,
                name: true,
                area: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        },
        unidadMovil: true,
        component: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        assignedWorker: {
          select: {
            id: true,
            name: true,
            phone: true,
            specialty: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        sector: {
          select: {
            id: true,
            name: true
          }
        },
        attachments: true
      }
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    // Obtener historial relacionado si hay máquina
    let relatedHistory: any[] = [];
    if (workOrder.machineId) {
      relatedHistory = await prisma.maintenance_history.findMany({
        where: { machineId: workOrder.machineId },
        take: 5,
        orderBy: { executedAt: 'desc' },
        select: {
          id: true,
          maintenanceType: true,
          title: true,
          executedAt: true,
          completionStatus: true
        }
      });
    }

    return NextResponse.json({
      workOrder,
      relatedHistory,
      metadata: {
        workOrderId: workOrderIdNum,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[WORK_ORDERS_DETAIL_ERROR]', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
