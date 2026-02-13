import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { deleteS3File } from '@/lib/s3-utils';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener el usuario actual
async function getCurrentUser() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
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

// DELETE /api/failures/[id]/attachments/[attachmentId] - Eliminar attachment específico
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
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
    const attachmentId = params.attachmentId;

    if (!failureId || !attachmentId) {
      return NextResponse.json(
        { error: 'ID de falla y attachment son requeridos' },
        { status: 400 }
      );
    }

    console.log(`🗑️ DELETE /api/failures/${failureId}/attachments/${attachmentId} - Eliminando attachment`);

    // Verificar que la falla existe y pertenece a la empresa del usuario
    const failure = await prisma.workOrder.findFirst({
      where: { 
        id: parseInt(failureId),
        companyId: user.companyId
      },
      include: {
        attachments: {
          where: { id: parseInt(attachmentId) }
        }
      }
    });

    if (!failure) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    if (failure.attachments.length === 0) {
      return NextResponse.json(
        { error: 'Attachment no encontrado' },
        { status: 404 }
      );
    }

    const attachment = failure.attachments[0];

    // Eliminar archivo de S3
    const s3Deleted = await deleteS3File(attachment.url);
    
    if (!s3Deleted) {
      console.warn('⚠️ No se pudo eliminar el archivo de S3, pero continuando con la eliminación del registro');
    }

    // Eliminar registro de la base de datos
    await prisma.workOrderAttachment.delete({
      where: { id: parseInt(attachmentId) }
    });

    console.log(`✅ Attachment eliminado exitosamente: ${attachmentId}`);

    return NextResponse.json({
      success: true,
      message: 'Attachment eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en DELETE /api/failures/[id]/attachments/[attachmentId]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 