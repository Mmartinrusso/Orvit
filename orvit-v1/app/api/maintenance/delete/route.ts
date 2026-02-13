import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';


// DELETE /api/maintenance/delete - Eliminar mantenimiento
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const maintenanceId = searchParams.get('id');
    const type = searchParams.get('type'); // 'preventive' o 'corrective'

    if (!maintenanceId) {
      return NextResponse.json(
        { error: 'ID del mantenimiento es requerido' },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { error: 'Tipo de mantenimiento es requerido (preventive o corrective)' },
        { status: 400 }
      );
    }

    console.log(`🗑️ Eliminando mantenimiento ${type} con ID: ${maintenanceId}`);

    if (type === 'preventive') {
      // Eliminar mantenimiento preventivo (template y todas sus instancias)
      const templateId = Number(maintenanceId);

      // 1. Eliminar todas las instancias del template
      const instances = await prisma.document.findMany({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
          entityId: {
            startsWith: `template-${templateId}`
          }
        }
      });

      console.log(`🗑️ Eliminando ${instances.length} instancias del template ${templateId}`);

      for (const instance of instances) {
        await prisma.document.delete({
          where: { id: instance.id }
        });
      }

      // 2. Eliminar todos los instructivos del template
      const instructives = await prisma.document.findMany({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
          entityId: templateId.toString()
        }
      });

      console.log(`🗑️ Eliminando ${instructives.length} instructivos del template ${templateId}`);

      for (const instructive of instructives) {
        await prisma.document.delete({
          where: { id: instructive.id }
        });
      }

      // 3. Eliminar el template principal
      const deletedTemplate = await prisma.document.delete({
        where: { id: templateId }
      });

      console.log(`✅ Mantenimiento preventivo eliminado: ${deletedTemplate.originalName}`);

      return NextResponse.json({
        success: true,
        message: 'Mantenimiento preventivo eliminado correctamente',
        deletedTemplate: {
          id: deletedTemplate.id,
          name: deletedTemplate.originalName
        }
      });

    } else if (type === 'corrective') {
      // Soft delete work order (mantenimiento correctivo)
      const workOrderId = Number(maintenanceId);

      // Verificar que la work order existe antes de intentar soft delete
      const existingWO = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        select: { id: true, title: true },
      });

      if (!existingWO) {
        return NextResponse.json(
          { error: 'Mantenimiento correctivo no encontrado' },
          { status: 404 }
        );
      }

      // Obtener usuario del JWT para auditoría
      let deletedByUserId = 'system';
      try {
        const token = cookies().get('token')?.value;
        if (token) {
          const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
          deletedByUserId = String(payload.userId);
        }
      } catch {
        // Si no se puede obtener el usuario, usar 'system'
      }

      const deletedWorkOrder = await prisma.workOrder.update({
        where: { id: workOrderId },
        data: {
          deletedAt: new Date(),
          deletedBy: deletedByUserId,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Mantenimiento correctivo eliminado correctamente',
        deletedWorkOrder: {
          id: deletedWorkOrder.id,
          title: deletedWorkOrder.title
        }
      });

    } else {
      return NextResponse.json(
        { error: 'Tipo de mantenimiento inválido. Debe ser "preventive" o "corrective"' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error eliminando mantenimiento:', error);
    
    if (error instanceof Error && 'code' in error && (error as any).code === 'P2025') {
      return NextResponse.json(
        { error: 'Mantenimiento no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor al eliminar el mantenimiento' },
      { status: 500 }
    );
  } finally {
    // No necesitamos desconectar prisma cuando usamos el singleton
  }
}
