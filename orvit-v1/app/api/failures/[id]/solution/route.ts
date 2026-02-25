import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// PUT /api/failures/[id]/solution - Actualizar solo la solución de una falla
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Autenticación con verifyToken (reemplaza raw SQL)
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const failureId = params.id;

    if (!failureId) {
      return NextResponse.json(
        { error: 'ID de falla requerido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      solution,
      toolsUsed,
      sparePartsUsed,
      actualHours,
      solutionAttachments
    } = body;

    console.log(`📝 PUT /api/failures/${failureId}/solution - Actualizando solución`);

    // 2. Verificar que la falla existe
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

    // 3. Company boundary check
    if (payload.companyId && existingFailure.companyId !== payload.companyId) {
      const userCompany = await prisma.companyUser.findFirst({
        where: { userId: payload.userId as number, companyId: existingFailure.companyId }
      });
      if (!userCompany) {
        return NextResponse.json(
          { error: 'No autorizado para esta empresa' },
          { status: 403 }
        );
      }
    }

    // 4. Obtener datos adicionales existentes
    let additionalData = {};
    try {
      if (existingFailure.notes) {
        additionalData = JSON.parse(existingFailure.notes);
      }
    } catch (error) {
      console.warn('Error parseando notas existentes, usando objeto vacío');
      additionalData = {};
    }

    // 5. Actualizar solo los campos de solución
    const updatedAdditionalData = {
      ...additionalData,
      solution: solution || '',
      toolsUsed: toolsUsed || [],
      sparePartsUsed: sparePartsUsed || [],
      actualHours: actualHours || null
    };

    // 6. Usar transacción para atomicidad de update + attachments
    const updatedFailure = await prisma.$transaction(async (tx) => {
      const updated = await tx.workOrder.update({
        where: { id: parseInt(failureId) },
        data: {
          actualHours: actualHours ? parseFloat(actualHours) : existingFailure.actualHours,
          notes: JSON.stringify(updatedAdditionalData),
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

      // Actualizar adjuntos de solución si se proporcionaron nuevos
      if (solutionAttachments && solutionAttachments.length > 0) {
        await tx.workOrderAttachment.deleteMany({
          where: {
            workOrderId: parseInt(failureId),
            fileType: { startsWith: 'solution_' }
          }
        });

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

      return updated;
    });

    console.log(`✅ Solución actualizada exitosamente para falla: ${updatedFailure.id}`);

    return NextResponse.json({
      success: true,
      failure: updatedFailure,
      message: 'Solución cargada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en PUT /api/failures/[id]/solution:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
