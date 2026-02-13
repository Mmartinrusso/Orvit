import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      maintenanceId,
      maintenanceType,
      isPreventive,
      actualDuration,
      originalDuration = null,
      actualDurationUnit = 'HOURS', // Unidad por defecto
      actualValue,
      actualUnit,
      excludeQuantity = false, // Campo para excluir cantidad
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
      reExecutionReason
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

    // Solo validar actualValue si no se está excluyendo
    if (!excludeQuantity && (!actualValue || actualValue <= 0)) {
      return NextResponse.json(
        { error: 'Valor real debe ser mayor a 0' },
        { status: 400 }
      );
    }

    // Verificar si ya fue completado hoy y requiere razón de re-ejecución
    if (isPreventive) {
      const existingTemplate = await prisma.document.findFirst({
        where: {
          id: Number(maintenanceId),
          entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE'
        }
      });

      if (existingTemplate) {
        const templateData = JSON.parse(existingTemplate.url);
        if (templateData.lastMaintenanceDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const lastMaintenance = new Date(templateData.lastMaintenanceDate);
          lastMaintenance.setHours(0, 0, 0, 0);
          
          if (lastMaintenance.getTime() === today.getTime() && !reExecutionReason) {
            return NextResponse.json(
              { error: 'Este mantenimiento ya fue completado hoy. Debe proporcionar una razón para re-ejecutarlo.' },
              { status: 400 }
            );
          }
        }
      }
    }

    // Calcular métricas
    // Eficiencia removida - no se calcula
    
    const variance = estimatedValue && actualValue && !excludeQuantity ? 
      Math.round(((actualValue - estimatedValue) / estimatedValue) * 100) : null;

    // Calcular MTTR (Mean Time To Repair) - en este caso será la duración real
    const mttr = actualDuration;

    // Calcular costo estimado (basado en horas * tarifa promedio)
    const averageHourlyRate = 25; // USD por hora (esto podría venir de configuración)
    const estimatedCost = actualDuration * averageHourlyRate;

    let updatedRecord = null;

    // Verificar si es un mantenimiento preventivo (Document) o un WorkOrder
    if (isPreventive) {
      // Es un mantenimiento preventivo - actualizar el Document
      const maintenanceTemplate = await prisma.document.findFirst({
        where: {
          id: Number(maintenanceId),
          entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE'
        }
      });

      if (!maintenanceTemplate) {
        return NextResponse.json(
          { error: 'Mantenimiento preventivo no encontrado' },
          { status: 404 }
        );
      }

      // Parsear datos existentes del template
      const templateData = JSON.parse(maintenanceTemplate.url);
      
      // Calcular próxima fecha de mantenimiento
      let nextDate = new Date();
      if (templateData.frequencyDays) {
        nextDate.setDate(nextDate.getDate() + templateData.frequencyDays);
        
        // Ajustar a día laboral (lunes a viernes)
        const dayOfWeek = nextDate.getDay();
        if (dayOfWeek === 0) nextDate.setDate(nextDate.getDate() + 1); // Domingo -> Lunes
        else if (dayOfWeek === 6) nextDate.setDate(nextDate.getDate() + 2); // Sábado -> Lunes
      }

             // Actualizar template con nueva fecha y contador
       const updatedTemplateData = {
         ...templateData,
         lastMaintenanceDate: executedAt,
         nextMaintenanceDate: nextDate.toISOString(),
         maintenanceCount: (templateData.maintenanceCount || 0) + 1,
         lastExecutionDuration: actualDuration,
         lastExecutionNotes: notes || '',
         lastExecutionIssues: issues || '',
         lastExecutionValue: excludeQuantity ? null : actualValue,
         lastExecutionUnit: excludeQuantity ? null : actualUnit,
         averageDuration: templateData.averageDuration ? 
           ((templateData.averageDuration + actualDuration) / 2) : actualDuration,
         // Agregar historial de ejecuciones
         executionHistory: [
           ...(templateData.executionHistory || []),
           {
             id: Date.now(),
             executedAt: executedAt,
             actualDuration: actualDurationUnit === 'MINUTES' ? originalDuration : actualDuration, // Guardar según la unidad
             actualDurationUnit: actualDurationUnit, // Agregar la unidad de tiempo
             actualValue: excludeQuantity ? null : actualValue,
             actualUnit: excludeQuantity ? null : actualUnit,
             notes: notes || '',
             issues: issues || '',
             // efficiency removido
             variance: variance,
             mttr: mttr,
             cost: estimatedCost,
             qualityScore: null, // Será asignado por supervisor posteriormente
             completionStatus: completionStatus || 'COMPLETED',
             reExecutionReason: reExecutionReason || null
           }
         ]
       };

      // ✅ OPTIMIZADO: Usar transacción atómica para template + instancia + history
      const result = await prisma.$transaction(async (tx) => {
        // 1. Actualizar el template
        const updated = await tx.document.update({
          where: { id: Number(maintenanceId) },
          data: {
            url: JSON.stringify(updatedTemplateData),
            updatedAt: new Date()
          }
        });

        // 2. Crear próxima instancia de mantenimiento (como hace complete/route.ts)
        const nextInstance = await tx.document.create({
          data: {
            entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
            entityId: `template-${maintenanceId}-${nextDate.toISOString().split('T')[0]}`,
            originalName: `${templateData.title} - ${nextDate.toLocaleDateString('es-ES')}`,
            url: JSON.stringify({
              ...updatedTemplateData,
              templateId: maintenanceId.toString(),
              scheduledDate: nextDate.toISOString(),
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

        // 3. Crear registro en maintenance_history dentro de la transacción
        let historyMachineId = machineId ? Number(machineId) : templateData.machineId;
        let historyComponentId = componentIds && componentIds.length > 0
          ? Number(componentIds[0])
          : (templateData.componentIds?.length > 0 ? templateData.componentIds[0] : null);

        if (historyMachineId) {
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
              spareParts: null,
              nextMaintenanceDate: nextDate,
              mttr: mttr,
              mtbf: null,
              completionRate: 100,
              qualityScore: qualityScore || null
            }
          });
        }

        return { updated, nextInstance };
      });

      updatedRecord = result.updated;
     } else {
       // Es un WorkOrder - actualizar directamente
       // Verificar si el WorkOrder existe antes de actualizar
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
     }

     // ✅ Para WorkOrders no preventivos, crear maintenance_history
     if (!isPreventive) {
       try {
         let historyMachineId = machineId ? Number(machineId) : null;
         let historyComponentId = componentIds && componentIds.length > 0 ? Number(componentIds[0]) : null;

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
               mttr: mttr,
               mtbf: null,
               completionRate: 100,
               qualityScore: qualityScore || null
             }
           });
         }
       } catch (historyError) {
         console.error('Error guardando maintenance_history para WorkOrder:', historyError);
       }
     }



         // Respuesta exitosa
     const responseData = {
       success: true,
       message: 'Mantenimiento ejecutado y registrado exitosamente',
       data: {
         maintenanceId: updatedRecord.id,
         executedAt: executedAt,
         duration: originalDuration || actualDuration, // Usar el valor original
         durationUnit: actualDurationUnit, // Agregar la unidad de tiempo
         // efficiency: null, // Removido
         mttr: mttr,
         cost: estimatedCost,
         type: isPreventive ? 'PREVENTIVE' : 'CORRECTIVE'
       }
     };

    // Agregar datos específicos según el tipo
    if (isPreventive) {
      const templateData = JSON.parse(updatedRecord.url);
      responseData.data.nextMaintenanceDate = templateData.nextMaintenanceDate;
      responseData.data.maintenanceCount = templateData.maintenanceCount;
    } else {
      responseData.data.status = updatedRecord.status;
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ Error ejecutando mantenimiento:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

