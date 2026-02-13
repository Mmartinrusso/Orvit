import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret
import { validateRequest } from '@/lib/validations/helpers';
import { UpdateFailureSchema } from '@/lib/validations/failures';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener el usuario actual con su empresa
async function getCurrentUser() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    // Obtener usuario con su empresa
    const userWithCompany = await prisma.$queryRaw`
      SELECT u.*, uc."companyId" 
      FROM "User" u 
      INNER JOIN "UserOnCompany" uc ON u.id = uc."userId" 
      WHERE u.id = ${payload.userId as number} 
      LIMIT 1
    ` as any[];

    if (userWithCompany.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    return userWithCompany[0];
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return null;
  }
}

// PUT /api/failures/[id] - Actualizar falla existente
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const failureId = params.id;

    if (!failureId) {
      return NextResponse.json(
        { error: 'ID de falla requerido' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const validation = validateRequest(UpdateFailureSchema, body);
    if (!validation.success) {
      return validation.response;
    }

    const {
      title,
      description,
      selectedComponents,
      selectedSubcomponents,
      failureType,
      priority,
      estimatedHours,
      solution,
      toolsUsed,
      sparePartsUsed,
      actualHours,
      status,
      failureFiles,
      solutionAttachments
    } = validation.data;

    console.log(`📝 PUT /api/failures/${failureId} - Actualizando falla`);

    // Verificar que la falla existe
    const existingFailure = await prisma.workOrder.findUnique({
      where: { id: parseInt(failureId) },
      include: { attachments: true }
    });

    if (!existingFailure) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // Preparar datos adicionales
    const additionalData = {
      selectedComponents: selectedComponents || [],
      selectedSubcomponents: selectedSubcomponents || [],
      toolsUsed: toolsUsed || [],
      sparePartsUsed: sparePartsUsed || [],
      failureType: failureType || 'MECANICA',
      solution: solution || ''
    };

    // Transacción atómica: actualizar falla + reemplazar adjuntos
    const updatedFailure = await prisma.$transaction(async (tx) => {
      // 1. Actualizar la falla
      const updated = await tx.workOrder.update({
        where: { id: parseInt(failureId) },
        data: {
          title: title || existingFailure.title,
          description: description || existingFailure.description,
          priority: priority || existingFailure.priority,
          status: status || existingFailure.status,
          estimatedHours: estimatedHours !== undefined ? estimatedHours : existingFailure.estimatedHours,
          actualHours: actualHours !== undefined ? actualHours : existingFailure.actualHours,
          notes: JSON.stringify(additionalData),
          updatedAt: new Date()
        },
        include: {
          machine: {
            select: {
              id: true,
              name: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              name: true
            }
          },
          attachments: {
            select: {
              id: true,
              fileName: true,
              url: true,
              fileType: true
            }
          }
        }
      });

      // 2. Actualizar adjuntos si se proporcionaron nuevos
      if (failureFiles && failureFiles.length > 0 || solutionAttachments && solutionAttachments.length > 0) {
        // Eliminar adjuntos existentes
        await tx.workOrderAttachment.deleteMany({
          where: { workOrderId: parseInt(failureId) }
        });

        // Crear adjuntos de falla
        if (failureFiles && failureFiles.length > 0) {
          await tx.workOrderAttachment.createMany({
            data: failureFiles.map((attachment: any) => ({
              workOrderId: parseInt(failureId),
              fileName: attachment.name,
              url: attachment.url,
              fileType: attachment.type,
              fileSize: attachment.size
            }))
          });
        }

        // Crear adjuntos de solución
        if (solutionAttachments && solutionAttachments.length > 0) {
          await tx.workOrderAttachment.createMany({
            data: solutionAttachments.map((attachment: any) => ({
              workOrderId: parseInt(failureId),
              fileName: attachment.name,
              url: attachment.url,
              fileType: `solution_${attachment.type}`,
              fileSize: attachment.size
            }))
          });
        }
      }

      return updated;
    });

    console.log(`✅ Falla actualizada exitosamente: ${updatedFailure.id}`);

    return NextResponse.json({
      success: true,
      failure: updatedFailure,
      message: 'Falla actualizada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en PUT /api/failures/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/failures/[id] - Eliminar falla
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const failureId = params.id;

    if (!failureId) {
      return NextResponse.json(
        { error: 'ID de falla requerido' },
        { status: 400 }
      );
    }

    console.log(`🗑️ DELETE /api/failures/${failureId} - Eliminando falla`);

    const failureIdNum = parseInt(failureId);

    // Verificar que la falla existe
    const existingFailure = await prisma.workOrder.findUnique({
      where: { id: failureIdNum }
    });

    if (!existingFailure) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // 1. Eliminar WorkOrders que son soluciones de esta falla (isOccurrenceSolution)
    const allCorrectiveWorkOrders = await prisma.workOrder.findMany({
      where: {
        type: 'CORRECTIVE',
        machineId: existingFailure.machineId,
      },
      select: { id: true, notes: true }
    });

    // Filtrar los que tienen relatedFailureId igual a esta falla
    const relatedWorkOrderIds: number[] = [];
    for (const wo of allCorrectiveWorkOrders) {
      try {
        if (wo.notes) {
          const woNotes = JSON.parse(wo.notes);
          if (woNotes.relatedFailureId === failureIdNum && woNotes.isOccurrenceSolution) {
            relatedWorkOrderIds.push(wo.id);
          }
        }
      } catch (e) {
        // No se pudo parsear notas, ignorar
      }
    }

    // Transacción atómica: eliminar toda la cascada de dependencias
    await prisma.$transaction(async (tx) => {
      // 1. Eliminar WorkOrders de solución relacionados y sus adjuntos
      if (relatedWorkOrderIds.length > 0) {
        console.log(`🗑️ Eliminando ${relatedWorkOrderIds.length} WorkOrders de solución relacionados`);
        await tx.workOrderAttachment.deleteMany({
          where: { workOrderId: { in: relatedWorkOrderIds } }
        });
        await tx.workOrder.deleteMany({
          where: { id: { in: relatedWorkOrderIds } }
        });
      }

      // 2. Eliminar FailureOccurrences y sus FailureSolutions (cascade via FK)
      try {
        await tx.failureOccurrence.deleteMany({
          where: { failureId: failureIdNum }
        });
        console.log(`🗑️ Eliminadas ocurrencias de la falla ${failureIdNum}`);
      } catch (e) {
        console.log(`⚠️ No se pudieron eliminar ocurrencias (tabla puede no existir)`);
      }

      // 3. Eliminar adjuntos de la falla principal
      await tx.workOrderAttachment.deleteMany({
        where: { workOrderId: failureIdNum }
      });

      // 4. Eliminar comentarios de la falla
      await tx.workOrderComment.deleteMany({
        where: { workOrderId: failureIdNum }
      });

      // 5. Eliminar la falla principal
      await tx.workOrder.delete({
        where: { id: failureIdNum }
      });
    });

    console.log(`✅ Falla y sus soluciones eliminadas exitosamente: ${failureId}`);

    return NextResponse.json({
      success: true,
      message: 'Falla eliminada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en DELETE /api/failures/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 