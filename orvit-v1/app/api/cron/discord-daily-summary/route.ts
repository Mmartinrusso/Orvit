/**
 * API: /api/cron/discord-daily-summary
 *
 * POST - Enviar resumen del día a Discord para cada sector
 * Programar para ejecutar a las 18:00 todos los días
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendDailySummary, type DailySummaryData } from '@/lib/discord/notifications';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verificar token de cron (opcional pero recomendado)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Permitir sin auth en desarrollo
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
    }

    // Obtener fecha de hoy
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const dateStr = today.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Obtener todos los sectores con webhook o channelId configurado
    const sectors = await prisma.sector.findMany({
      where: {
        OR: [
          { discordResumenDiaWebhook: { not: null } },
          { discordResumenChannelId: { not: null } }
        ]
      },
      select: {
        id: true,
        name: true,
        companyId: true
      }
    });

    if (sectors.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay sectores configurados para resumen Discord',
        sectorsProcessed: 0
      });
    }

    const results: Array<{ sectorId: number; sectorName: string; success: boolean; error?: string }> = [];

    for (const sector of sectors) {
      try {
        // Estadísticas de fallas del día
        const [newFailures, resolvedFailures, pendingFailures] = await Promise.all([
          prisma.failureOccurrence.count({
            where: {
              companyId: sector.companyId,
              machine: { sectorId: sector.id },
              reportedAt: { gte: startOfDay, lte: endOfDay }
            }
          }),
          prisma.failureOccurrence.count({
            where: {
              companyId: sector.companyId,
              machine: { sectorId: sector.id },
              resolvedAt: { gte: startOfDay, lte: endOfDay }
            }
          }),
          prisma.failureOccurrence.count({
            where: {
              companyId: sector.companyId,
              machine: { sectorId: sector.id },
              status: { in: ['OPEN', 'IN_PROGRESS'] }
            }
          })
        ]);

        // Estadísticas de OTs del día
        const [completedOTs, pendingOTs, waitingOTs] = await Promise.all([
          prisma.workOrder.count({
            where: {
              companyId: sector.companyId,
              sectorId: sector.id,
              completedDate: { gte: startOfDay, lte: endOfDay }
            }
          }),
          prisma.workOrder.count({
            where: {
              companyId: sector.companyId,
              sectorId: sector.id,
              status: 'IN_PROGRESS'
            }
          }),
          prisma.workOrder.count({
            where: {
              companyId: sector.companyId,
              sectorId: sector.id,
              status: 'WAITING'
            }
          })
        ]);

        // Estadísticas de preventivos del día
        const scheduledPreventives = await prisma.preventiveSchedule.count({
          where: {
            companyId: sector.companyId,
            template: {
              machine: { sectorId: sector.id }
            },
            scheduledDate: { gte: startOfDay, lte: endOfDay }
          }
        });

        const completedPreventives = await prisma.preventiveExecution.count({
          where: {
            companyId: sector.companyId,
            schedule: {
              template: {
                machine: { sectorId: sector.id }
              }
            },
            executedAt: { gte: startOfDay, lte: endOfDay }
          }
        });

        // Calcular downtime total (si hay registros de downtime)
        let totalDowntimeMinutes = 0;
        try {
          const downtimes = await prisma.downtimeRecord.findMany({
            where: {
              companyId: sector.companyId,
              machine: { sectorId: sector.id },
              OR: [
                { startedAt: { gte: startOfDay, lte: endOfDay } },
                { endedAt: { gte: startOfDay, lte: endOfDay } }
              ]
            },
            select: {
              startedAt: true,
              endedAt: true
            }
          });

          for (const dt of downtimes) {
            const start = dt.startedAt < startOfDay ? startOfDay : dt.startedAt;
            const end = dt.endedAt ? (dt.endedAt > endOfDay ? endOfDay : dt.endedAt) : endOfDay;
            totalDowntimeMinutes += Math.round((end.getTime() - start.getTime()) / 60000);
          }
        } catch {
          // Tabla puede no existir
        }

        // Obtener pendientes para mañana
        const pendingItems: Array<{ type: string; title: string }> = [];

        // Fallas pendientes
        const pendingFailuresList = await prisma.failureOccurrence.findMany({
          where: {
            companyId: sector.companyId,
            machine: { sectorId: sector.id },
            status: { in: ['OPEN', 'IN_PROGRESS'] }
          },
          select: { id: true, title: true },
          take: 3
        });
        pendingFailuresList.forEach(f => pendingItems.push({ type: 'Falla', title: `#${f.id} ${f.title}` }));

        // OTs pendientes
        const pendingOTsList = await prisma.workOrder.findMany({
          where: {
            companyId: sector.companyId,
            sectorId: sector.id,
            status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING'] }
          },
          select: { id: true, title: true },
          take: 3
        });
        pendingOTsList.forEach(ot => pendingItems.push({ type: 'OT', title: `#${ot.id} ${ot.title}` }));

        // Enviar resumen
        const summaryData: DailySummaryData = {
          sectorId: sector.id,
          sectorName: sector.name,
          date: dateStr,
          stats: {
            newFailures,
            resolvedFailures,
            pendingFailures,
            completedOTs,
            pendingOTs,
            waitingOTs,
            completedPreventives,
            scheduledPreventives,
            totalDowntimeMinutes: totalDowntimeMinutes > 0 ? totalDowntimeMinutes : undefined
          },
          pendingItems: pendingItems.length > 0 ? pendingItems : undefined
        };

        await sendDailySummary(summaryData);

        results.push({
          sectorId: sector.id,
          sectorName: sector.name,
          success: true
        });

      } catch (sectorError: any) {
        console.error(`❌ Error procesando sector ${sector.name}:`, sectorError);
        results.push({
          sectorId: sector.id,
          sectorName: sector.name,
          success: false,
          error: sectorError?.message || 'Error desconocido'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Resumen enviado a ${successCount} sectores${failCount > 0 ? `, ${failCount} errores` : ''}`,
      sectorsProcessed: successCount,
      errors: failCount,
      details: results
    });

  } catch (error: any) {
    console.error('❌ Error en cron discord-daily-summary:', error);
    return NextResponse.json(
      { error: 'Error al enviar resumen diario', detail: error?.message },
      { status: 500 }
    );
  }
}

// GET para pruebas manuales
export async function GET(request: NextRequest) {
  return POST(request);
}
