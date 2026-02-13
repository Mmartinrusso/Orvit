/**
 * API: /api/mantenimiento/unidades-moviles/batch
 *
 * PUT - Actualizar múltiples unidades móviles en una sola operación
 * DELETE - Eliminar múltiples unidades móviles
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

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
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // 2. Parsear y validar body
    const body = await request.json();
    const validation = batchUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { ids, data } = validation.data;

    // 3. Ejecutar actualización batch
    const result = await prisma.unidadMovil.updateMany({
      where: { id: { in: ids } },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      updated: result.count,
      message: `${result.count} unidades actualizadas correctamente`
    });

  } catch (error) {
    console.error('❌ Error en PUT /api/mantenimiento/unidades-moviles/batch:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar múltiples unidades
export async function DELETE(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // 2. Parsear y validar body
    const body = await request.json();
    const validation = batchDeleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { ids } = validation.data;

    // 3. Verificar si alguna tiene work orders activas
    const unitsWithActiveWO = await prisma.unidadMovil.findMany({
      where: {
        id: { in: ids },
        workOrders: {
          some: {
            status: { in: ['PENDING', 'IN_PROGRESS'] }
          }
        }
      },
      select: { id: true, nombre: true }
    });

    if (unitsWithActiveWO.length > 0) {
      return NextResponse.json({
        error: 'Algunas unidades tienen órdenes de trabajo activas',
        unitsWithActiveWO: unitsWithActiveWO.map(u => ({ id: u.id, nombre: u.nombre }))
      }, { status: 400 });
    }

    // 4. Ejecutar eliminación batch
    const result = await prisma.unidadMovil.deleteMany({
      where: { id: { in: ids } }
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `${result.count} unidades eliminadas correctamente`
    });

  } catch (error) {
    console.error('❌ Error en DELETE /api/mantenimiento/unidades-moviles/batch:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
