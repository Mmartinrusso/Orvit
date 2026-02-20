/**
 * API: /api/cron/sla-check
 *
 * GET - Verificar SLA de órdenes de mantenimiento (correctivas + preventivas)
 *       Detecta órdenes que excedieron o están por exceder SLA
 *       - Correctivas: SLA basado en slaDueAt o createdAt + prioridad
 *       - Preventivas: SLA basado en scheduledDate (alerta 3 días antes)
 *       Notifica vía: Discord (canal + DM técnico) + in-app + supervisores
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCorrectiveSettings } from '@/lib/corrective/qa-rules';
import {
  notifySLAAtRisk,
  notifySLABreached,
  SLA_WARNING_THRESHOLDS,
} from '@/lib/discord/notifications';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/sla-check
 * Verifica SLA de órdenes correctivas activas
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🕐 Ejecutando SLA check...');

    // 1. Obtener todas las empresas con configuración
    const companies = await prisma.company.findMany({
      select: { id: true, name: true }
    });

    const results: any[] = [];
    const now = new Date();

    for (const company of companies) {
      const settings = await getCorrectiveSettings(company.id);

      // 2. Obtener órdenes correctivas activas
      const activeOrders = await prisma.workOrder.findMany({
        where: {
          companyId: company.id,
          type: 'CORRECTIVE',
          status: { in: ['INCOMING', 'PENDING', 'SCHEDULED', 'IN_PROGRESS', 'WAITING', 'pending', 'in_progress', 'waiting'] }
        },
        select: {
          id: true,
          title: true,
          priority: true,
          createdAt: true,
          status: true,
          assignedToId: true,
          slaDueAt: true,
          slaStatus: true
        }
      });

      // 2b. Obtener preventivos activos con scheduledDate (SLA basado en fecha programada)
      const activePreventives = await prisma.workOrder.findMany({
        where: {
          companyId: company.id,
          type: 'PREVENTIVE',
          status: { in: ['PENDING', 'SCHEDULED', 'IN_PROGRESS', 'pending'] },
          scheduledDate: { not: null }
        },
        select: {
          id: true,
          title: true,
          priority: true,
          scheduledDate: true,
          createdAt: true,
          status: true,
          assignedToId: true,
          slaStatus: true,
          sectorId: true,
          machine: { select: { name: true } },
          assignedTo: { select: { id: true, name: true } }
        }
      });

      const slaThresholds = {
        P1: settings.slaP1Hours,
        P2: settings.slaP2Hours,
        P3: settings.slaP3Hours,
        P4: settings.slaP4Hours
      };

      const violations: any[] = [];
      const warnings: any[] = [];

      for (const order of activeOrders) {
        let slaDue: Date;
        let hoursRemaining: number;

        // Usar slaDueAt si existe, sino calcular desde createdAt
        if (order.slaDueAt) {
          slaDue = new Date(order.slaDueAt);
          hoursRemaining = (slaDue.getTime() - now.getTime()) / (1000 * 60 * 60);
        } else {
          // Fallback: calcular desde createdAt
          const priority = (order.priority || 'MEDIUM') as string;
          const priorityMap: Record<string, string> = { URGENT: 'P1', HIGH: 'P2', MEDIUM: 'P3', LOW: 'P4' };
          const pKey = priorityMap[priority] || 'P3';
          const thresholdHours = slaThresholds[pKey as keyof typeof slaThresholds] || 24;

          slaDue = new Date(order.createdAt);
          slaDue.setHours(slaDue.getHours() + thresholdHours);
          hoursRemaining = (slaDue.getTime() - now.getTime()) / (1000 * 60 * 60);
        }

        // Determinar status con umbrales por prioridad
        let newSlaStatus: string;
        const priority = (order.priority || 'MEDIUM') as string;
        const priorityMap: Record<string, string> = { URGENT: 'P1', HIGH: 'P2', MEDIUM: 'P3', LOW: 'P4' };
        const pKey = priorityMap[priority] || priority;

        // Umbral de alerta según prioridad (P1<1h, P2<4h, P3<24h, P4=null)
        const warningThreshold = SLA_WARNING_THRESHOLDS[pKey as keyof typeof SLA_WARNING_THRESHOLDS];

        if (hoursRemaining < 0) {
          newSlaStatus = 'BREACHED';
          violations.push({
            workOrderId: order.id,
            title: order.title,
            priority: pKey,
            slaDueAt: slaDue.toISOString(),
            overdueHours: Math.round(Math.abs(hoursRemaining) * 10) / 10,
            status: order.status,
            assignedToId: order.assignedToId
          });
        } else if (warningThreshold !== null && hoursRemaining < warningThreshold) {
          newSlaStatus = 'AT_RISK';
          warnings.push({
            workOrderId: order.id,
            title: order.title,
            priority: pKey,
            slaDueAt: slaDue.toISOString(),
            remainingHours: Math.round(hoursRemaining * 10) / 10,
            status: order.status,
            assignedToId: order.assignedToId
          });
        } else {
          newSlaStatus = 'OK';
        }

        // Actualizar slaStatus si cambió
        if (order.slaStatus !== newSlaStatus) {
          await prisma.workOrder.update({
            where: { id: order.id },
            data: {
              slaStatus: newSlaStatus,
              slaBreachedAt: newSlaStatus === 'BREACHED' && !order.slaStatus?.includes('BREACHED')
                ? now
                : undefined
            }
          });
        }
      }

      // 3. Procesar preventivos (SLA basado en scheduledDate)
      const preventiveViolations: any[] = [];
      const preventiveWarnings: any[] = [];
      const PREVENTIVE_WARNING_DAYS = 3; // Alertar 3 días antes de vencer

      for (const pm of activePreventives) {
        if (!pm.scheduledDate) continue;

        const scheduledDate = new Date(pm.scheduledDate);
        const daysRemaining = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

        if (daysRemaining < 0) {
          // PM vencido
          const daysOverdue = Math.abs(Math.ceil(daysRemaining));
          preventiveViolations.push({
            workOrderId: pm.id,
            title: pm.title,
            priority: pm.priority || 'MEDIUM',
            scheduledDate: scheduledDate.toISOString(),
            daysOverdue,
            status: pm.status,
            assignedToId: pm.assignedToId,
            sectorId: pm.sectorId,
            machineName: pm.machine?.name,
            assignedToName: pm.assignedTo?.name
          });

          // Actualizar slaStatus
          if (pm.slaStatus !== 'BREACHED') {
            await prisma.workOrder.update({
              where: { id: pm.id },
              data: { slaStatus: 'BREACHED', slaBreachedAt: now }
            });
          }
        } else if (daysRemaining <= PREVENTIVE_WARNING_DAYS) {
          // PM próximo a vencer
          preventiveWarnings.push({
            workOrderId: pm.id,
            title: pm.title,
            priority: pm.priority || 'MEDIUM',
            scheduledDate: scheduledDate.toISOString(),
            daysRemaining: Math.ceil(daysRemaining),
            status: pm.status,
            assignedToId: pm.assignedToId,
            sectorId: pm.sectorId,
            machineName: pm.machine?.name,
            assignedToName: pm.assignedTo?.name
          });

          if (pm.slaStatus !== 'AT_RISK') {
            await prisma.workOrder.update({
              where: { id: pm.id },
              data: { slaStatus: 'AT_RISK' }
            });
          }
        }
      }

      // Notificaciones para preventivos vencidos
      for (const pv of preventiveViolations) {
        try {
          // Discord: canal de preventivos
          if (pv.sectorId) {
            try {
              await notifySLABreached({
                workOrderId: pv.workOrderId,
                title: `[PM] ${pv.title}`,
                machineName: pv.machineName,
                sectorId: pv.sectorId,
                priority: pv.priority,
                assignedTo: pv.assignedToName,
                assignedToId: pv.assignedToId,
                hoursOverdue: pv.daysOverdue * 24,
                slaDueAt: pv.scheduledDate
              });
            } catch (discordError) {
              console.warn('⚠️ Error enviando notificación Discord PM SLA:', discordError);
            }
          }

          // In-app al asignado
          if (pv.assignedToId) {
            await prisma.notification.create({
              data: {
                userId: pv.assignedToId,
                type: 'maintenance_due',
                title: `Preventivo vencido (${pv.daysOverdue} día${pv.daysOverdue !== 1 ? 's' : ''})`,
                message: `"${pv.title}" debía realizarse el ${new Date(pv.scheduledDate).toLocaleDateString('es-AR')}${pv.machineName ? ` - ${pv.machineName}` : ''}`,
                metadata: JSON.stringify({ workOrderId: pv.workOrderId, type: 'PREVENTIVE', daysOverdue: pv.daysOverdue }),
                isRead: false,
                companyId: company.id
              }
            });
          }
        } catch (notifError) {
          console.warn('⚠️ Error creando notificación PM vencido:', notifError);
        }
      }

      // Notificaciones para preventivos próximos a vencer
      for (const pw of preventiveWarnings) {
        try {
          if (pw.sectorId) {
            try {
              await notifySLAAtRisk({
                workOrderId: pw.workOrderId,
                title: `[PM] ${pw.title}`,
                machineName: pw.machineName,
                sectorId: pw.sectorId,
                priority: pw.priority,
                assignedTo: pw.assignedToName,
                assignedToId: pw.assignedToId,
                hoursRemaining: pw.daysRemaining * 24,
                slaDueAt: pw.scheduledDate
              });
            } catch (discordError) {
              console.warn('⚠️ Error enviando notificación Discord PM warning:', discordError);
            }
          }

          if (pw.assignedToId) {
            await prisma.notification.create({
              data: {
                userId: pw.assignedToId,
                type: 'work_order_due_soon',
                title: `Preventivo vence en ${pw.daysRemaining} día${pw.daysRemaining !== 1 ? 's' : ''}`,
                message: `"${pw.title}" programado para ${new Date(pw.scheduledDate).toLocaleDateString('es-AR')}${pw.machineName ? ` - ${pw.machineName}` : ''}`,
                metadata: JSON.stringify({ workOrderId: pw.workOrderId, type: 'PREVENTIVE', daysRemaining: pw.daysRemaining }),
                isRead: false,
                companyId: company.id
              }
            });
          }
        } catch (notifError) {
          console.warn('⚠️ Error creando notificación PM warning:', notifError);
        }
      }

      // Consolidar resultados
      const allViolations = [...violations, ...preventiveViolations];
      const allWarnings = [...warnings, ...preventiveWarnings];

      if (allViolations.length > 0 || allWarnings.length > 0) {
        results.push({
          companyId: company.id,
          companyName: company.name,
          violations: allViolations,
          warnings: allWarnings,
          totalActive: activeOrders.length + activePreventives.length,
          preventiveStats: {
            violations: preventiveViolations.length,
            warnings: preventiveWarnings.length,
            checked: activePreventives.length
          }
        });
      }

      // P4: Crear notificaciones y escalar para violations
      for (const violation of violations) {
        try {
          // Obtener datos adicionales para notificación Discord
          const workOrderDetails = await prisma.workOrder.findUnique({
            where: { id: violation.workOrderId },
            select: {
              sectorId: true,
              machine: { select: { name: true } },
              assignedTo: { select: { id: true, name: true } }
            }
          });

          // Notificar Discord - SLA Vencido
          if (workOrderDetails?.sectorId) {
            try {
              await notifySLABreached({
                workOrderId: violation.workOrderId,
                title: violation.title,
                machineName: workOrderDetails.machine?.name,
                sectorId: workOrderDetails.sectorId,
                priority: violation.priority,
                assignedTo: workOrderDetails.assignedTo?.name,
                assignedToId: workOrderDetails.assignedTo?.id,
                hoursOverdue: violation.overdueHours,
                slaDueAt: violation.slaDueAt
              });
            } catch (discordError) {
              console.warn('⚠️ Error enviando notificación Discord SLA:', discordError);
            }
          }

          // Notificar al supervisor (in-app)
          const supervisors = await prisma.userOnCompany.findMany({
            where: {
              companyId: company.id,
              role: { name: { contains: 'Supervisor', mode: 'insensitive' } }
            },
            select: { userId: true },
            take: 2
          });

          for (const sup of supervisors) {
            await prisma.notification.create({
              data: {
                userId: sup.userId,
                type: 'SLA_VIOLATION',
                title: 'SLA Vencido',
                message: `OT #${violation.workOrderId}: "${violation.title}" excedió SLA por ${violation.overdueHours}h`,
                metadata: JSON.stringify({ workOrderId: violation.workOrderId }),
                isRead: false,
                companyId: company.id
              }
            });
          }

          // Notificar al asignado si existe
          if (violation.assignedToId) {
            await prisma.notification.create({
              data: {
                userId: violation.assignedToId,
                type: 'SLA_VIOLATION',
                title: 'Tu OT excedió el SLA',
                message: `OT #${violation.workOrderId}: "${violation.title}" necesita atención urgente`,
                metadata: JSON.stringify({ workOrderId: violation.workOrderId }),
                isRead: false,
                companyId: company.id
              }
            });
          }
        } catch (notifError) {
          console.warn('⚠️ Error creando notificación SLA:', notifError);
        }
      }

      // P5: Notificaciones para warnings (SLA en riesgo)
      for (const warning of warnings) {
        try {
          // Obtener datos adicionales para notificación Discord
          const workOrderDetails = await prisma.workOrder.findUnique({
            where: { id: warning.workOrderId },
            select: {
              sectorId: true,
              machine: { select: { name: true } },
              assignedTo: { select: { id: true, name: true } }
            }
          });

          // Notificar Discord - SLA en riesgo
          if (workOrderDetails?.sectorId) {
            try {
              await notifySLAAtRisk({
                workOrderId: warning.workOrderId,
                title: warning.title,
                machineName: workOrderDetails.machine?.name,
                sectorId: workOrderDetails.sectorId,
                priority: warning.priority,
                assignedTo: workOrderDetails.assignedTo?.name,
                assignedToId: workOrderDetails.assignedTo?.id,
                hoursRemaining: warning.remainingHours,
                slaDueAt: warning.slaDueAt
              });
            } catch (discordError) {
              console.warn('⚠️ Error enviando notificación Discord SLA:', discordError);
            }
          }

          // Notificación in-app al asignado
          if (warning.assignedToId) {
            await prisma.notification.create({
              data: {
                userId: warning.assignedToId,
                type: 'SLA_WARNING',
                title: 'SLA por vencer',
                message: `OT #${warning.workOrderId}: "${warning.title}" vence en ${warning.remainingHours}h`,
                metadata: JSON.stringify({ workOrderId: warning.workOrderId }),
                isRead: false,
                companyId: company.id
              }
            });
          }
        } catch (notifError) {
          console.warn('⚠️ Error creando notificación SLA warning:', notifError);
        }
      }
    }

    console.log(`✅ SLA check completado. ${results.reduce((sum, r) => sum + r.violations.length, 0)} violaciones encontradas.`);

    const totalViolations = results.reduce((sum, r) => sum + r.violations.length, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
    const totalPreventiveViolations = results.reduce((sum, r) => sum + (r.preventiveStats?.violations || 0), 0);
    const totalPreventiveWarnings = results.reduce((sum, r) => sum + (r.preventiveStats?.warnings || 0), 0);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      companiesChecked: companies.length,
      results,
      summary: {
        totalViolations,
        totalWarnings,
        corrective: {
          violations: totalViolations - totalPreventiveViolations,
          warnings: totalWarnings - totalPreventiveWarnings
        },
        preventive: {
          violations: totalPreventiveViolations,
          warnings: totalPreventiveWarnings
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en SLA check:', error);
    return NextResponse.json(
      { error: 'Error en SLA check' },
      { status: 500 }
    );
  }
}
