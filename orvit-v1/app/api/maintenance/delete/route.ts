import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withGuards } from '@/lib/middleware/withGuards';

export const dynamic = 'force-dynamic';

// DELETE /api/maintenance/delete - Eliminar mantenimiento (autenticado)
export const DELETE = withGuards(async (request, ctx) => {
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

  try {
    if (type === 'preventive') {
      const templateId = Number(maintenanceId);

      // Eliminar instancias e instructivos en paralelo
      await Promise.all([
        prisma.document.deleteMany({
          where: {
            entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
            entityId: { startsWith: `template-${templateId}` }
          }
        }),
        prisma.document.deleteMany({
          where: {
            entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
            entityId: templateId.toString()
          }
        })
      ]);

      const deletedTemplate = await prisma.document.delete({
        where: { id: templateId }
      });

      return NextResponse.json({
        success: true,
        message: 'Mantenimiento preventivo eliminado correctamente',
        deletedTemplate: {
          id: deletedTemplate.id,
          name: deletedTemplate.originalName
        }
      });

    } else if (type === 'corrective') {
      const workOrderId = Number(maintenanceId);

      // Verificar que el workOrder pertenece a la empresa del usuario
      const workOrder = await prisma.workOrder.findFirst({
        where: { id: workOrderId, companyId: ctx.user.companyId }
      });

      if (!workOrder) {
        return NextResponse.json(
          { error: 'Mantenimiento no encontrado' },
          { status: 404 }
        );
      }

      const deletedWorkOrder = await prisma.workOrder.delete({
        where: { id: workOrderId }
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
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Mantenimiento no encontrado' },
        { status: 404 }
      );
    }
    throw error; // withGuards lo captura y loguea
  }
});
