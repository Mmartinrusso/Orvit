import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const {
      checklistId,
      executionId, // ID de ejecución existente para actualizar (opcional)
      executedAt,
      maintenanceItems,
      executedBy,
      executedById,
      executedByName,
      companyId,
      sectorId,
      responsibles,
      signatures,
      isFinalized,
      status
    } = data;

    if (!checklistId || !maintenanceItems || !Array.isArray(maintenanceItems)) {
      return NextResponse.json(
        { error: 'Datos de ejecución incompletos' },
        { status: 400 }
      );
    }

    const numericChecklistId =
      typeof checklistId === 'string' ? parseInt(checklistId, 10) : checklistId;

    if (!numericChecklistId || Number.isNaN(numericChecklistId)) {
      return NextResponse.json(
        { error: 'ID de checklist inválido' },
        { status: 400 }
      );
    }

    const numericCompanyId =
      typeof companyId === 'string' ? parseInt(companyId, 10) : companyId;
    const numericSectorId =
      typeof sectorId === 'string' ? parseInt(sectorId, 10) : sectorId;

    const generalExecutors = Array.from(
      new Set(
        (responsibles?.ejecutores || [])
          .map((name: string) => name?.trim?.())
          .filter(Boolean)
      )
    );

    const generalSupervisors = Array.from(
      new Set(
        (responsibles?.supervisores || [])
          .map((name: string) => name?.trim?.())
          .filter(Boolean)
      )
    );

    const executedBySummary =
      generalExecutors.length > 0
        ? generalExecutors.join(', ')
        : generalSupervisors.length > 0
          ? generalSupervisors.join(', ')
          : executedByName || executedBy || 'Usuario del sistema';

    const toNumber = (value: any) => {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : null;
    };

    // Preparar executedAt: usar la fecha/hora actual automáticamente
    // Si executedAt viene como ISO string, usarlo directamente; si viene como dd/mm/yyyy, parsearlo
    let executedAtDate: Date;
    if (executedAt && executedAt.includes('T')) {
      // Es un ISO string, usar directamente
      executedAtDate = new Date(executedAt);
    } else if (executedAt) {
      // Es formato dd/mm/yyyy, parsearlo
      executedAtDate = parseDateDDMMYYYY(executedAt);
    } else {
      // Usar fecha/hora actual
      executedAtDate = new Date();
    }
    
    // Si hay hora de finalización en responsibles, combinarla con la fecha (opcional, para compatibilidad)
    if (responsibles && responsibles.horaFinalizacion) {
      const [horas, minutos] = responsibles.horaFinalizacion.split(':');
      executedAtDate.setHours(parseInt(horas) || 0, parseInt(minutos) || 0, 0, 0);
    } else {
      // Usar la hora actual del executedAtDate
    }

    // Determinar el estado según si se finaliza o no
    const executionStatus = status || (isFinalized ? 'COMPLETED' : 'IN_PROGRESS');

    // Datos de ejecución a guardar
    const executionData = {
      checklistId: numericChecklistId,
      executedAt: executedAtDate,
      executedBy: executedBySummary,
      executionTime: maintenanceItems.length * 30, // Tiempo estimado en minutos
      companyId: numericCompanyId || 1,
      sectorId: numericSectorId || 1,
      status: executionStatus, // Usar el estado determinado
      completedItems: maintenanceItems.filter(item => !!item.completedDate).length, // Solo contar los completados
      totalItems: maintenanceItems.length,
      justifications: JSON.stringify({
        message: isFinalized
          ? `Ejecutado con ${maintenanceItems.length} mantenimientos`
          : `Guardado en progreso con ${maintenanceItems.length} mantenimientos`,
        executedAt: new Date().toISOString(),
        isFinalized: isFinalized || false
      }),
      executionDetails: JSON.stringify({
        maintenanceItems: maintenanceItems.map(item => ({
          maintenanceId: item.maintenanceId,
          completedDate: item.completedDate,
          rescheduleDate: item.rescheduleDate,
          notes: item.notes,
          issues: item.issues,
          currentKilometers: item.currentKilometers,
          currentHours: item.currentHours,
          executors: item.executors || [],
          supervisors: item.supervisors || [],
          photoUrls: item.photoUrls || []
        })),
        responsibles: responsibles || {},
        signatures: signatures || {},
        isFinalized: isFinalized || false,
        executedBy: {
          id: executedById ?? null,
          name: executedByName || executedBySummary
        }
      })
    };

    // Si hay un executionId existente, actualizar en vez de crear
    let checklistExecution;
    const numericExecutionId = executionId ? (typeof executionId === 'string' ? parseInt(executionId, 10) : executionId) : null;

    if (numericExecutionId && !isNaN(numericExecutionId)) {
      // Verificar que la ejecución existe y está en progreso
      const existingExecution = await prisma.checklistExecution.findUnique({
        where: { id: numericExecutionId }
      });

      if (existingExecution && existingExecution.status === 'IN_PROGRESS') {
        // Actualizar la ejecución existente
        checklistExecution = await prisma.checklistExecution.update({
          where: { id: numericExecutionId },
          data: executionData
        });
      } else {
        // Si no existe o no está en progreso, crear una nueva
        checklistExecution = await prisma.checklistExecution.create({
          data: executionData
        });
      }
    } else {
      // Crear nueva ejecución
      checklistExecution = await prisma.checklistExecution.create({
        data: executionData
      });
    }

    // Actualizar el checklist con el ID de ejecución en progreso (o limpiarlo si se finaliza)
    try {
      const checklistDoc = await prisma.document.findUnique({
        where: {
          id: numericChecklistId,
          entityType: 'MAINTENANCE_CHECKLIST'
        }
      });

      if (checklistDoc) {
        const checklistData = JSON.parse(checklistDoc.url);

        if (isFinalized) {
          // Finalizado: marcar como completado y limpiar inProgressExecutionId
          const updatedChecklistData = {
            ...checklistData,
            isCompleted: true,
            executionStatus: 'COMPLETED',
            lastExecutionDate: executedAtDate.toISOString(),
            inProgressExecutionId: null, // Limpiar la ejecución en progreso
            hasInProgressExecution: false,
            updatedAt: new Date().toISOString()
          };

          await prisma.document.update({
            where: { id: numericChecklistId },
            data: {
              url: JSON.stringify(updatedChecklistData),
              uploadDate: new Date()
            }
          });

        } else {
          // En progreso: guardar el ID de ejecución para que pueda ser recargado
          const updatedChecklistData = {
            ...checklistData,
            inProgressExecutionId: checklistExecution.id,
            hasInProgressExecution: true,
            executionStatus: 'IN_PROGRESS',
            updatedAt: new Date().toISOString()
          };

          await prisma.document.update({
            where: { id: numericChecklistId },
            data: {
              url: JSON.stringify(updatedChecklistData),
              uploadDate: new Date()
            }
          });

        }
      }
    } catch (error) {
      console.error('⚠️ Error al actualizar el estado del checklist:', error);
      // No fallar la ejecución si no se puede actualizar el checklist
    }

    // Solo procesar mantenimientos si está finalizado
    if (isFinalized) {

      // Procesar cada mantenimiento
      for (const item of maintenanceItems) {
        const {
          maintenanceId,
          completedDate,
          rescheduleDate,
          currentKilometers,
          currentHours,
          notes,
          issues,
          executors: itemExecutorsRaw = [],
          supervisors: itemSupervisorsRaw = [],
          photoUrls: itemPhotoUrls = []
        } = item;

        const taskExecutors = Array.from(
          new Set(
            (Array.isArray(itemExecutorsRaw) ? itemExecutorsRaw : [])
              .map((name: string) => name?.trim?.())
              .filter(Boolean)
          )
        );
        const taskSupervisors = Array.from(
          new Set(
            (Array.isArray(itemSupervisorsRaw) ? itemSupervisorsRaw : [])
              .map((name: string) => name?.trim?.())
              .filter(Boolean)
          )
        );

        const effectiveExecutors =
          taskExecutors.length > 0 ? taskExecutors : generalExecutors;
        const effectiveSupervisors =
          taskSupervisors.length > 0 ? taskSupervisors : generalSupervisors;

        const numericMaintenanceId =
          typeof maintenanceId === 'string' ? parseInt(maintenanceId, 10) : maintenanceId;

        if (!numericMaintenanceId || Number.isNaN(numericMaintenanceId)) {
          console.error(`❌ maintenanceId inválido:`, maintenanceId);
          continue;
        }

        // Si tiene fecha de completado, marcar como completado
        if (completedDate) {
        try {
          // Obtener el documento actual
          const document = await prisma.document.findUnique({
            where: { id: numericMaintenanceId }
          });

          if (!document) {
            console.error(`❌ Documento ${numericMaintenanceId} no encontrado`);
            continue;
          }

          // Parsear los datos actuales
          const templateData = JSON.parse(document.url);

          const estimatedMinutes = (() => {
            const minutesValue = toNumber(templateData.estimatedMinutes);
            if (minutesValue && minutesValue > 0) {
              return minutesValue;
            }
            const hoursValue = toNumber(templateData.estimatedHours);
            if (hoursValue && hoursValue > 0) {
              return hoursValue * 60;
            }
            const totalTimeValue = toNumber(templateData.estimatedTotalTime);
            if (totalTimeValue && templateData.estimatedTimeType === 'HOURS') {
              return totalTimeValue * 60;
            }
            if (totalTimeValue && templateData.estimatedTimeType === 'MINUTES') {
              return totalTimeValue;
            }
            return 30;
          })();
          
          // Crear registro de ejecución para el historial
          const recordSuffix = `${numericMaintenanceId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

          const executionRecord = {
            id: `exec-${recordSuffix}`,
            executedAt: parseDateDDMMYYYY(completedDate).toISOString(),
            actualDuration: estimatedMinutes,
            actualDurationUnit: 'MINUTES',
            actualValue: null,
            actualUnit: null,
            notes: notes || `Ejecutado desde checklist ${checklistId}`,
            issues: issues || '',
            efficiency: null,
            variance: null,
            cost: null,
            qualityScore: null,
            completionStatus: 'COMPLETED',
            executedBy: effectiveExecutors.length > 0
              ? effectiveExecutors.join(', ')
              : executedBySummary,
            executedById: executedById ?? null,
            executors: effectiveExecutors,
            supervisors: effectiveSupervisors,
            photoUrls: itemPhotoUrls || [],
            maintenanceId: numericMaintenanceId,
            checklistId: numericChecklistId,
            checklistExecutionId: checklistExecution.id,
            companyId: numericCompanyId || templateData.companyId || null,
            sectorId: numericSectorId || templateData.sectorId || null,
            isFromChecklist: true
          };

          // Actualizar los datos con el nuevo status y historial
          const updatedData = {
            ...templateData,
            status: 'COMPLETED',
            lastMaintenanceDate: parseDateDDMMYYYY(completedDate).toISOString(),
            lastExecutionDuration: executionRecord.actualDuration,
            lastExecutionDurationUnit: executionRecord.actualDurationUnit,
            lastExecutionNotes: executionRecord.notes,
            lastExecutedBy: executionRecord.executedBy,
            lastExecutionExecutors: executionRecord.executors,
            lastExecutionSupervisors: executionRecord.supervisors,
            lastExecutionPhotoUrls: itemPhotoUrls || [],
            lastExecutionChecklistId: numericChecklistId,
            lastExecutionChecklistExecutionId: checklistExecution.id,
            lastExecutionExecutedAt: executionRecord.executedAt,
            notes: notes || templateData.notes || '',
            maintenanceCount: (templateData.maintenanceCount || 0) + 1,
            // Agregar al historial de ejecuciones
            executionHistory: [
              executionRecord,
              ...(templateData.executionHistory || [])
            ]
          };

          // Guardar el documento actualizado
          await prisma.document.update({
            where: { id: numericMaintenanceId },
            data: {
              url: JSON.stringify(updatedData)
            }
          });

          // Si es una unidad móvil, actualizar kilometraje y horas
          if (currentKilometers || currentHours) {
            try {
              // Obtener el unidadMovilId del templateData
              const unidadMovilId = updatedData.unidadMovilId;

              if (unidadMovilId) {
                const updateData: any = {};
                if (currentKilometers) {
                  updateData.kilometraje = currentKilometers;
                }
                // Note: horasActuales field doesn't exist in schema yet, only kilometraje
                
                if (Object.keys(updateData).length > 0) {
                  await prisma.unidadMovil.update({
                    where: { id: unidadMovilId },
                    data: updateData
                  });

                }
              }
            } catch (error) {
              console.error(`⚠️ Error actualizando unidad móvil para mantenimiento ${numericMaintenanceId}:`, error);
            }
          }
        } catch (error) {
          console.error(`❌ Error marcando mantenimiento ${numericMaintenanceId} como completado:`, error);
        }
      }

      // Si tiene fecha de reprogramación, crear nueva programación
      if (rescheduleDate) {
        try {
          // Obtener el documento actual
          const document = await prisma.document.findUnique({
            where: { id: numericMaintenanceId }
          });

          if (!document) {
            console.error(`❌ Documento ${numericMaintenanceId} no encontrado para reprogramación`);
            continue;
          }

          // Parsear los datos actuales
          const templateData = JSON.parse(document.url);
          
          // Crear registro de reprogramación para el historial
          const rescheduleSuffix = `${numericMaintenanceId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

          const rescheduleRecord = {
            id: `reschedule-${rescheduleSuffix}`,
            executedAt: new Date().toISOString(),
            actualDuration: 0,
            actualDurationUnit: 'REPROGRAMACION',
            actualValue: null,
            actualUnit: null,
            notes: `Reprogramado desde checklist ${checklistId} - ${notes || 'Sin motivo especificado'}`,
            issues: issues || '',
            efficiency: null,
            variance: null,
            cost: null,
            qualityScore: null,
            completionStatus: 'RESCHEDULED',
            executedBy: effectiveSupervisors.length > 0
              ? effectiveSupervisors.join(', ')
              : executedBySummary,
            executedById: executedById ?? null,
            executors: effectiveExecutors,
            supervisors: effectiveSupervisors,
            checklistId: numericChecklistId,
            checklistExecutionId: checklistExecution.id,
            companyId: numericCompanyId || templateData.companyId || null,
            sectorId: numericSectorId || templateData.sectorId || null,
            isFromChecklist: true,
            originalDate: templateData.nextMaintenanceDate || new Date().toISOString(),
            newDate: parseDateDDMMYYYY(rescheduleDate).toISOString(),
            rescheduleReason: notes || 'Reprogramado desde checklist'
          };

          // Actualizar los datos con el nuevo status y fecha
          const updatedData = {
            ...templateData,
            status: 'SCHEDULED',
            nextMaintenanceDate: parseDateDDMMYYYY(rescheduleDate).toISOString(),
            lastExecutionDate: new Date().toISOString(), // Registrar que fue reprogramado
            lastExecutionNotes: rescheduleRecord.notes,
            lastExecutedBy: rescheduleRecord.executedBy,
            lastExecutionExecutors: rescheduleRecord.executors,
            lastExecutionSupervisors: rescheduleRecord.supervisors,
            lastExecutionChecklistId: numericChecklistId,
            lastExecutionChecklistExecutionId: checklistExecution.id,
            lastExecutionExecutedAt: rescheduleRecord.executedAt,
            // Agregar al historial de ejecuciones
            executionHistory: [
              rescheduleRecord,
              ...(templateData.executionHistory || [])
            ]
          };

          // Guardar el documento actualizado
          await prisma.document.update({
            where: { id: numericMaintenanceId },
            data: {
              url: JSON.stringify(updatedData)
            }
          });

        } catch (error) {
          console.error(`❌ Error reprogramando mantenimiento preventivo ${numericMaintenanceId}:`, error);
        }
      }
      } // Cierre del for loop de mantenimientos
    } // Cierre del if (isFinalized)

    // Recopilar información sobre los mantenimientos procesados
    const processedMaintenances = maintenanceItems.map(item => ({
      maintenanceId: item.maintenanceId,
      wasCompleted: !!item.completedDate,
      wasRescheduled: !!item.rescheduleDate,
      newStatus: item.completedDate ? 'COMPLETED' : (item.rescheduleDate ? 'SCHEDULED' : 'PENDING')
    }));

    return NextResponse.json({
      success: true,
      message: isFinalized 
        ? `Checklist finalizado correctamente. ${maintenanceItems.length} mantenimientos procesados.`
        : `Checklist guardado correctamente. Puedes continuar completándolo más tarde.`,
      executionId: checklistExecution.id,
      processedMaintenances,
      executionDetails: {
        completedCount: maintenanceItems.filter(item => item.completedDate).length,
        rescheduledCount: maintenanceItems.filter(item => item.rescheduleDate).length,
        totalItems: maintenanceItems.length,
        isFinalized: isFinalized || false
      }
    });

  } catch (error: any) {
    console.error('❌ Error saving checklist execution:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error name:', error.name);
    console.error('❌ Stack trace:', error.stack);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor al guardar la ejecución', 
        details: error.message,
        errorName: error.name,
        stack: error.stack 
      },
      { status: 500 }
    );
  }
}

// Función para convertir fecha dd/mm/yyyy a Date
function parseDateDDMMYYYY(dateString: string): Date {
  if (!dateString) return new Date();
  
  // Si ya es una fecha ISO, parsear manualmente
  if (dateString.includes('-')) {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
  }
  
  // Convertir dd/mm/yyyy a Date
  const parts = dateString.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    // Usar Date(year, month-1, day) para evitar problemas de zona horaria
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  return new Date();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const checklistId = searchParams.get('checklistId');
    const executionId = searchParams.get('executionId');
    const companyId = searchParams.get('companyId');

    // Si se especifica executionId, buscar solo esa ejecución
    if (executionId) {
      const execution = await prisma.checklistExecution.findUnique({
        where: {
          id: parseInt(executionId)
        }
      });

      if (!execution) {
        return NextResponse.json(
          { error: 'Ejecución no encontrada' },
          { status: 404 }
        );
      }

      // Obtener el checklist asociado
      
      // Intentar buscar primero con entityType
      let checklistDoc = await prisma.document.findUnique({
        where: {
          id: execution.checklistId,
          entityType: 'MAINTENANCE_CHECKLIST'
        }
      });

      // Si no se encuentra con entityType, intentar buscar solo por ID
      if (!checklistDoc) {
        checklistDoc = await prisma.document.findUnique({
          where: {
            id: execution.checklistId
          }
        });
      }

      let checklistData = null;
      if (checklistDoc) {
        
        try {
          if (checklistDoc.url) {
            checklistData = JSON.parse(checklistDoc.url);
          } else {
            console.warn('⚠️ Checklist document no tiene URL');
          }
        } catch (e) {
          console.error('❌ Error parsing checklist data:', e);
          console.error('URL que falló:', checklistDoc.url?.substring(0, 200));
        }
      } else {
        console.error('❌ No se encontró checklist document con ID:', execution.checklistId);
      }

      return NextResponse.json({
        success: true,
        execution: {
          ...execution,
          executionDetails: execution.executionDetails ? JSON.parse(execution.executionDetails) : null,
          justifications: execution.justifications ? JSON.parse(execution.justifications) : null,
          checklist: checklistData
        }
      });
    }

    // Si no hay executionId, buscar por checklistId (comportamiento original)
    if (!checklistId) {
      return NextResponse.json(
        { error: 'checklistId o executionId es requerido' },
        { status: 400 }
      );
    }

    const executions = await prisma.checklistExecution.findMany({
      where: {
        checklistId: parseInt(checklistId),
        ...(companyId && { companyId: parseInt(companyId) })
      },
      orderBy: {
        executedAt: 'desc'
      }
    });

    // Parsear executionDetails para cada ejecución
    const executionsWithDetails = executions.map(execution => ({
      ...execution,
      executionDetails: execution.executionDetails ? JSON.parse(execution.executionDetails) : null,
      justifications: execution.justifications ? JSON.parse(execution.justifications) : null
    }));

    return NextResponse.json({
      success: true,
      executions: executionsWithDetails
    });

  } catch (error) {
    console.error('Error fetching checklist executions:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}