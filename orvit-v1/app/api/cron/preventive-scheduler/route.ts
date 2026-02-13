/**
 * API: /api/cron/preventive-scheduler
 *
 * POST - Ejecutar scheduler de mantenimientos preventivos
 *        - Genera nuevas instancias cuando se agotan las existentes
 *        - Envía alertas de vencimiento próximo
 *        - Marca instancias vencidas como OVERDUE
 *
 * Este endpoint debe ser llamado por un cron job (ej: cada hora o cada día)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface TemplateData {
  templateType: string;
  title: string;
  description?: string;
  priority?: string;
  frequencyDays: number;
  estimatedHours?: number;
  alertDaysBefore?: number[];
  machineId?: number;
  unidadMovilId?: number;
  machineName: string;
  componentIds?: number[];
  componentNames?: string[];
  assignedToId?: number;
  assignedToName?: string;
  companyId: number;
  sectorId: number;
  createdById: number;
  isActive: boolean;
  nextMaintenanceDate: string;
  lastMaintenanceDate?: string;
  weekdaysOnly?: boolean;
  maintenanceCount: number;
  executionWindow?: string;
  timeUnit?: string;
  timeValue?: number;
}

interface InstanceData extends TemplateData {
  templateId: string;
  scheduledDate: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
  actualStartDate?: string;
  actualEndDate?: string;
  actualHours?: number;
  completedById?: number;
}

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

// Función para crear una instancia de mantenimiento
async function createMaintenanceInstance(
  templateId: string,
  templateData: TemplateData,
  scheduledDate: Date
) {
  const instance = await prisma.document.create({
    data: {
      entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
      entityId: `template-${templateId}-${scheduledDate.toISOString().split('T')[0]}`,
      originalName: `${templateData.title} - ${scheduledDate.toLocaleDateString('es-ES')}`,
      url: JSON.stringify({
        ...templateData,
        templateId,
        scheduledDate: scheduledDate.toISOString(),
        status: 'PENDING',
        actualStartDate: null,
        actualEndDate: null,
        actualHours: null,
        completedById: null,
        completionNotes: '',
        toolsUsed: [],
        photoUrls: [],
        createdAt: new Date().toISOString()
      })
    }
  });

  return instance;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const results = {
    templatesProcessed: 0,
    instancesCreated: 0,
    instancesMarkedOverdue: 0,
    alertsSent: 0,
    errors: [] as string[]
  };

  try {
    console.log('🔄 [Preventive Scheduler] Iniciando ejecución...');

    // 1. Obtener todos los templates de mantenimiento preventivo
    const templates = await prisma.document.findMany({
      where: {
        entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE'
      }
    });

    console.log(`📋 Encontrados ${templates.length} templates de preventivo`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const template of templates) {
      try {
        const templateData: TemplateData = JSON.parse(template.url);

        // Saltar templates inactivos
        if (!templateData.isActive) {
          continue;
        }

        results.templatesProcessed++;

        // 2. Obtener instancias existentes del template
        const instances = await prisma.document.findMany({
          where: {
            entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
            entityId: {
              startsWith: `template-${template.id}`
            }
          },
          orderBy: { createdAt: 'asc' }
        });

        // Parsear instancias
        const parsedInstances = instances.map(inst => {
          try {
            return {
              id: inst.id,
              ...JSON.parse(inst.url) as InstanceData
            };
          } catch {
            return null;
          }
        }).filter(Boolean) as (InstanceData & { id: number })[];

        // 3. Marcar instancias vencidas como OVERDUE
        for (const instance of parsedInstances) {
          if (instance.status === 'PENDING') {
            const scheduledDate = new Date(instance.scheduledDate);
            scheduledDate.setHours(0, 0, 0, 0);

            if (scheduledDate < today) {
              // Marcar como OVERDUE
              const originalDoc = instances.find(i => i.id === instance.id);
              if (originalDoc) {
                await prisma.document.update({
                  where: { id: originalDoc.id },
                  data: {
                    url: JSON.stringify({
                      ...instance,
                      status: 'OVERDUE'
                    })
                  }
                });
                results.instancesMarkedOverdue++;
                console.log(`⚠️ Instancia ${instance.id} marcada como OVERDUE`);
              }
            }
          }
        }

        // 4. Verificar si necesita generar nuevas instancias
        const pendingInstances = parsedInstances.filter(
          inst => inst.status === 'PENDING' || inst.status === 'OVERDUE'
        );

        const futureInstances = pendingInstances.filter(inst => {
          const scheduledDate = new Date(inst.scheduledDate);
          return scheduledDate >= today;
        });

        // Si quedan menos de 2 instancias futuras, generar más
        if (futureInstances.length < 2) {
          // Encontrar la última fecha programada
          let lastScheduledDate = today;

          if (parsedInstances.length > 0) {
            const dates = parsedInstances.map(inst => new Date(inst.scheduledDate));
            lastScheduledDate = new Date(Math.max(...dates.map(d => d.getTime())));
          }

          // Generar instancias para mantener al menos 4 futuras
          const instancesToCreate = 4 - futureInstances.length;

          for (let i = 0; i < instancesToCreate; i++) {
            const nextDate = new Date(lastScheduledDate);
            nextDate.setDate(nextDate.getDate() + ((i + 1) * templateData.frequencyDays));

            // Ajustar a día laboral si es necesario
            const adjustedDate = templateData.weekdaysOnly !== false
              ? adjustToWeekday(nextDate)
              : nextDate;

            // Verificar que no exista ya una instancia para esa fecha
            const dateStr = adjustedDate.toISOString().split('T')[0];
            const existingForDate = instances.some(inst =>
              inst.entityId === `template-${template.id}-${dateStr}`
            );

            if (!existingForDate) {
              await createMaintenanceInstance(
                template.id.toString(),
                templateData,
                adjustedDate
              );
              results.instancesCreated++;
              console.log(`✅ Nueva instancia creada para ${templateData.title} - ${dateStr}`);
            }
          }
        }

        // 5. Enviar alertas para instancias próximas
        const alertDays = templateData.alertDaysBefore || [3, 1];

        // TODO: Agregar notificación Discord cuando esté implementado
        // Las alertas se enviarán a los canales de Discord correspondientes

      } catch (templateError: any) {
        console.error(`Error procesando template ${template.id}:`, templateError);
        results.errors.push(`Template ${template.id}: ${templateError.message}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [Preventive Scheduler] Completado en ${duration}ms`, results);

    return NextResponse.json({
      success: true,
      message: 'Scheduler de preventivos ejecutado correctamente',
      duration: `${duration}ms`,
      results
    });

  } catch (error: any) {
    console.error('❌ [Preventive Scheduler] Error:', error);
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
export async function GET() {
  try {
    // Contar templates activos
    const templates = await prisma.document.findMany({
      where: { entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE' }
    });

    const activeTemplates = templates.filter(t => {
      try {
        const data = JSON.parse(t.url);
        return data.isActive;
      } catch {
        return false;
      }
    }).length;

    // Contar instancias pendientes
    const instances = await prisma.document.findMany({
      where: { entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE' }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let pendingCount = 0;
    let overdueCount = 0;
    let upcomingWeek = 0;

    for (const inst of instances) {
      try {
        const data = JSON.parse(inst.url);
        if (data.status === 'PENDING') {
          pendingCount++;
          const scheduledDate = new Date(data.scheduledDate);
          scheduledDate.setHours(0, 0, 0, 0);

          if (scheduledDate < today) {
            overdueCount++;
          } else if (scheduledDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)) {
            upcomingWeek++;
          }
        } else if (data.status === 'OVERDUE') {
          overdueCount++;
        }
      } catch {
        // Ignorar
      }
    }

    return NextResponse.json({
      status: 'healthy',
      data: {
        activeTemplates,
        totalInstances: instances.length,
        pendingInstances: pendingCount,
        overdueInstances: overdueCount,
        upcomingThisWeek: upcomingWeek
      }
    });

  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: 'Error al verificar estado' },
      { status: 500 }
    );
  }
}
