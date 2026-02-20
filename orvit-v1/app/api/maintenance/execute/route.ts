import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withGuards } from '@/lib/middleware/withGuards';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * Resuelve la tarifa horaria del técnico asignado.
 * Prioridad: TechnicianCostRate → env MAINTENANCE_HOURLY_RATE_DEFAULT → 25
 */
async function resolveHourlyRate(
  assignedToId: number | string | undefined,
  companyId: number | string | undefined
): Promise<number> {
  const defaultRate = parseFloat(process.env.MAINTENANCE_HOURLY_RATE_DEFAULT || '25');

  if (!assignedToId || !companyId) return defaultRate;

  try {
    const now = new Date();
    const rate = await prisma.technicianCostRate.findFirst({
      where: {
        userId: Number(assignedToId),
        companyId: Number(companyId),
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }]
      },
      orderBy: { effectiveFrom: 'desc' },
      select: { hourlyRate: true }
    });

    return rate ? parseFloat(rate.hourlyRate.toString()) : defaultRate;
  } catch {
    return defaultRate;
  }
}


export const POST = withGuards(async (request, ctx) => {
  try {
    const body = await request.json();

    const {
      maintenanceId,
      maintenanceType,
      isPreventive,
      actualDuration,
      originalDuration = null,
      actualDurationUnit = 'HOURS',
      actualValue,
      actualUnit,
      excludeQuantity = false,
      notes,
      issues,
      qualityScore,
      completionStatus,
      executedAt,
      machineId,
      machineName,
      unidadMovilId,
      unidadMovilName,
      title,
      description,
      assignedToId,
      assignedToName,
      componentIds,
      subcomponentIds,
      estimatedDuration,
      estimatedValue,
      reExecutionReason,
      companyId
    } = body;

    // Validaciones básicas
    if (!maintenanceId) {
      return NextResponse.json(
        { error: 'ID de mantenimiento es requerido' },
        { status: 400 }
      );
    }

    if (!actualDuration || actualDuration <= 0) {
      return NextResponse.json(
        { error: 'Duración real debe ser mayor a 0' },
        { status: 400 }
      );
    }

    if (!excludeQuantity && (!actualValue || actualValue <= 0)) {
      return NextResponse.json(
        { error: 'Valor real debe ser mayor a 0' },
        { status: 400 }
      );
    }

    // Verificar re-ejecución para preventivos
    if (isPreventive) {
      const template = await prisma.preventiveTemplate.findUnique({
        where: { id: Number(maintenanceId) },
        select: { lastMaintenanceDate: true },
      });

      if (template?.lastMaintenanceDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastMaintenance = new Date(template.lastMaintenanceDate);
        lastMaintenance.setHours(0, 0, 0, 0);

        if (lastMaintenance.getTime() === today.getTime() && !reExecutionReason) {
          return NextResponse.json(
            { error: 'Este mantenimiento ya fue completado hoy. Debe proporcionar una razón para re-ejecutarlo.' },
            { status: 400 }
          );
        }
      }
    }

    // Calcular métricas
    const variance = estimatedValue && actualValue && !excludeQuantity ?
      Math.round(((actualValue - estimatedValue) / estimatedValue) * 100) : null;
    const mttr = actualDuration;
    const hourlyRate = await resolveHourlyRate(assignedToId, companyId);
    const estimatedCost = actualDuration * hourlyRate;

    let updatedRecord: any = null;

    if (isPreventive) {
      // Mantenimiento preventivo - usar PreventiveTemplate
      const template = await prisma.preventiveTemplate.findUnique({
        where: { id: Number(maintenanceId) },
      });

      if (!template) {
        return NextResponse.json(
          { error: 'Mantenimiento preventivo no encontrado' },
          { status: 404 }
        );
      }

      // Calcular próxima fecha
      const nextDate = new Date();
      if (template.frequencyDays) {
        nextDate.setDate(nextDate.getDate() + template.frequencyDays);
        const dayOfWeek = nextDate.getDay();
        if (dayOfWeek === 0) nextDate.setDate(nextDate.getDate() + 1);
        else if (dayOfWeek === 6) nextDate.setDate(nextDate.getDate() + 2);
      }

      const newCount = (template.maintenanceCount || 0) + 1;
      const prevAvg = template.averageDuration || 0;
      const newAvgDuration = prevAvg === 0 ? actualDuration : ((prevAvg * (newCount - 1)) + actualDuration) / newCount;

      const existingHistory = Array.isArray(template.executionHistory)
        ? (template.executionHistory as any[])
        : [];

      const newHistoryEntry = {
        id: Date.now(),
        executedAt,
        actualDuration: actualDurationUnit === 'MINUTES' ? originalDuration : actualDuration,
        actualDurationUnit,
        actualValue: excludeQuantity ? null : actualValue,
        actualUnit: excludeQuantity ? null : actualUnit,
        notes: notes || '',
        issues: issues || '',
        variance,
        mttr,
        cost: estimatedCost,
        qualityScore: null,
        completionStatus: completionStatus || 'COMPLETED',
        reExecutionReason: reExecutionReason || null,
      };

      // Transacción atómica
      const result = await prisma.$transaction(async (tx) => {
        // 1. Actualizar template
        const updated = await tx.preventiveTemplate.update({
          where: { id: Number(maintenanceId) },
          data: {
            lastMaintenanceDate: new Date(executedAt),
            nextMaintenanceDate: nextDate,
            maintenanceCount: newCount,
            lastExecutionDuration: actualDuration,
            averageDuration: newAvgDuration,
            executionHistory: [...existingHistory, newHistoryEntry] as Prisma.InputJsonValue,
          },
        });

        // 2. Crear próxima instancia
        await tx.preventiveInstance.create({
          data: {
            templateId: Number(maintenanceId),
            scheduledDate: nextDate,
            status: 'PENDING',
          },
        });

        // La historia de ejecución preventiva se persiste en
        // executionHistory (JSON) del template (línea 187 arriba).
        // maintenance_history requiere un workOrderId FK que no existe
        // para preventiveTemplate — se omite para evitar FK violation.

        return updated;
      });

      updatedRecord = result;
    } else {
      // WorkOrder - actualizar directamente
      const existingWorkOrder = await prisma.workOrder.findUnique({
        where: { id: Number(maintenanceId) }
      });

      if (!existingWorkOrder) {
        return NextResponse.json(
          { error: 'WorkOrder no encontrado' },
          { status: 404 }
        );
      }

      updatedRecord = await prisma.workOrder.update({
        where: { id: Number(maintenanceId) },
        data: {
          status: completionStatus === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
          completedDate: completionStatus === 'COMPLETED' ? new Date(executedAt) : null,
          actualHours: actualDuration,
          notes: `${notes || ''}\n\n${excludeQuantity ? 'Cantidad excluida de este mantenimiento' : `Cantidad ejecutada: ${actualValue} ${actualUnit}`}\nProblemas encontrados: ${issues || 'Ninguno'}`,
          cost: estimatedCost,
          updatedAt: new Date()
        }
      });

      // maintenance_history para WorkOrders
      try {
        const historyMachineId = machineId ? Number(machineId) : null;
        const historyComponentId = componentIds?.length > 0 ? Number(componentIds[0]) : null;

        if (historyMachineId) {
          await prisma.maintenance_history.create({
            data: {
              workOrderId: Number(maintenanceId),
              machineId: historyMachineId,
              componentId: historyComponentId,
              executedAt: new Date(executedAt),
              executedById: assignedToId ? Number(assignedToId) : null,
              duration: actualDuration,
              cost: estimatedCost,
              notes: notes || '',
              rootCause: issues || null,
              correctiveActions: null,
              preventiveActions: null,
              spareParts: null,
              nextMaintenanceDate: null,
              mttr,
              mtbf: null,
              completionRate: 100,
              qualityScore: qualityScore || null,
              updatedAt: new Date(),
            },
          });
        }
      } catch (historyError) {
        console.error('Error guardando maintenance_history para WorkOrder:', historyError);
      }
    }

    // Respuesta exitosa
    const responseData: any = {
      success: true,
      message: 'Mantenimiento ejecutado y registrado exitosamente',
      data: {
        maintenanceId: updatedRecord.id,
        executedAt,
        duration: originalDuration || actualDuration,
        durationUnit: actualDurationUnit,
        mttr,
        cost: estimatedCost,
        type: isPreventive ? 'PREVENTIVE' : 'CORRECTIVE',
      },
    };

    if (isPreventive) {
      responseData.data.nextMaintenanceDate = updatedRecord.nextMaintenanceDate?.toISOString();
      responseData.data.maintenanceCount = updatedRecord.maintenanceCount;
    } else {
      responseData.data.status = updatedRecord.status;
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error ejecutando mantenimiento:', error);
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
});
