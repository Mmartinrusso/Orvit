import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      checklistId, 
      completedItems, 
      executionTime, 
      executedBy,
      companyId,
      sectorId,
      status = 'COMPLETED',
      justifications = [],
      totalItems
    } = body;

    console.log('🔍 Executing checklist maintenance items:', {
      checklistId,
      completedItemsCount: completedItems.length,
      executionTime,
      executedBy,
      companyId,
      sectorId
    });

    const results = [];

    for (const item of completedItems) {
      if (item.maintenanceId && item.isCompleted) {
        try {
          // Buscar el mantenimiento preventivo por ID
          const maintenance = await prisma.document.findUnique({
            where: { id: item.maintenanceId }
          });

          if (maintenance && maintenance.entityType === 'PREVENTIVE_MAINTENANCE_TEMPLATE') {
            // Parsear los datos del template
            const templateData = JSON.parse(maintenance.url);
            
            // Buscar las notas y problemas del item específico
            const itemData = completedItems.find(ci => ci.maintenanceId === item.maintenanceId);
            
            // Para la detección interna, siempre incluir la referencia al checklist
            const internalNote = `Ejecutado desde checklist ${checklistId}`;
            
            // Para mostrar al usuario, usar solo las notas personalizadas o un texto por defecto
            const displayNotes = itemData?.notes || 'Mantenimiento ejecutado correctamente';
            const itemIssues = itemData?.issues || '';
            
            // Combinar para el registro interno (para detectar que es de checklist)
            const itemNotes = itemData?.notes 
              ? `${internalNote} - ${itemData.notes}`
              : internalNote;
            
            // Calcular eficiencia basada en tiempo estimado vs tiempo real
            const estimatedTimeMinutes = templateData.estimatedHours ? templateData.estimatedHours * 60 : 0;
            const actualTimeMinutes = executionTime;
            
            let efficiency = null;
            if (estimatedTimeMinutes > 0 && actualTimeMinutes > 0) {
              // Eficiencia = (Tiempo estimado / Tiempo real) * 100
              // Si se completó en menos tiempo = mayor eficiencia
              efficiency = Math.round((estimatedTimeMinutes / actualTimeMinutes) * 100);
              // Limitar entre 0% y 200% para casos extremos
              efficiency = Math.max(0, Math.min(200, efficiency));
            }
            
            console.log('🔍 Processing maintenance item:', {
              maintenanceId: item.maintenanceId,
              itemNotes,
              itemIssues,
              hasCustomNotes: !!itemData?.notes,
              hasCustomIssues: !!itemData?.issues,
              estimatedTimeMinutes,
              actualTimeMinutes,
              efficiency
            });

            // Crear el registro de ejecución para el historial
            const executionRecord = {
              id: Date.now().toString(),
              executedAt: new Date().toISOString(),
              actualDuration: executionTime,
              actualValue: null,
              actualUnit: 'MINUTES',
              notes: itemNotes,
              issues: itemIssues,
              qualityScore: null,
              efficiency: efficiency,
              variance: null,
              cost: null,
              completionStatus: 'COMPLETED',
              executedBy: executedBy
            };

            console.log('🔍 Created execution record:', executionRecord);
            console.log('🔍 Execution record JSON:', JSON.stringify(executionRecord, null, 2));

            // Actualizar el template con la información de ejecución
            const updatedTemplateData = {
              ...templateData,
              lastMaintenanceDate: new Date().toISOString(),
              lastExecutionDuration: executionTime,
              lastExecutionNotes: `Ejecutado desde checklist ${checklistId}`,
              lastExecutedBy: executedBy,
              maintenanceCount: (templateData.maintenanceCount || 0) + 1,
              // Agregar al historial de ejecuciones
              executionHistory: [
                executionRecord,
                ...(templateData.executionHistory || [])
              ]
            };

            console.log('🔍 Template data before update:', {
              existingExecutionHistory: templateData.executionHistory?.length || 0,
              newExecutionRecord: executionRecord,
              updatedExecutionHistoryLength: updatedTemplateData.executionHistory?.length || 0,
              updatedExecutionHistoryFirstItem: updatedTemplateData.executionHistory?.[0]
            });

            // Actualizar el documento en la base de datos
            const updatedDocument = await prisma.document.update({
              where: { id: item.maintenanceId },
              data: {
                url: JSON.stringify(updatedTemplateData),
                updatedAt: new Date()
              }
            });

            console.log('🔍 Document updated:', {
              documentId: updatedDocument.id,
              urlLength: updatedDocument.url.length,
              updatedTemplateDataKeys: Object.keys(updatedTemplateData),
              savedExecutionHistory: JSON.parse(updatedDocument.url).executionHistory?.[0],
              savedExecutionHistoryLength: JSON.parse(updatedDocument.url).executionHistory?.length || 0,
              savedExecutionHistoryKeys: JSON.parse(updatedDocument.url).executionHistory?.[0] ? Object.keys(JSON.parse(updatedDocument.url).executionHistory[0]) : [],
              savedExecutionHistoryNotes: JSON.parse(updatedDocument.url).executionHistory?.[0]?.notes,
              savedExecutionHistoryActualDuration: JSON.parse(updatedDocument.url).executionHistory?.[0]?.actualDuration,
              savedExecutionHistoryEfficiency: JSON.parse(updatedDocument.url).executionHistory?.[0]?.efficiency
            });

            // Registrar en el historial
            await prisma.historyEvent.create({
              data: {
                entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
                entityId: item.maintenanceId.toString(),
                eventType: 'MAINTENANCE',
                description: `Mantenimiento preventivo ejecutado desde checklist ${checklistId}`,
                details: JSON.stringify({
                  maintenanceTitle: templateData.title,
                  executionDuration: executionTime,
                  executedBy: executedBy,
                  checklistId: checklistId,
                  machineId: templateData.machineId,
                  machineName: templateData.machineName,
                  componentIds: templateData.componentIds,
                  componentNames: templateData.componentNames,
                  subcomponentIds: templateData.subcomponentIds,
                  subcomponentNames: templateData.subcomponentNames
                }),
                companyId: companyId,
                sectorId: sectorId,
                userId: 1, // TODO: Obtener del contexto de autenticación
                createdAt: new Date()
              }
            });

            console.log('✅ Maintenance executed and logged:', {
              maintenanceId: item.maintenanceId,
              title: templateData.title,
              lastMaintenanceDate: updatedTemplateData.lastMaintenanceDate,
              executionRecord: executionRecord,
              executionHistoryLength: updatedTemplateData.executionHistory?.length || 0
            });

            results.push({
              maintenanceId: item.maintenanceId,
              status: 'success',
              message: 'Mantenimiento ejecutado correctamente'
            });
          } else {
            console.log('⚠️ Maintenance not found or not preventive:', item.maintenanceId);
            results.push({
              maintenanceId: item.maintenanceId,
              status: 'error',
              message: 'Mantenimiento no encontrado o no es preventivo'
            });
          }
        } catch (error) {
          console.error('❌ Error executing maintenance:', item.maintenanceId, error);
          results.push({
            maintenanceId: item.maintenanceId,
            status: 'error',
            message: 'Error al ejecutar el mantenimiento'
          });
        }
      }
    }

    // Registrar la ejecución del checklist
    try {
      console.log('🔍 Creating checklist execution record with data:', {
        checklistId,
        executedBy,
        executionTime,
        completedItems: completedItems.filter(item => item.isCompleted).length,
        totalItems: totalItems || completedItems.length,
        companyId,
        sectorId,
        status,
        justificationsCount: justifications.length
      });

      // Crear un registro detallado de la ejecución que incluya todos los items
      const incompleteItems = completedItems.filter(item => !item.isCompleted);
      
      const executionDetails = {
        completed: completedItems.filter(item => item.isCompleted).map(item => ({
          id: item.id,
          title: item.title,
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
          maintenanceId: item.maintenanceId
        })),
        incomplete: incompleteItems.map(item => ({
          id: item.id,
          title: item.title,
          status: 'NOT_COMPLETED',
          justification: justifications.find(j => j.itemTitle === item.title)?.justification || 'Sin justificación',
          skippedAt: new Date().toISOString(),
          maintenanceId: item.maintenanceId
        }))
      };

      const checklistExecution = await prisma.checklistExecution.create({
        data: {
          checklistId: checklistId,
          executedBy: executedBy,
          executionTime: executionTime,
          completedItems: completedItems.filter(item => item.isCompleted).length,
          totalItems: totalItems || completedItems.length,
          companyId: companyId,
          sectorId: sectorId,
          executedAt: new Date(),
          status: status,
          justifications: justifications.length > 0 ? JSON.stringify(justifications) : null,
          executionDetails: JSON.stringify(executionDetails) // Nuevo campo para detalles
        }
      });

      console.log('✅ Checklist execution recorded successfully:', {
        executionId: checklistExecution.id,
        status: status,
        sectorId: sectorId,
        checklistId: checklistId,
        completedItems: checklistExecution.completedItems,
        totalItems: checklistExecution.totalItems
      });
    } catch (error) {
      console.error('❌ Error recording checklist execution:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        meta: error.meta
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Checklist ejecutado correctamente',
      results: results
    });

  } catch (error) {
    console.error('❌ Error executing checklist:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
