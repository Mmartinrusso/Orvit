import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateRoutineExecutionSchema } from '@/lib/validations/production';

export const dynamic = 'force-dynamic';

// GET /api/production/routines - List routine executions
export async function GET(request: Request) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.RUTINAS.VIEW);
    if (error) return error;
    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);

    const templateId = searchParams.get('templateId');
    const workCenterId = searchParams.get('workCenterId');
    const shiftId = searchParams.get('shiftId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const hasIssues = searchParams.get('hasIssues');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = { companyId };

    if (templateId) where.templateId = parseInt(templateId);
    if (workCenterId) where.workCenterId = parseInt(workCenterId);
    if (shiftId) where.shiftId = parseInt(shiftId);
    if (hasIssues === 'true') where.hasIssues = true;
    if (hasIssues === 'false') where.hasIssues = false;

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const [routines, total, stats] = await Promise.all([
      prisma.productionRoutine.findMany({
        where,
        include: {
          template: {
            select: { id: true, code: true, name: true, type: true }
          },
          workCenter: {
            select: { id: true, name: true, code: true }
          },
          shift: {
            select: { id: true, name: true }
          },
          executedBy: {
            select: { id: true, name: true }
          },
        },
        orderBy: { executedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.productionRoutine.count({ where }),
      // Stats
      prisma.productionRoutine.aggregate({
        where,
        _count: { id: true },
      }).then(async (count) => {
        const withIssues = await prisma.productionRoutine.count({
          where: { ...where, hasIssues: true }
        });
        return {
          totalExecutions: count._count.id,
          withIssues,
          withoutIssues: count._count.id - withIssues,
        };
      }),
    ]);

    return NextResponse.json({
      success: true,
      routines,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching routines:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener rutinas' },
      { status: 500 }
    );
  }
}

// POST /api/production/routines - Execute a routine (or complete a draft)
export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.RUTINAS.EXECUTE);
    if (error) return error;
    const userId = user!.id;
    const companyId = user!.companyId;
    const body = await request.json();

    const validation = validateRequest(CreateRoutineExecutionSchema, body);
    if (!validation.success) return validation.response;

    const {
      draftId,
      templateId,
      workCenterId,
      shiftId,
      date,
      responses,
      hasIssues,
      issueDescription,
      linkedDowntimeId,
      linkedWorkOrderId,
    } = validation.data;

    // Verify template exists
    const template = await prisma.productionRoutineTemplate.findFirst({
      where: { id: templateId, companyId, isActive: true },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Plantilla no encontrada o inactiva' },
        { status: 404 }
      );
    }

    let routine;

    // If draftId provided, update existing routine
    if (draftId) {
      const existingRoutine = await prisma.productionRoutine.findFirst({
        where: { id: draftId, companyId },
      });

      if (!existingRoutine) {
        return NextResponse.json(
          { success: false, error: 'Rutina no encontrada' },
          { status: 404 }
        );
      }

      routine = await prisma.productionRoutine.update({
        where: { id: draftId },
        data: {
          status: 'COMPLETED',
          workCenterId: workCenterId || template.workCenterId,
          shiftId: shiftId || null,
          date: new Date(), // Use current date when completing
          responses: responses || [],
          hasIssues: hasIssues || false,
          issueDescription: issueDescription || null,
          linkedDowntimeId: linkedDowntimeId || null,
          linkedWorkOrderId: linkedWorkOrderId || null,
          executedAt: new Date(),
        },
        include: {
          template: {
            select: { id: true, code: true, name: true, type: true }
          },
          workCenter: {
            select: { id: true, name: true, code: true }
          },
          shift: {
            select: { id: true, name: true }
          },
          executedBy: {
            select: { id: true, name: true }
          },
        },
      });
    } else {
      // Create new execution (without draft)
      routine = await prisma.productionRoutine.create({
        data: {
          templateId,
          workCenterId: workCenterId || template.workCenterId,
          shiftId: shiftId || null,
          date: new Date(),
          responses: responses || [],
          hasIssues: hasIssues || false,
          issueDescription: issueDescription || null,
          linkedDowntimeId: linkedDowntimeId || null,
          linkedWorkOrderId: linkedWorkOrderId || null,
          executedById: userId,
          executedAt: new Date(),
          companyId,
        },
        include: {
          template: {
            select: { id: true, code: true, name: true, type: true }
          },
          workCenter: {
            select: { id: true, name: true, code: true }
          },
          shift: {
            select: { id: true, name: true }
          },
          executedBy: {
            select: { id: true, name: true }
          },
        },
      });
    }

    // ========================================================================
    // POST-PROCESSING: Sync attendance to payroll + schedule photo reminders
    // ========================================================================
    try {
      const templateItems = template.items as any;
      const allInputs = extractAllInputs(templateItems);
      const routineDate = date ? new Date(date) : new Date();

      // 1. Sync attendance to payroll (AttendanceEvent)
      for (const input of allInputs) {
        if (input.type === 'EMPLOYEE_SELECT' && input.employeeSelectConfig?.attendanceTracking) {
          const responseData = findResponseForInput(responses, input.id);
          if (!responseData?.value || !Array.isArray(responseData.value)) continue;

          const absentEmployees = responseData.value.filter(
            (e: any) => e.status === 'ABSENT' && e.absenceReasonId
          );

          if (absentEmployees.length === 0) continue;

          // Find active payroll period for this date
          const period = await prisma.payrollPeriod.findFirst({
            where: {
              company_id: companyId,
              start_date: { lte: routineDate },
              end_date: { gte: routineDate },
              status: { not: 'CLOSED' },
            },
          });

          if (period) {
            const absenceReasons = input.employeeSelectConfig.absenceReasons || [];
            for (const emp of absentEmployees) {
              const reason = absenceReasons.find((r: any) => r.id === emp.absenceReasonId);
              const eventType = reason?.payrollEventType || 'ABSENCE';

              // Check if already registered for this employee+date to avoid duplicates
              const existing = await prisma.attendanceEvent.findFirst({
                where: {
                  period_id: period.id,
                  employee_id: emp.employeeId.toString(),
                  event_date: routineDate,
                  source: 'ROUTINE',
                },
              });

              if (!existing) {
                await prisma.attendanceEvent.create({
                  data: {
                    period_id: period.id,
                    employee_id: emp.employeeId.toString(),
                    event_type: eventType,
                    event_date: routineDate,
                    quantity: 1,
                    comment: `Registrado desde rutina: ${template.name}${reason ? ` - ${reason.label}` : ''}`,
                    source: 'ROUTINE',
                    created_by: userId,
                  },
                });
              }
            }
          }
        }
      }

      // 2. Schedule photo timer notifications
      for (const input of allInputs) {
        if (input.type === 'PHOTO' && input.photoTimerConfig?.delayMinutes) {
          const responseData = findResponseForInput(responses, input.id);
          if (!responseData?.photos || responseData.photos.length === 0) continue;

          try {
            const { addJob, QUEUE_NAMES } = await import('@/lib/jobs/queue-manager');
            await addJob(QUEUE_NAMES.NOTIFICATIONS, 'photo-timer', {
              type: 'routine_photo_timer',
              companyId,
              recipients: [userId],
              title: 'Recordatorio de rutina',
              message: input.photoTimerConfig.reminderMessage || 'Continuar con la siguiente tarea',
              channels: ['inapp'],
              data: { routineId: routine.id, inputId: input.id },
            }, {
              delay: input.photoTimerConfig.delayMinutes * 60 * 1000,
            });
          } catch (notifError) {
            console.error('Error scheduling photo timer notification:', notifError);
          }
        }
      }
    } catch (postProcessError) {
      // Post-processing errors should not fail the routine save
      console.error('Error in post-processing (attendance/notifications):', postProcessError);
    }

    return NextResponse.json({
      success: true,
      routine,
      suggestWorkOrder: hasIssues && !linkedWorkOrderId,
    }, { status: 201 });
  } catch (error) {
    console.error('Error executing routine:', error);
    return NextResponse.json(
      { success: false, error: 'Error al ejecutar rutina' },
      { status: 500 }
    );
  }
}

// Helper: Extract all inputs from template items (handles both flat and hierarchical)
function extractAllInputs(templateItems: any): any[] {
  const inputs: any[] = [];

  if (!templateItems) return inputs;

  // Hierarchical structure with groups
  if (templateItems.groups && Array.isArray(templateItems.groups)) {
    for (const group of templateItems.groups) {
      if (group.items && Array.isArray(group.items)) {
        for (const item of group.items) {
          if (item.inputs && Array.isArray(item.inputs)) {
            inputs.push(...item.inputs);
          }
        }
      }
    }
  }

  // Flat structure with items
  if (templateItems.items && Array.isArray(templateItems.items)) {
    for (const item of templateItems.items) {
      if (item.inputs && Array.isArray(item.inputs)) {
        inputs.push(...item.inputs);
      }
    }
  }

  // Direct items array (old format)
  if (Array.isArray(templateItems)) {
    for (const item of templateItems) {
      if (item.inputs && Array.isArray(item.inputs)) {
        inputs.push(...item.inputs);
      }
    }
  }

  return inputs;
}

// Helper: Find response data for a specific input ID
function findResponseForInput(responses: any, inputId: string): any {
  if (!responses || !Array.isArray(responses)) return null;

  for (const resp of responses) {
    if (resp.inputs && Array.isArray(resp.inputs)) {
      const found = resp.inputs.find((inp: any) => inp.inputId === inputId);
      if (found) return found;
    }
    // Direct match (pre-execution responses format)
    if (resp.inputId === inputId) return resp;
  }
  return null;
}
