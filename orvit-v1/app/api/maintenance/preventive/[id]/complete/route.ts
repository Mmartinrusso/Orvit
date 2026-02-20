import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import {
  completeTemplate,
} from '@/lib/maintenance/preventive-template.repository';

// Helper para obtener el usuario actual
async function getCurrentUser() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET || 'tu-clave-secreta-super-segura'));
    const user = await prisma.user.findUnique({ where: { id: payload.userId as number } });
    return user;
  } catch { return null; }
}

// POST /api/maintenance/preventive/[id]/complete - Completar mantenimiento preventivo
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    const body = await request.json();
    const { executionData } = body;

    // Verificar autenticación
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Buscar el template
    const template = await prisma.preventiveTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Mantenimiento preventivo no encontrado' },
        { status: 404 }
      );
    }

    // Verificar permisos
    if (template.assignedToId && template.assignedToId !== user.id) {
      return NextResponse.json(
        { error: 'Solo el usuario asignado puede completar este mantenimiento preventivo' },
        { status: 403 }
      );
    }

    if (!template.assignedToId) {
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
    nextMaintenanceDate.setDate(nextMaintenanceDate.getDate() + template.frequencyDays);
    while (nextMaintenanceDate.getDay() === 0 || nextMaintenanceDate.getDay() === 6) {
      nextMaintenanceDate.setDate(nextMaintenanceDate.getDate() + 1);
    }

    // Calcular métricas
    const actualDuration = executionData?.duration || executionData?.actualHours || 0;
    const averageHourlyRate = 25;
    const estimatedCost = actualDuration * averageHourlyRate;
    const newCount = (template.maintenanceCount || 0) + 1;
    const newAvgDuration = template.averageDuration
      ? ((template.averageDuration + actualDuration) / 2)
      : actualDuration;

    // Construir historial de ejecución
    const existingHistory = Array.isArray(template.executionHistory)
      ? (template.executionHistory as any[])
      : [];

    const newHistoryEntry = {
      id: completedAt.getTime(),
      executedAt: completedAt.toISOString(),
      executedById: user.id,
      executedByName: user.name,
      actualDuration,
      actualDurationUnit: 'HOURS',
      notes: executionData?.notes || '',
      issues: '',
      mttr: actualDuration,
      cost: estimatedCost,
      completionStatus: 'COMPLETED',
      toolsUsed: executionData?.toolsUsed || [],
      photoUrls: executionData?.photoUrls || [],
    };

    // Transacción: actualizar template + crear instancia + maintenance_history
    const result = await prisma.$transaction(async (tx) => {
      // 1. Actualizar template con métricas
      await completeTemplate(id, {
        lastMaintenanceDate: completedAt,
        nextMaintenanceDate,
        maintenanceCount: newCount,
        lastExecutionDuration: actualDuration,
        averageDuration: newAvgDuration,
        executionHistory: [...existingHistory, newHistoryEntry],
      });

      // 2. Crear próxima instancia
      const nextInstance = await tx.preventiveInstance.create({
        data: {
          templateId: id,
          scheduledDate: nextMaintenanceDate,
          status: 'PENDING',
        },
      });

      // 3. Crear registro en maintenance_history si hay máquina
      if (template.machineId) {
        await tx.maintenance_history.create({
          data: {
            workOrderId: id,
            machineId: template.machineId,
            componentId: template.componentIds?.[0] || null,
            executedAt: completedAt,
            executedById: user.id,
            duration: actualDuration,
            cost: estimatedCost,
            notes: executionData?.notes || '',
            rootCause: null,
            correctiveActions: null,
            preventiveActions: null,
            spareParts: null,
            nextMaintenanceDate,
            mttr: actualDuration,
            mtbf: null,
            completionRate: 100,
            qualityScore: null,
          },
        });
      }

      return { nextInstance };
    });

    return NextResponse.json({
      success: true,
      maintenance: { id: template.id },
      nextMaintenance: {
        id: result.nextInstance.id,
        scheduledDate: nextMaintenanceDate.toISOString(),
        title: template.title,
      },
      message: `Mantenimiento preventivo completado exitosamente. Próximo mantenimiento programado para ${nextMaintenanceDate.toLocaleDateString('es-ES')}`,
      timestamp: completedAt.toISOString(),
    });

  } catch (error) {
    console.error('Error en POST /api/maintenance/preventive/[id]/complete:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
