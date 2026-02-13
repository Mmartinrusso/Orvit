/**
 * API: /api/work-orders/dispatcher
 *
 * GET - Vista Dispatcher con 3 buckets:
 *       1. ENTRANTES (sin asignar / new / backlog)
 *       2. A_PLANIFICAR (asignadas pero no iniciadas)
 *       3. EN_EJECUCION_BLOQUEADAS (in_progress + waiting)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/work-orders/dispatcher
 * Retorna 3 buckets para vista dispatcher
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticación
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

    // 2. Parsear query params
    const searchParams = request.nextUrl.searchParams;
    const machineId = searchParams.get('machineId') ? parseInt(searchParams.get('machineId')!) : undefined;
    const priority = searchParams.get('priority') || undefined;
    const take = parseInt(searchParams.get('take') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');

    // 3. Base where clause
    const baseWhere = {
      companyId,
      type: 'CORRECTIVE' as const,
      ...(machineId && { machineId }),
      ...(priority && { priority }),
    };

    // Include común (simplificado para evitar errores de campos inexistentes)
    const commonInclude = {
      machine: {
        select: { id: true, name: true, assetCode: true }
      },
      assignedTo: {
        select: { id: true, name: true, email: true }
      },
      createdBy: {
        select: { id: true, name: true }
      }
    };

    // ✅ OPTIMIZADO: Ejecutar las 6 queries en paralelo
    const [
      entrantes,
      entrantesCount,
      aPlanificar,
      aPlanificarCount,
      enEjecucion,
      enEjecucionCount
    ] = await Promise.all([
      // Bucket 1: ENTRANTES (sin asignar - PENDING sin assignedTo)
      prisma.workOrder.findMany({
        where: {
          ...baseWhere,
          status: 'PENDING',
          assignedToId: null
        },
        include: commonInclude,
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'asc' }
        ],
        take,
        skip
      }),
      prisma.workOrder.count({
        where: {
          ...baseWhere,
          status: 'PENDING',
          assignedToId: null
        }
      }),
      // Bucket 2: A_PLANIFICAR (asignadas pero no iniciadas)
      prisma.workOrder.findMany({
        where: {
          ...baseWhere,
          status: { in: ['PENDING', 'SCHEDULED'] },
          assignedToId: { not: null }
        },
        include: commonInclude,
        orderBy: [
          { priority: 'asc' },
          { scheduledDate: 'asc' },
          { createdAt: 'asc' }
        ],
        take,
        skip
      }),
      prisma.workOrder.count({
        where: {
          ...baseWhere,
          status: { in: ['PENDING', 'SCHEDULED'] },
          assignedToId: { not: null }
        }
      }),
      // Bucket 3: EN_EJECUCION + BLOQUEADAS (IN_PROGRESS + WAITING + ON_HOLD)
      prisma.workOrder.findMany({
        where: {
          ...baseWhere,
          status: { in: ['IN_PROGRESS', 'WAITING', 'ON_HOLD'] }
        },
        include: commonInclude,
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'asc' }
        ],
        take,
        skip
      }),
      prisma.workOrder.count({
        where: {
          ...baseWhere,
          status: { in: ['IN_PROGRESS', 'WAITING', 'ON_HOLD'] }
        }
      })
    ]);

    // 7. Separar en_ejecución de bloqueadas
    const inProgress = enEjecucion.filter(wo => wo.status === 'IN_PROGRESS');
    const waiting = enEjecucion.filter(wo =>
      wo.status === 'WAITING' || wo.status === 'ON_HOLD'
    );

    // 8. Calcular alertas
    const now = new Date();

    // Helper para calcular SLA status (usa slaDueAt si existe)
    const calculateSlaInfo = (wo: any) => {
      if (!wo.slaDueAt) return { slaStatus: null, slaOverdue: false, slaHoursRemaining: null };

      const slaDue = new Date(wo.slaDueAt);
      const hoursRemaining = Math.floor((slaDue.getTime() - now.getTime()) / (1000 * 60 * 60));

      return {
        slaStatus: hoursRemaining < 0 ? 'BREACHED' : hoursRemaining < 4 ? 'AT_RISK' : 'OK',
        slaOverdue: hoursRemaining < 0,
        slaHoursRemaining: hoursRemaining
      };
    };

    // Enriquecer con información adicional
    const enrichItem = (wo: any) => ({
      ...wo,
      maintenanceType: wo.type,
      ...calculateSlaInfo(wo)
    });

    const waitingWithAlerts = waiting.map(wo => ({
      ...enrichItem(wo),
      etaOverdue: wo.waitingETA ? new Date(wo.waitingETA) < now : false,
      etaOverdueHours: wo.waitingETA
        ? Math.floor((now.getTime() - new Date(wo.waitingETA).getTime()) / (1000 * 60 * 60))
        : 0
    }));

    // Contar SLAs
    const allItems = [...entrantes, ...aPlanificar, ...enEjecucion];
    const slaBreached = allItems.filter(wo => {
      const info = calculateSlaInfo(wo);
      return info.slaStatus === 'BREACHED';
    }).length;
    const slaAtRisk = allItems.filter(wo => {
      const info = calculateSlaInfo(wo);
      return info.slaStatus === 'AT_RISK';
    }).length;

    // 9. Retornar buckets
    return NextResponse.json({
      success: true,
      buckets: {
        entrantes: {
          items: entrantes.map(enrichItem),
          total: entrantesCount,
          hasMore: skip + take < entrantesCount
        },
        aPlanificar: {
          items: aPlanificar.map(enrichItem),
          total: aPlanificarCount,
          hasMore: skip + take < aPlanificarCount
        },
        enEjecucion: {
          inProgress: inProgress.map(enrichItem),
          waiting: waitingWithAlerts,
          total: enEjecucionCount,
          waitingWithOverdueETA: waitingWithAlerts.filter(wo => wo.etaOverdue).length
        }
      },
      summary: {
        totalEntrantes: entrantesCount,
        totalAPlanificar: aPlanificarCount,
        totalEnEjecucion: enEjecucionCount,
        totalWaiting: waiting.length,
        totalOverdueETA: waitingWithAlerts.filter(wo => wo.etaOverdue).length,
        slaBreached,
        slaAtRisk
      },
      pagination: {
        take,
        skip
      }
    });

  } catch (error) {
    console.error('❌ Error en GET /api/work-orders/dispatcher:', error);
    return NextResponse.json(
      { error: 'Error al obtener dispatcher', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
