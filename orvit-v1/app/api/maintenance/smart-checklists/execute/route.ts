import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    console.log('🔧 Ejecutando smart checklist:', {
      checklistId: data.checklistId,
      executedById: data.executedById,
      maintenancesToExecute: data.maintenances?.length || 0
    });

    if (!data.checklistId || !data.executedById || !data.maintenances) {
      return NextResponse.json(
        { error: 'Datos requeridos: checklistId, executedById, maintenances' },
        { status: 400 }
      );
    }

    const executionResults = [];
    const errors = [];

    // Ejecutar cada mantenimiento individualmente
    for (const maintenance of data.maintenances) {
      try {
        console.log('🔄 Ejecutando mantenimiento:', {
          id: maintenance.id,
          type: maintenance.type,
          title: maintenance.title
        });

        let executionResult;

        if (maintenance.type === 'PREVENTIVE') {
          // Ejecutar mantenimiento preventivo
          executionResult = await executePreventiveMaintenance(maintenance, data.executedById);
        } else if (maintenance.type === 'CORRECTIVE') {
          // Ejecutar work order correctivo
          executionResult = await executeCorrectiveMaintenance(maintenance, data.executedById);
        }

        if (executionResult) {
          executionResults.push({
            maintenanceId: maintenance.id,
            type: maintenance.type,
            title: maintenance.title,
            status: 'COMPLETED',
            executedAt: new Date().toISOString(),
            result: executionResult
          });
        }

      } catch (error) {
        console.error('❌ Error ejecutando mantenimiento:', maintenance.id, error);
        errors.push({
          maintenanceId: maintenance.id,
          type: maintenance.type,
          title: maintenance.title,
          status: 'FAILED',
          error: error.message
        });
      }
    }

    // Crear registro del checklist ejecutado
    const checklistExecution = await prisma.checklistExecution.create({
      data: {
        checklistItemId: parseInt(data.checklistId.split('-')[2]) || 1, // Temporal
        executedById: data.executedById,
        isCompleted: errors.length === 0,
        actualValue: JSON.stringify({
          executedMaintenances: executionResults.length,
          totalMaintenances: data.maintenances.length,
          errors: errors.length
        }),
        notes: `Smart checklist ejecutado. Completados: ${executionResults.length}, Errores: ${errors.length}`,
        hasIssue: errors.length > 0,
        issueDescription: errors.length > 0 ? JSON.stringify(errors) : null
      }
    });

    console.log('✅ Smart checklist ejecutado:', {
      checklistExecutionId: checklistExecution.id,
      completedMaintenances: executionResults.length,
      failedMaintenances: errors.length,
      totalMaintenances: data.maintenances.length
    });

    return NextResponse.json({
      success: true,
      checklistExecutionId: checklistExecution.id,
      executionResults,
      errors,
      summary: {
        total: data.maintenances.length,
        completed: executionResults.length,
        failed: errors.length,
        successRate: (executionResults.length / data.maintenances.length) * 100
      },
      message: `Checklist ejecutado: ${executionResults.length}/${data.maintenances.length} mantenimientos completados`
    });

  } catch (error) {
    console.error('Error executing smart checklist:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función para ejecutar mantenimiento preventivo
async function executePreventiveMaintenance(maintenance: any, executedById: number) {
  const executedAt = new Date();
  
  // Buscar el template del mantenimiento preventivo
  const template = await prisma.document.findUnique({
    where: { id: maintenance.id }
  });

  if (!template) {
    throw new Error('Template de mantenimiento preventivo no encontrado');
  }

  // Parsear y actualizar el template
  const templateData = JSON.parse(template.url);
  
  // Actualizar contador y fechas
  const newMaintenanceCount = (templateData.maintenanceCount || 0) + 1;
  const nextMaintenanceDate = new Date();
  nextMaintenanceDate.setDate(nextMaintenanceDate.getDate() + (templateData.frequencyDays || 30));

  // Crear historial de ejecución
  const executionId = `${maintenance.id}-${Date.now()}`;
  const newExecution = {
    id: executionId,
    executedAt: executedAt.toISOString(),
    executedById: executedById,
    actualDuration: maintenance.estimatedHours || 1,
    actualDurationUnit: 'HOURS',
    actualValue: maintenance.estimatedValue || 1,
    actualUnit: 'CYCLES',
    notes: 'Ejecutado desde smart checklist',
    issues: '',
    completionStatus: 'COMPLETED'
  };

  const updatedExecutionHistory = [...(templateData.executionHistory || []), newExecution];

  // Actualizar template
  const updatedTemplateData = {
    ...templateData,
    maintenanceCount: newMaintenanceCount,
    lastMaintenanceDate: executedAt.toISOString(),
    nextMaintenanceDate: nextMaintenanceDate.toISOString(),
    executionHistory: updatedExecutionHistory,
    updatedAt: executedAt.toISOString()
  };

  await prisma.document.update({
    where: { id: maintenance.id },
    data: {
      url: JSON.stringify(updatedTemplateData),
      updatedAt: executedAt
    }
  });

  return {
    executionId,
    maintenanceCount: newMaintenanceCount,
    nextMaintenanceDate: nextMaintenanceDate.toISOString(),
    duration: maintenance.estimatedHours || 1
  };
}

// Función para ejecutar work order correctivo
async function executeCorrectiveMaintenance(maintenance: any, executedById: number) {
  const executedAt = new Date();

  // Actualizar work order a completado
  const updatedWorkOrder = await prisma.workOrder.update({
    where: { id: maintenance.id },
    data: {
      status: 'COMPLETED',
      completedDate: executedAt,
      actualHours: maintenance.estimatedHours || 1,
      actualCost: maintenance.estimatedCost || 0,
      updatedAt: executedAt
    }
  });

  // Crear historial de mantenimiento
  const maintenanceHistory = await prisma.maintenanceHistory.create({
    data: {
      workOrderId: maintenance.id,
      machineId: maintenance.machineId,
      executedAt: executedAt,
      executedById: executedById,
      duration: maintenance.estimatedHours || 1,
      cost: maintenance.estimatedCost || 0,
      notes: 'Ejecutado desde smart checklist',
      completionRate: 100,
      qualityScore: 10
    }
  });

  return {
    workOrderId: updatedWorkOrder.id,
    historyId: maintenanceHistory.id,
    status: 'COMPLETED',
    duration: maintenance.estimatedHours || 1
  };
}
