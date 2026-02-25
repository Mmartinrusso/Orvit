/**
 * API: /api/cron/preventive-scheduler
 *
 * POST - Ejecutar scheduler de mantenimientos preventivos
 *        - Genera nuevas instancias cuando se agotan las existentes
 *        - Marca instancias vencidas como OVERDUE
 *
 * GET  - Health check con estadísticas
 *
 * Este endpoint debe ser llamado por un cron job (ej: cada hora o cada día)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { markOverdueInstances } from '@/lib/maintenance/preventive-template.repository';
import { notifyPreventiveReminder } from '@/lib/discord/notifications';

export const dynamic = 'force-dynamic';

// Función helper para ajustar fecha a día laboral
function adjustToWeekday(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  if (dayOfWeek === 0) {
    result.setDate(result.getDate() + 1);
  } else if (dayOfWeek === 6) {
    result.setDate(result.getDate() + 2);
  }
  return result;
}

export async function POST(request: NextRequest) {
  // Verificar CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const results = {
    templatesProcessed: 0,
    instancesCreated: 0,
    instancesMarkedOverdue: 0,
    errors: [] as string[]
  };

  try {
    // 1. Marcar instancias vencidas como OVERDUE (batch update)
    const overdueResult = await markOverdueInstances();
    results.instancesMarkedOverdue = overdueResult.count;

    // 2. Obtener templates activos
    const templates = await prisma.preventiveTemplate.findMany({
      where: { isActive: true },
      include: {
        instances: {
          orderBy: { scheduledDate: 'asc' },
        },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const template of templates) {
      try {
        results.templatesProcessed++;

        // 3. Verificar si necesita generar nuevas instancias
        const futureInstances = template.instances.filter(inst => {
          return (inst.status === 'PENDING' || inst.status === 'OVERDUE') &&
                 inst.scheduledDate >= today;
        });

        // Si quedan menos de 2 instancias futuras, generar más
        if (futureInstances.length < 2) {
          // Encontrar la última fecha programada
          let lastScheduledDate = today;
          if (template.instances.length > 0) {
            const dates = template.instances.map(inst => inst.scheduledDate);
            lastScheduledDate = new Date(Math.max(...dates.map(d => d.getTime())));
          }

          const instancesToCreate = 4 - futureInstances.length;
          const newInstances: { templateId: number; scheduledDate: Date; status: string }[] = [];

          for (let i = 0; i < instancesToCreate; i++) {
            const nextDate = new Date(lastScheduledDate);
            nextDate.setDate(nextDate.getDate() + ((i + 1) * template.frequencyDays));

            const adjustedDate = template.weekdaysOnly
              ? adjustToWeekday(nextDate)
              : nextDate;

            // Verificar que no exista ya una instancia para esa fecha
            const dateStr = adjustedDate.toISOString().split('T')[0];
            const existingForDate = template.instances.some(inst =>
              inst.scheduledDate.toISOString().split('T')[0] === dateStr
            );

            if (!existingForDate) {
              newInstances.push({
                templateId: template.id,
                scheduledDate: adjustedDate,
                status: 'PENDING',
              });
            }
          }

          if (newInstances.length > 0) {
            await prisma.preventiveInstance.createMany({ data: newInstances });
            results.instancesCreated += newInstances.length;
          }
        }
      } catch (templateError: any) {
        console.error(`Error procesando template ${template.id}:`, templateError);
        results.errors.push(`Template ${template.id}: ${templateError.message}`);
      }
    }

    // 4. Enviar recordatorios Discord para preventivos próximos
    let remindersSent = 0;
    for (const template of templates) {
      if (!template.sectorId || !template.nextMaintenanceDate) continue;

      const nextDate = new Date(template.nextMaintenanceDate);
      nextDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Enviar si cae dentro de los días de alerta configurados
      const alertDays = (template.alertDaysBefore as number[])?.length > 0
        ? (template.alertDaysBefore as number[])
        : [3];
      if (alertDays.includes(diffDays) || diffDays === 0) {
        notifyPreventiveReminder({
          title: template.title,
          machineName: template.machineName || 'Sin equipo',
          sectorId: template.sectorId,
          scheduledDate: nextDate.toLocaleDateString('es-AR'),
          daysUntil: diffDays,
          assignedTo: template.assignedToName || undefined,
        }).then(() => { remindersSent++; })
          .catch(err => console.warn(`Discord reminder failed for template ${template.id}:`, err.message));
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'Scheduler de preventivos ejecutado correctamente',
      duration: `${duration}ms`,
      results: { ...results, remindersSent }
    });

  } catch (error: any) {
    console.error('Error en preventive-scheduler:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error en scheduler de preventivos',
        results
      },
      { status: 500 }
    );
  }
}

// GET para verificar estado (health check)
export async function GET(request: NextRequest) {
  // Verificar CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [activeTemplates, pendingCount, overdueCount, upcomingWeek] = await Promise.all([
      prisma.preventiveTemplate.count({ where: { isActive: true } }),
      prisma.preventiveInstance.count({ where: { status: 'PENDING' } }),
      prisma.preventiveInstance.count({ where: { status: 'OVERDUE' } }),
      prisma.preventiveInstance.count({
        where: {
          status: 'PENDING',
          scheduledDate: { gte: today, lte: nextWeek },
        },
      }),
    ]);

    const totalInstances = await prisma.preventiveInstance.count();

    return NextResponse.json({
      status: 'healthy',
      data: {
        activeTemplates,
        totalInstances,
        pendingInstances: pendingCount,
        overdueInstances: overdueCount,
        upcomingThisWeek: upcomingWeek,
      },
    });

  } catch {
    return NextResponse.json(
      { status: 'error', error: 'Error al verificar estado' },
      { status: 500 }
    );
  }
}
