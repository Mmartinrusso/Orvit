/**
 * API: /api/cron/recurrence-check
 *
 * GET - Detectar fallas recurrentes por máquina/componente
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCorrectiveSettings } from '@/lib/corrective/qa-rules';
import { notifyRecurrence } from '@/lib/discord/notifications';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/recurrence-check
 * Detecta fallas recurrentes
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🕐 Ejecutando recurrence check...');

    // 1. Obtener todas las empresas
    const companies = await prisma.company.findMany({
      select: { id: true, name: true }
    });

    const results: any[] = [];
    const now = new Date();

    for (const company of companies) {
      const settings = await getCorrectiveSettings(company.id);
      const windowDate = new Date();
      windowDate.setDate(windowDate.getDate() - settings.recurrenceWindowDays);

      // 2. Obtener fallas recientes (excluyendo duplicados)
      const recentFailures = await prisma.failureOccurrence.findMany({
        where: {
          companyId: company.id,
          reportedAt: { gte: windowDate },
          isLinkedDuplicate: false
        },
        select: {
          id: true,
          machineId: true,
          subcomponentId: true,
          componentId: true,
          failureCategory: true,
          title: true,
          reportedAt: true,
          status: true,
          priority: true,
          machine: {
            select: { id: true, name: true, sectorId: true }
          },
          component: {
            select: { id: true, name: true }
          }
        },
        orderBy: { reportedAt: 'desc' }
      });

      // 3. Agrupar por máquina + categoría + componente (criterio de reincidencia)
      const byMachineAndCategory = recentFailures.reduce((acc, f) => {
        if (!f.machineId) return acc;
        // Clave: máquina + categoría + componente (si existe)
        const key = `${f.machineId}|${f.failureCategory || 'OTRA'}|${f.componentId || 0}`;
        if (!acc[key]) {
          acc[key] = {
            machine: f.machine,
            category: f.failureCategory || 'OTRA',
            component: f.component,
            failures: []
          };
        }
        acc[key].failures.push(f);
        return acc;
      }, {} as Record<string, { machine: any; category: string; component: any; failures: any[] }>);

      // 4. Detectar recurrencias (3+ fallas en ventana según plan)
      const recurrences = Object.values(byMachineAndCategory)
        .filter(group => group.failures.length >= 3) // 3+ según plan
        .map(group => ({
          machine: group.machine,
          category: group.category,
          component: group.component,
          failureCount: group.failures.length,
          failures: group.failures.map(f => ({
            id: f.id,
            title: f.title,
            reportedAt: f.reportedAt,
            status: f.status,
            priority: f.priority
          })),
          avgDaysBetweenFailures: calculateAvgDays(group.failures.map(f => f.reportedAt))
        }))
        .sort((a, b) => b.failureCount - a.failureCount);

      if (recurrences.length > 0) {
        results.push({
          companyId: company.id,
          companyName: company.name,
          windowDays: settings.recurrenceWindowDays,
          recurrentMachines: recurrences.length,
          totalFailuresInWindow: recentFailures.length,
          recurrences
        });
      }

      // 5. Notificaciones Discord para recurrencias
      for (const recurrence of recurrences) {
        // Verificar si ya se notificó recientemente esta combinación
        const recentNotif = await prisma.notification.findFirst({
          where: {
            type: 'RECURRENCE_ALERT',
            metadata: { string_contains: `"machineId":${recurrence.machine.id},"category":"${recurrence.category}"` },
            createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } // 24 horas
          }
        });

        if (recentNotif) continue; // Ya notificado

        // Notificar Discord
        if (recurrence.machine.sectorId) {
          try {
            await notifyRecurrence({
              machineId: recurrence.machine.id,
              machineName: recurrence.machine.name,
              sectorId: recurrence.machine.sectorId,
              category: recurrence.category,
              component: recurrence.component?.name,
              occurrenceCount: recurrence.failureCount,
              windowDays: settings.recurrenceWindowDays,
              relatedFailureIds: recurrence.failures.map((f: any) => f.id),
              latestFailureId: recurrence.failures[0].id,
              latestTitle: recurrence.failures[0].title
            });
          } catch (discordError) {
            console.warn('⚠️ Error enviando notificación Discord reincidencia:', discordError);
          }
        }

        // Notificación in-app a jefes de mantenimiento
        const maintenanceLeads = await prisma.userOnCompany.findMany({
          where: {
            companyId: company.id,
            role: {
              OR: [
                { name: { contains: 'Jefe', mode: 'insensitive' } },
                { name: { contains: 'Supervisor', mode: 'insensitive' } }
              ]
            }
          },
          select: { userId: true },
          take: 3
        });

        for (const lead of maintenanceLeads) {
          await prisma.notification.create({
            data: {
              userId: lead.userId,
              type: 'RECURRENCE_ALERT',
              title: `Reincidencia: ${recurrence.machine.name}`,
              message: `${recurrence.failureCount} fallas de ${recurrence.category} en ${settings.recurrenceWindowDays} días`,
              metadata: JSON.stringify({
                machineId: recurrence.machine.id,
                category: recurrence.category,
                componentId: recurrence.component?.id,
                failureIds: recurrence.failures.map((f: any) => f.id)
              }),
              isRead: false,
              companyId: company.id
            }
          });
        }
      }
    }

    console.log(`✅ Recurrence check completado. ${results.reduce((sum, r) => sum + r.recurrentMachines, 0)} máquinas con recurrencia.`);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      companiesChecked: companies.length,
      results,
      summary: {
        totalRecurrentMachines: results.reduce((sum, r) => sum + r.recurrentMachines, 0),
        companiesWithRecurrences: results.length
      }
    });

  } catch (error) {
    console.error('❌ Error en recurrence check:', error);
    return NextResponse.json(
      { error: 'Error en recurrence check' },
      { status: 500 }
    );
  }
}

/**
 * Calcula el promedio de días entre fechas
 */
function calculateAvgDays(dates: Date[]): number {
  if (dates.length < 2) return 0;

  const sorted = dates.map(d => new Date(d).getTime()).sort((a, b) => b - a);
  let totalDays = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    totalDays += (sorted[i] - sorted[i + 1]) / (1000 * 60 * 60 * 24);
  }

  return Math.round(totalDays / (sorted.length - 1) * 10) / 10;
}
