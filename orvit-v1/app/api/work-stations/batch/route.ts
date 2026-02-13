import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { batchUpdateSchema, batchDeleteSchema, validateSafe } from '@/lib/work-stations/validations';
import { requireAuth } from '@/lib/auth/shared-helpers';
import {
  validateBulkTenantAccess,
  buildBulkResponse,
} from '@/lib/auth/bulk-authorization';

// ============================================================
// PUT /api/work-stations/batch - Actualizar múltiples puestos
// ============================================================
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const validation = validateSafe(batchUpdateSchema, body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 });
    }

    const { ids, data } = validation.data;

    // Cargar items y validar tenant access
    const items = await prisma.workStation.findMany({
      where: { id: { in: ids } },
      select: { id: true, companyId: true },
    });

    const { authorized, unauthorized } = validateBulkTenantAccess(items, ids, user!.companyId);

    if (authorized.length === 0) {
      return buildBulkResponse({
        processed: [],
        rejected: [],
        unauthorized,
        message: 'No se encontraron puestos autorizados para actualizar',
      });
    }

    // Si se quiere cambiar el sector, verificar que pertenezca a la empresa
    if (data.sectorId) {
      const sector = await prisma.sector.findFirst({
        where: {
          id: data.sectorId,
          companyId: user!.companyId,
        },
      });

      if (!sector) {
        return NextResponse.json(
          { error: 'El sector no pertenece a esta empresa' },
          { status: 400 },
        );
      }
    }

    // Actualizar solo los autorizados
    const result = await prisma.workStation.updateMany({
      where: { id: { in: authorized }, companyId: user!.companyId },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.sectorId && { sectorId: data.sectorId }),
      },
    });

    return buildBulkResponse({
      processed: authorized,
      rejected: [],
      unauthorized,
      message: `${result.count} puesto(s) actualizado(s) correctamente`,
    });
  } catch (error) {
    console.error('Error en batch update:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/work-stations/batch - Eliminar múltiples puestos
// ============================================================
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const validation = validateSafe(batchDeleteSchema, body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 });
    }

    const { ids } = validation.data;

    // Cargar items y validar tenant access
    const items = await prisma.workStation.findMany({
      where: { id: { in: ids } },
      select: { id: true, companyId: true, name: true },
    });

    const { authorized, unauthorized } = validateBulkTenantAccess(
      items.map((i) => ({ id: i.id, companyId: i.companyId })),
      ids,
      user!.companyId,
    );

    if (authorized.length === 0) {
      return buildBulkResponse({
        processed: [],
        rejected: [],
        unauthorized,
        message: 'No se encontraron puestos autorizados para eliminar',
      });
    }

    // Verificar OTs activas solo en los autorizados
    const withActiveOrders = await prisma.workStation.findMany({
      where: {
        id: { in: authorized },
        workOrders: {
          some: {
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
        },
      },
      select: { id: true, name: true },
    });

    const blockedIds = new Set(withActiveOrders.map((ws) => ws.id));
    const rejected = withActiveOrders.map((ws) => ({
      id: ws.id,
      reason: `Tiene OTs activas: ${ws.name}`,
    }));
    const deletableIds = authorized.filter((id) => !blockedIds.has(id));

    if (deletableIds.length > 0) {
      await prisma.$transaction([
        prisma.workStationInstructive.deleteMany({
          where: { workStationId: { in: deletableIds } },
        }),
        prisma.workStationMachine.deleteMany({
          where: { workStationId: { in: deletableIds } },
        }),
        prisma.workStationComponent.deleteMany({
          where: { workStationId: { in: deletableIds } },
        }),
        prisma.workStation.deleteMany({
          where: { id: { in: deletableIds }, companyId: user!.companyId },
        }),
      ]);
    }

    return buildBulkResponse({
      processed: deletableIds,
      rejected,
      unauthorized,
      message: `${deletableIds.length} puesto(s) eliminado(s) correctamente`,
    });
  } catch (error) {
    console.error('Error en batch delete:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
