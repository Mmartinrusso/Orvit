import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

// Helper para obtener el usuario actual
async function getCurrentUser() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET || 'tu-clave-secreta-super-segura'));
    const user = await prisma.user.findUnique({ where: { id: payload.userId as number } });
    return user;
  } catch (error) { return null; }
}

// POST /api/maintenance/preventive/[id]/complete - Completar mantenimiento preventivo
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const maintenanceId = params.id;
    const body = await request.json();
    const { executionData } = body;

    // Verificar autenticación
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Buscar el template de mantenimiento preventivo
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

    // Parsear datos del template
    const templateData = JSON.parse(maintenanceTemplate.url);

    // Verificar que el usuario tiene permiso para completar este mantenimiento
    if (templateData.assignedToId && String(templateData.assignedToId) !== String(user.id)) {
      return NextResponse.json(
        { error: 'Solo el usuario asignado puede completar este mantenimiento preventivo' },
        { status: 403 }
      );
    }

    // Si no hay usuario asignado, solo ADMIN y SUPERVISOR pueden completar
    if (!templateData.assignedToId) {
      if (user.role !== 'ADMIN' && user.role !== 'SUPERVISOR' && user.role !== 'SUPERADMIN') {
        return NextResponse.json(
          { error: 'Este mantenimiento no tiene usuario asignado. Solo administradores y supervisores pueden completarlo' },
          { status: 403 }
        );
      }
    }

    const completedAt = new Date();
    
    // Calcular próxima fecha de mantenimiento
    const nextMaintenanceDate = new Date(completedAt);
    nextMaintenanceDate.setDate(nextMaintenanceDate.getDate() + templateData.frequencyDays);

    // Ajustar a día laborable si es necesario
    while (nextMaintenanceDate.getDay() === 0 || nextMaintenanceDate.getDay() === 6) {
      nextMaintenanceDate.setDate(nextMaintenanceDate.getDate() + 1);
    }

    // ✅ Calcular métricas
    const actualDuration = executionData?.duration || executionData?.actualHours || 0;
    const averageHourlyRate = 25;
    const estimatedCost = actualDuration * averageHourlyRate;

    // Preparar datos del template actualizado
    const updatedTemplateData = {
      ...templateData,
      lastMaintenanceDate: completedAt.toISOString(),
      nextMaintenanceDate: nextMaintenanceDate.toISOString(),
      maintenanceCount: (templateData.maintenanceCount || 0) + 1,
      lastExecutionDuration: actualDuration,
      lastExecutionNotes: executionData?.notes || '',
      averageDuration: templateData.averageDuration
        ? ((templateData.averageDuration + actualDuration) / 2)
        : actualDuration,
      executionHistory: [
        ...(templateData.executionHistory || []),
        {
          id: completedAt.getTime(),
          executedAt: completedAt.toISOString(),
          executedById: user.id,
          executedByName: user.name,
          actualDuration: actualDuration,
          actualDurationUnit: 'HOURS',
          notes: executionData?.notes || '',
          issues: '',
          mttr: actualDuration,
          cost: estimatedCost,
          completionStatus: 'COMPLETED',
          toolsUsed: executionData?.toolsUsed || [],
          photoUrls: executionData?.photoUrls || []
        }
      ],
      updatedAt: new Date().toISOString()
    };

    // ✅ OPTIMIZADO: Usar transacción atómica para todas las operaciones
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear registro de ejecución si se proporcionan datos
      let executionRecord = null;
      if (executionData) {
        executionRecord = await tx.document.create({
          data: {
            entityType: 'PREVENTIVE_MAINTENANCE_EXECUTION',
            entityId: `maintenance-${maintenanceId}-${completedAt.getTime()}`,
            originalName: `Ejecución: ${templateData.title} - ${completedAt.toLocaleDateString('es-ES')}`,
            url: JSON.stringify({
              maintenanceId: Number(maintenanceId),
              executedById: executionData.userId ? Number(executionData.userId) : user.id,
              executedByName: user.name,
              duration: executionData.duration || null,
              notes: executionData.notes || '',
              attachments: executionData.attachments || [],
              actualHours: executionData.actualHours || null,
              toolsUsed: executionData.toolsUsed || [],
              photoUrls: executionData.photoUrls || [],
              status: 'completed',
              executedAt: completedAt.toISOString(),
              createdAt: new Date().toISOString()
            })
          }
        });
      }

      // 2. Actualizar el template
      const updatedTemplate = await tx.document.update({
        where: { id: Number(maintenanceId) },
        data: {
          url: JSON.stringify(updatedTemplateData)
        }
      });

      // 3. Crear registro en maintenance_history
      if (templateData.machineId) {
        await tx.maintenance_history.create({
          data: {
            workOrderId: Number(maintenanceId),
            machineId: templateData.machineId,
            componentId: templateData.componentIds?.[0] || null,
            executedAt: completedAt,
            executedById: user.id,
            duration: actualDuration,
            cost: estimatedCost,
            notes: executionData?.notes || '',
            rootCause: null,
            correctiveActions: null,
            preventiveActions: null,
            spareParts: null,
            nextMaintenanceDate: nextMaintenanceDate,
            mttr: actualDuration,
            mtbf: null,
            completionRate: 100,
            qualityScore: null
          }
        });
      }

      // 4. Crear próxima instancia de mantenimiento
      const nextInstance = await tx.document.create({
        data: {
          entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
          entityId: `template-${maintenanceId}-${nextMaintenanceDate.toISOString().split('T')[0]}`,
          originalName: `${templateData.title} - ${nextMaintenanceDate.toLocaleDateString('es-ES')}`,
          url: JSON.stringify({
            ...updatedTemplateData,
            templateId: maintenanceId,
            scheduledDate: nextMaintenanceDate.toISOString(),
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

      return { executionRecord, updatedTemplate, nextInstance };
    });

    const { executionRecord, updatedTemplate, nextInstance } = result;

    const response = {
      success: true,
      maintenance: updatedTemplate,
      execution: executionRecord,
      nextMaintenance: {
        id: nextInstance.id,
        scheduledDate: nextMaintenanceDate.toISOString(),
        title: templateData.title
      },
      message: `Mantenimiento preventivo completado exitosamente. Próximo mantenimiento programado para ${nextMaintenanceDate.toLocaleDateString('es-ES')}`,
      timestamp: completedAt.toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error en POST /api/maintenance/preventive/[id]/complete:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 