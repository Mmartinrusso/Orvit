import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

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

// PUT /api/failures/[id]/solution - Actualizar solo la solución de una falla
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
    const {
      solution,
      toolsUsed,
      sparePartsUsed,
      actualHours,
      solutionAttachments
    } = body;

    console.log(`📝 PUT /api/failures/${failureId}/solution - Actualizando solución`);

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

    // Obtener datos adicionales existentes
    let additionalData = {};
    try {
      if (existingFailure.notes) {
        additionalData = JSON.parse(existingFailure.notes);
      }
    } catch (error) {
      console.warn('Error parseando notas existentes, usando objeto vacío');
      additionalData = {};
    }

    // Actualizar solo los campos de solución
    const updatedAdditionalData = {
      ...additionalData,
      solution: solution || '',
      toolsUsed: toolsUsed || [],
      sparePartsUsed: sparePartsUsed || [],
      actualHours: actualHours || null
    };

    // ✅ OPTIMIZADO: Usar transacción para atomicidad de update + attachments
    const updatedFailure = await prisma.$transaction(async (tx) => {
      // Actualizar la falla con la solución
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
        // Eliminar adjuntos de solución existentes
        await tx.workOrderAttachment.deleteMany({
          where: {
            workOrderId: parseInt(failureId),
            fileType: { startsWith: 'solution_' }
          }
        });

        // Crear nuevos adjuntos de solución
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
