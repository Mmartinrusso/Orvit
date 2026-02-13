/**
 * API: /api/mantenimiento/unidades-moviles/batch
 *
 * PUT - Actualizar múltiples unidades móviles en una sola operación
 * DELETE - Eliminar múltiples unidades móviles
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/shared-helpers';
import {
  validateBulkTenantAccess,
  buildBulkResponse,
} from '@/lib/auth/bulk-authorization';

// Schema para batch update
const batchUpdateSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Se requiere al menos un ID'),
  data: z.object({
    estado: z.enum(['ACTIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO', 'DESHABILITADO']).optional(),
    sectorId: z.number().int().nullable().optional(),
  }).refine(obj => Object.keys(obj).length > 0, {
    message: 'Se requiere al menos un campo para actualizar'
  })
});

// Schema para batch delete
const batchDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Se requiere al menos un ID')
});

export const dynamic = 'force-dynamic';

// PUT - Actualizar múltiples unidades
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const validation = batchUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { ids, data } = validation.data;

    // Cargar items y validar tenant access
    const items = await prisma.unidadMovil.findMany({
      where: { id: { in: ids } },
      select: { id: true, companyId: true },
    });

    const { authorized, unauthorized } = validateBulkTenantAccess(items, ids, user!.companyId);

    if (authorized.length === 0) {
      return buildBulkResponse({
        processed: [],
        rejected: [],
        unauthorized,
        message: 'No se encontraron unidades autorizadas para actualizar',
      });
    }

    const result = await prisma.unidadMovil.updateMany({
      where: { id: { in: authorized }, companyId: user!.companyId },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    return buildBulkResponse({
      processed: authorized,
      rejected: [],
      unauthorized,
      message: `${result.count} unidades actualizadas correctamente`,
    });
  } catch (error) {
    console.error('Error en PUT /api/mantenimiento/unidades-moviles/batch:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar múltiples unidades
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const validation = batchDeleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { ids } = validation.data;

    // Cargar items y validar tenant access
    const items = await prisma.unidadMovil.findMany({
      where: { id: { in: ids } },
      select: { id: true, companyId: true, nombre: true },
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
        message: 'No se encontraron unidades autorizadas para eliminar',
      });
    }

    // Verificar OTs activas solo en los autorizados
    const unitsWithActiveWO = await prisma.unidadMovil.findMany({
      where: {
        id: { in: authorized },
        workOrders: {
          some: {
            status: { in: ['PENDING', 'IN_PROGRESS'] }
          }
        }
      },
      select: { id: true, nombre: true }
    });

    const blockedIds = new Set(unitsWithActiveWO.map((u) => u.id));
    const rejected = unitsWithActiveWO.map((u) => ({
      id: u.id,
      reason: `Tiene OTs activas: ${u.nombre}`,
    }));
    const deletableIds = authorized.filter((id) => !blockedIds.has(id));

    if (deletableIds.length > 0) {
      await prisma.unidadMovil.deleteMany({
        where: { id: { in: deletableIds }, companyId: user!.companyId },
      });
    }

    return buildBulkResponse({
      processed: deletableIds,
      rejected,
      unauthorized,
      message: `${deletableIds.length} unidades eliminadas correctamente`,
    });
  } catch (error) {
    console.error('Error en DELETE /api/mantenimiento/unidades-moviles/batch:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
