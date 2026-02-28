/**
 * API: /api/cron/unassigned-failures-check
 *
 * GET - Verificar fallas sin asignar que superan el umbral
 *       Umbrales por prioridad:
 *       - P1: > 15 minutos
 *       - P2: > 60 minutos
 *       - P3/P4: Solo en resumen diario
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  notifyUnassignedFailure,
  UNASSIGNED_FAILURE_THRESHOLDS,
} from '@/lib/discord/notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Ejecutando verificación de fallas sin asignar...');

    const now = new Date();
    const results: Array<{
      failureId: number;
      title: string;
      priority: string;
      minutesWaiting: number;
      notified: boolean;
    }> = [];

    // Obtener fallas abiertas sin OT asignada
    const unassignedFailures = await prisma.failureOccurrence.findMany({
      where: {
        status: { in: ['REPORTED', 'IN_PROGRESS'] },
        // No tiene OT o la OT no tiene asignado
        OR: [
          { workOrder: null },
          { workOrder: { assignedToId: null } }
        ]
      },
      select: {
        id: true,
        title: true,
        priority: true,
        reportedAt: true,
        causedDowntime: true,
        machineId: true,
        machine: {
          select: {
            name: true,
            sectorId: true
          }
        },
        reporter: {
          select: { name: true }
        },
        // Verificar si ya se notificó recientemente (evitar spam)
        companyId: true
      },
      orderBy: { reportedAt: 'asc' }
    });

    for (const failure of unassignedFailures) {
      const priority = failure.priority || 'P3';
      const threshold = UNASSIGNED_FAILURE_THRESHOLDS[priority as keyof typeof UNASSIGNED_FAILURE_THRESHOLDS];

      // Si no hay umbral para esta prioridad, saltar
      if (threshold === null) {
        continue;
      }

      // Calcular tiempo de espera en minutos
      const minutesWaiting = Math.floor(
        (now.getTime() - new Date(failure.reportedAt).getTime()) / 60000
      );

      // Si no superó el umbral, saltar
      if (minutesWaiting < threshold) {
        continue;
      }

      // Verificar si ya se notificó en las últimas 2 horas (anti-spam)
      const recentNotification = await prisma.notification.findFirst({
        where: {
          type: 'UNASSIGNED_FAILURE',
          metadata: { string_contains: `"failureId":${failure.id}` },
          createdAt: { gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) } // 2 horas
        }
      });

      if (recentNotification) {
        results.push({
          failureId: failure.id,
          title: failure.title,
          priority,
          minutesWaiting,
          notified: false // Ya notificado recientemente
        });
        continue;
      }

      // Enviar notificación Discord
      if (failure.machine?.sectorId) {
        try {
          await notifyUnassignedFailure({
            failureId: failure.id,
            title: failure.title,
            machineName: failure.machine.name,
            sectorId: failure.machine.sectorId,
            priority,
            minutesWaiting,
            reportedBy: failure.reporter?.name || 'Usuario',
            causedDowntime: failure.causedDowntime || false
          });

          // Crear notificación in-app para supervisores
          const supervisors = await prisma.userOnCompany.findMany({
            where: {
              companyId: failure.companyId,
              role: { name: { contains: 'Supervisor', mode: 'insensitive' } }
            },
            select: { userId: true },
            take: 3
          });

          for (const sup of supervisors) {
            await prisma.notification.create({
              data: {
                userId: sup.userId,
                type: 'UNASSIGNED_FAILURE',
                title: `Falla ${priority} sin asignar`,
                message: `F-${failure.id}: "${failure.title}" lleva ${minutesWaiting} min sin asignar`,
                metadata: JSON.stringify({ failureId: failure.id }),
                isRead: false,
                companyId: failure.companyId
              }
            });
          }

          results.push({
            failureId: failure.id,
            title: failure.title,
            priority,
            minutesWaiting,
            notified: true
          });
        } catch (notifyError) {
          console.warn(`⚠️ Error notificando falla ${failure.id}:`, notifyError);
          results.push({
            failureId: failure.id,
            title: failure.title,
            priority,
            minutesWaiting,
            notified: false
          });
        }
      }
    }

    const notifiedCount = results.filter(r => r.notified).length;
    console.log(`✅ Verificación completada. ${notifiedCount} fallas notificadas de ${results.length} encontradas.`);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      totalFound: results.length,
      notified: notifiedCount,
      details: results
    });

  } catch (error: any) {
    console.error('❌ Error en unassigned-failures-check:', error);
    return NextResponse.json(
      { error: 'Error verificando fallas sin asignar', detail: error?.message },
      { status: 500 }
    );
  }
}
