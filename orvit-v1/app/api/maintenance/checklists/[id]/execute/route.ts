import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const checklistId = parseInt(params.id);
    const data = await request.json();

    // Obtener el checklist con sus items
    const checklist = await prisma.maintenanceChecklist.findUnique({
      where: { id: checklistId },
      include: {
        items: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!checklist) {
      return NextResponse.json(
        { error: 'Checklist no encontrado' },
        { status: 404 }
      );
    }

    // Crear ejecuciones para cada item
    const executions = await Promise.all(
      data.executions.map(async (execution: any) => {
        const item = checklist.items.find(i => i.id === execution.checklistItemId);
        if (!item) return null;

        // Validar valores si hay límites definidos
        let hasIssue = execution.hasIssue || false;
        let issueDescription = execution.issueDescription || '';

        if (execution.actualValue && item.minValue !== null && item.maxValue !== null) {
          const value = parseFloat(execution.actualValue);
          if (!isNaN(value)) {
            if (value < item.minValue || value > item.maxValue) {
              hasIssue = true;
              issueDescription = `Valor fuera del rango esperado (${item.minValue}-${item.maxValue})`;
            }
          }
        }

        return prisma.checklistExecution.create({
          data: {
            checklistItemId: execution.checklistItemId,
            workOrderId: data.workOrderId,
            executedById: data.executedById,
            isCompleted: execution.isCompleted || false,
            actualValue: execution.actualValue,
            notes: execution.notes,
            hasIssue,
            issueDescription
          },
          include: {
            checklistItem: true,
            executedBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        });
      })
    );

    // Filtrar nulls
    const validExecutions = executions.filter(e => e !== null);

    // Calcular estadísticas de completitud
    const completedItems = validExecutions.filter(e => e.isCompleted).length;
    const totalItems = checklist.items.length;
    const completionRate = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

    // Identificar problemas
    const issuesFound = validExecutions.filter(e => e.hasIssue).length;

    // Actualizar la orden de trabajo si se proporciona
    if (data.workOrderId) {
      await prisma.workOrder.update({
        where: { id: data.workOrderId },
        data: {
          completionRate,
          notes: data.generalNotes 
            ? `${data.generalNotes}\n\nChecklist ejecutado: ${completedItems}/${totalItems} items completados${issuesFound > 0 ? `, ${issuesFound} problemas encontrados` : ''}`
            : undefined
        }
      });
    }

    return NextResponse.json({
      executions: validExecutions,
      summary: {
        totalItems,
        completedItems,
        completionRate,
        issuesFound,
        executedAt: new Date(),
        executedBy: data.executedById
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error executing checklist:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

