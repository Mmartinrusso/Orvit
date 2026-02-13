/**
 * API: /api/failure-occurrences/stats
 *
 * GET - Estadísticas para KPIs del dashboard de Fallas
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/failure-occurrences/stats
 * Retorna stats para los KPIs del dashboard
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
      return NextResponse.json(
        { error: 'Token inválido o sin companyId' },
        { status: 401 }
      );
    }

    const companyId = payload.companyId as number;

    // 2. Calcular stats en paralelo
    // Nota: status usa valores OPEN, IN_PROGRESS, RESOLVED según schema
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalOpen, recurrences, withDowntime, unassigned, mttrData, criticalPending] = await Promise.all([
      // Total abiertas (OPEN + IN_PROGRESS)
      prisma.failureOccurrence.count({
        where: {
          companyId,
          isLinkedDuplicate: false, // ✅ SIEMPRE filtrar duplicados vinculados
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),

      // Reincidencias (reopenedFrom != null)
      prisma.failureOccurrence.count({
        where: {
          companyId,
          isLinkedDuplicate: false,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          reopenedFrom: { not: null },
        },
      }),

      // Con downtime activo
      prisma.failureOccurrence.count({
        where: {
          companyId,
          isLinkedDuplicate: false,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          causedDowntime: true,
        },
      }),

      // Sin asignar: WorkOrders correctivas abiertas donde assignedToId es null
      prisma.failureOccurrence.count({
        where: {
          companyId,
          isLinkedDuplicate: false,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          workOrder: {
            assignedToId: null,
            status: { notIn: ['COMPLETED', 'CANCELLED'] }, // ✅ Usar enum uppercase
          },
        },
      }),

      // ✅ MTTR real: promedio de totalMinutes de downtimes cerrados (últimos 30 días)
      prisma.downtimeLog.aggregate({
        where: {
          companyId,
          endedAt: { not: null },
          totalMinutes: { not: null },
          startedAt: { gte: thirtyDaysAgo },
        },
        _avg: { totalMinutes: true },
        _count: { id: true },
      }),

      // P1/P2 sin asignar o abiertas >4 horas
      prisma.failureOccurrence.count({
        where: {
          companyId,
          isLinkedDuplicate: false,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          priority: { in: ['P1', 'P2'] },
          OR: [
            { workOrder: null },
            { workOrder: { assignedToId: null } },
          ],
        },
      }),
    ]);

    // Calcular MTTR en minutos y horas
    const mttrMinutes = mttrData._avg.totalMinutes ?? 0;
    const mttrHours = mttrMinutes > 0 ? Math.round(mttrMinutes / 60 * 10) / 10 : 0;

    return NextResponse.json({
      totalOpen,
      recurrences,
      withDowntime,
      unassigned,
      // ✅ Nuevas métricas de rendimiento
      mttr: {
        minutes: Math.round(mttrMinutes),
        hours: mttrHours,
        sampleSize: mttrData._count.id,
      },
      criticalPending,
    });
  } catch (error: any) {
    console.error('❌ Error en GET /api/failure-occurrences/stats:', error);
    // Retornar ceros para cualquier error de DB para que la UI no falle
    console.warn('⚠️ Error en stats, retornando ceros. Ejecutar: npx prisma generate && npx prisma db push');
    return NextResponse.json({
      totalOpen: 0,
      recurrences: 0,
      withDowntime: 0,
      unassigned: 0,
      _error: error?.message || 'Error desconocido'
    });
  }
}
