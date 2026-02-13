/**
 * API: /api/work-orders/[id]/previous-solutions
 *
 * GET - Obtener soluciones aplicadas anteriormente para el mismo componente/máquina
 *       Usado para sugerir soluciones reutilizables en el cierre guiado
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/work-orders/[id]/previous-solutions
 * Busca soluciones aplicadas previamente en el mismo componente/máquina
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json(
        { error: 'Token inválido o sin companyId' },
        { status: 401 }
      );
    }

    const companyId = payload.companyId as number;
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Obtener la Work Order actual
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        companyId: true,
        machineId: true,
        componentId: true,
      },
    });

    if (!workOrder || workOrder.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    const machineId = workOrder.machineId;
    const componentId = workOrder.componentId;

    if (!machineId) {
      return NextResponse.json({ data: [] }); // Sin máquina, no hay soluciones previas
    }

    // 3. Buscar soluciones aplicadas en el mismo contexto (misma máquina)
    const previousSolutions = await prisma.solutionApplied.findMany({
      where: {
        companyId,
        outcome: 'FUNCIONÓ', // Solo soluciones que funcionaron
        failureOccurrence: {
          machineId,
        },
      },
      select: {
        id: true,
        diagnosis: true,
        solution: true,
        fixType: true,
        finalComponentId: true,
        finalSubcomponentId: true,
        effectiveness: true,
        performedAt: true,
        performedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { effectiveness: 'desc' }, // Más efectivas primero
        { performedAt: 'desc' }, // Más recientes primero
      ],
      take: 5, // Top 5 soluciones
    });

    return NextResponse.json({ data: previousSolutions });
  } catch (error) {
    console.error(
      '❌ Error en GET /api/work-orders/[id]/previous-solutions:',
      error
    );
    return NextResponse.json(
      { error: 'Error al obtener soluciones previas' },
      { status: 500 }
    );
  }
}
