import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withGuards } from '@/lib/middleware/withGuards';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Clasificación de tipos de ítems de pañol
const CONSUMABLE_TYPES = ['SPARE_PART', 'CONSUMABLE', 'MATERIAL'];
const TOOL_TYPES = ['TOOL', 'HAND_TOOL'];
const isConsumableType = (type: string) => CONSUMABLE_TYPES.includes(type);
const isToolItemType = (type: string) => TOOL_TYPES.includes(type);

type ResourceInput = {
  reservationId: number | null;
  toolId: number | null;
  toolName: string;
  toolItemType: string;
  usedQuantity: number;
  returnedDamaged: boolean;
  isAdHoc: boolean;
};

/**
 * Procesa confirmaciones de recursos utilizados en la ejecución.
 * Maneja 3 casos: reservación existente, ad-hoc con toolId, preventivo sin toolId.
 */
async function processResources(
  tx: Prisma.TransactionClient,
  resources: ResourceInput[],
  maintenanceId: number | string,
  assignedToId?: number | string | null,
) {
  if (!resources?.length) return;

  for (const r of resources) {
    if (r.reservationId != null) {
      // CASO A: Recurso con reservación existente (Work Order)
      const reservation = await tx.sparePartReservation.findUnique({
        where: { id: r.reservationId },
        include: { tool: { select: { itemType: true } } }
      });

      if (!reservation) continue;

      // Actualizar con cantidades confirmadas
      await tx.sparePartReservation.update({
        where: { id: r.reservationId },
        data: {
          usedQuantity: r.usedQuantity ?? reservation.quantity,
          returnedDamaged: r.returnedDamaged ?? false,
        }
      });

      // Repuesto con sobrante → devolver al stock
      const itemType = reservation.tool.itemType;
      if (isConsumableType(itemType) && r.usedQuantity < reservation.quantity) {
        const toReturn = reservation.quantity - r.usedQuantity;
        await tx.tool.update({
          where: { id: reservation.toolId },
          data: { stockQuantity: { increment: toReturn } }
        });
        await tx.toolMovement.create({
          data: {
            toolId: reservation.toolId,
            type: 'IN',
            quantity: toReturn,
            reason: `Devolución post-mantenimiento OT#${maintenanceId}`,
            userId: assignedToId ? Number(assignedToId) : null,
          }
        });
      }

      // Herramienta dañada → marcar como DAMAGED
      if (isToolItemType(itemType) && r.returnedDamaged) {
        await tx.tool.update({
          where: { id: reservation.toolId },
          data: { status: 'DAMAGED' }
        });
        await tx.toolMovement.create({
          data: {
            toolId: reservation.toolId,
            type: 'ADJUSTMENT',
            quantity: 0,
            reason: `Dañada durante mantenimiento OT#${maintenanceId}`,
            userId: assignedToId ? Number(assignedToId) : null,
          }
        });
      }
    } else if (r.isAdHoc && r.toolId != null) {
      // CASO B: Recurso ad-hoc con toolId (no planificado)
      if (isConsumableType(r.toolItemType) && r.usedQuantity > 0) {
        await tx.tool.update({
          where: { id: r.toolId },
          data: { stockQuantity: { decrement: r.usedQuantity } }
        });
        await tx.toolMovement.create({
          data: {
            toolId: r.toolId,
            type: 'OUT',
            quantity: r.usedQuantity,
            reason: `Consumido en mantenimiento OT#${maintenanceId} (no planificado)`,
            userId: assignedToId ? Number(assignedToId) : null,
          }
        });
      }
      if (isToolItemType(r.toolItemType) && r.returnedDamaged) {
        await tx.tool.update({
          where: { id: r.toolId },
          data: { status: 'DAMAGED' }
        });
        await tx.toolMovement.create({
          data: {
            toolId: r.toolId,
            type: 'ADJUSTMENT',
            quantity: 0,
            reason: `Dañada durante mantenimiento OT#${maintenanceId} (no planificada)`,
            userId: assignedToId ? Number(assignedToId) : null,
          }
        });
      }
    }
    // CASO C: Preventivo sin toolId → solo se guarda en historial (nada que hacer aquí)
  }
}

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
      operators = [],
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
      companyId,
      resources
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
        operators: Array.isArray(operators) ? operators : [],
        assignedToId: assignedToId || null,
        assignedToName: assignedToName || null,
        resourcesUsed: Array.isArray(resources) ? resources.map((r: any) => ({
          toolId: r.toolId, toolName: r.toolName, toolItemType: r.toolItemType,
          usedQuantity: r.usedQuantity, returnedDamaged: r.returnedDamaged, isAdHoc: r.isAdHoc,
        })) : [],
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

      // Transacción atómica para WorkOrder + recursos
      const woResult = await prisma.$transaction(async (tx) => {
        const updated = await tx.workOrder.update({
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

        // Procesar recursos (devolución de stock, herramientas dañadas, ad-hoc)
        if (Array.isArray(resources) && resources.length > 0) {
          await processResources(tx, resources, maintenanceId, assignedToId);
        }

        // maintenance_history para WorkOrders
        const historyMachineId = machineId ? Number(machineId) : null;
        const historyComponentId = componentIds?.length > 0 ? Number(componentIds[0]) : null;

        if (historyMachineId) {
          const sparePartsJson = Array.isArray(resources) && resources.length > 0
            ? resources.map((r: any) => ({
                toolId: r.toolId, toolName: r.toolName, toolItemType: r.toolItemType,
                usedQuantity: r.usedQuantity, returnedDamaged: r.returnedDamaged, isAdHoc: r.isAdHoc,
              }))
            : null;

          await tx.maintenance_history.create({
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
              spareParts: sparePartsJson,
              nextMaintenanceDate: null,
              mttr,
              mtbf: null,
              completionRate: 100,
              qualityScore: qualityScore || null,
              updatedAt: new Date(),
            },
          });
        }

        return updated;
      });

      updatedRecord = woResult;
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
