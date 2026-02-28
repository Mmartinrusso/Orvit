/**
 * GET /api/cron/process-solution-controls
 *
 * Cron job: each 15 minutes
 * 1. Find PENDING controls with scheduledAt <= now → notify + mark NOTIFIED
 * 2. Find NOTIFIED controls with scheduledAt < (now - 2h) → mark OVERDUE + notify supervisor
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  notifySolutionControlDue,
  notifySolutionControlOverdue,
} from '@/lib/discord/notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const overdueThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2h ago

    console.log('[CRON] process-solution-controls at:', now.toISOString());

    // ─── Step 1: PENDING → NOTIFIED ────────────────────────────────────────
    const dueControls = await prisma.solutionControlInstance.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: now },
        notifiedAt: null,
      },
      include: {
        solutionApplied: {
          select: {
            id: true,
            title: true,
            performedById: true,
            performedBy: { select: { id: true, name: true } },
            failureOccurrence: {
              select: {
                machine: {
                  select: { name: true, sectorId: true },
                },
              },
            },
          },
        },
      },
    });

    console.log(`[CRON] Found ${dueControls.length} due controls`);

    for (const ctrl of dueControls) {
      const sa = ctrl.solutionApplied;
      const machineName = sa.failureOccurrence?.machine?.name ?? 'Máquina desconocida';
      const sectorId = sa.failureOccurrence?.machine?.sectorId ?? null;
      const techId = sa.performedById;
      const techName = sa.performedBy?.name ?? 'Técnico';

      // In-app notification → technician
      await prisma.notification.create({
        data: {
          type: 'SOLUTION_CONTROL_DUE',
          title: 'Control de solución pendiente',
          message: `Control #${ctrl.order}: "${ctrl.description}" para solución en ${machineName}`,
          userId: techId,
          companyId: ctrl.companyId,
          metadata: {
            solutionAppliedId: sa.id,
            controlInstanceId: ctrl.id,
            controlOrder: ctrl.order,
          },
        },
      });

      // Notify supervisor of sector (if any)
      if (sectorId) {
        const supervisor = await prisma.user.findFirst({
          where: {
            companyId: ctrl.companyId,
            isActive: true,
            OR: [
              { customRole: { permissions: { some: { permission: { name: 'mantenimiento.gestionar' } } } } },
            ],
          },
          select: { id: true },
        });
        if (supervisor && supervisor.id !== techId) {
          await prisma.notification.create({
            data: {
              type: 'SOLUTION_CONTROL_DUE',
              title: 'Control de solución pendiente',
              message: `[Supervisión] Control #${ctrl.order} de "${sa.title ?? 'Solución'}" en ${machineName} requiere atención`,
              userId: supervisor.id,
              companyId: ctrl.companyId,
              metadata: {
                solutionAppliedId: sa.id,
                controlInstanceId: ctrl.id,
                controlOrder: ctrl.order,
              },
            },
          });
        }

        // Discord
        if (sectorId) {
          notifySolutionControlDue({
            controlInstanceId: ctrl.id,
            controlOrder: ctrl.order,
            controlDescription: ctrl.description,
            solutionTitle: sa.title ?? 'Solución aplicada',
            machineName,
            technicianName: techName,
            scheduledAt: ctrl.scheduledAt!,
            sectorId,
          }).catch((err) => {
            console.error('[CRON] Discord notifySolutionControlDue error:', err);
          });
        }
      }

      // Mark as NOTIFIED
      await prisma.solutionControlInstance.update({
        where: { id: ctrl.id },
        data: { status: 'NOTIFIED', notifiedAt: now },
      });
    }

    // ─── Step 2: NOTIFIED + old → OVERDUE ──────────────────────────────────
    const overdueControls = await prisma.solutionControlInstance.findMany({
      where: {
        status: 'NOTIFIED',
        scheduledAt: { lt: overdueThreshold },
      },
      include: {
        solutionApplied: {
          select: {
            id: true,
            title: true,
            performedById: true,
            failureOccurrence: {
              select: {
                machine: { select: { name: true, sectorId: true } },
              },
            },
          },
        },
      },
    });

    console.log(`[CRON] Found ${overdueControls.length} overdue controls`);

    for (const ctrl of overdueControls) {
      const sa = ctrl.solutionApplied;
      const machineName = sa.failureOccurrence?.machine?.name ?? 'Máquina desconocida';
      const sectorId = sa.failureOccurrence?.machine?.sectorId ?? null;

      // Mark OVERDUE
      await prisma.solutionControlInstance.update({
        where: { id: ctrl.id },
        data: { status: 'OVERDUE' },
      });

      // In-app to technician
      await prisma.notification.create({
        data: {
          type: 'SOLUTION_CONTROL_OVERDUE',
          title: 'Control de solución vencido',
          message: `Control #${ctrl.order}: "${ctrl.description}" en ${machineName} está vencido sin completar`,
          userId: sa.performedById,
          companyId: ctrl.companyId,
          metadata: {
            solutionAppliedId: sa.id,
            controlInstanceId: ctrl.id,
            controlOrder: ctrl.order,
          },
        },
      });

      // Discord
      if (sectorId) {
        notifySolutionControlOverdue({
          controlInstanceId: ctrl.id,
          controlOrder: ctrl.order,
          controlDescription: ctrl.description,
          solutionTitle: sa.title ?? 'Solución aplicada',
          machineName,
          scheduledAt: ctrl.scheduledAt!,
          sectorId,
        }).catch((err) => {
          console.error('[CRON] Discord notifySolutionControlOverdue error:', err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      notified: dueControls.length,
      markedOverdue: overdueControls.length,
    });
  } catch (error: any) {
    console.error('[CRON] process-solution-controls error:', error);
    return NextResponse.json({ error: 'Error processing controls', details: error.message }, { status: 500 });
  }
}
