/**
 * API: /api/downtime/[id]
 *
 * GET - Obtener detalle de un downtime log
 * PATCH - Actualizar downtime log (categoria, reason, productionImpact)
 * DELETE - Eliminar downtime log (solo si está abierto y no tiene WorkOrder)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema de validación para PATCH
 */
const updateDowntimeSchema = z.object({
  category: z.enum(['UNPLANNED', 'PLANNED', 'EXTERNAL']).optional(),
  reason: z.string().max(500).optional(),
  productionImpact: z.string().max(500).optional(),
}).strict();

/**
 * GET /api/downtime/[id]
 * Obtiene detalle de un downtime log
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const downtimeId = parseInt(params.id);

    if (isNaN(downtimeId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Obtener downtime log
    const downtimeLog = await prisma.downtimeLog.findUnique({
      where: { id: downtimeId },
      include: {
        machine: {
          select: { id: true, name: true, assetCode: true }
        },
        failureOccurrence: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            reportedBy: true,
            reportedByUser: {
              select: { id: true, name: true }
            }
          }
        },
        workOrder: {
          select: {
            id: true,
            status: true,
            assignedToId: true,
            assignedTo: {
              select: { id: true, name: true }
            }
          }
        },
        returnedBy: {
          select: { id: true, name: true }
        }
      }
    });

    if (!downtimeLog || downtimeLog.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Downtime log no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(downtimeLog, { status: 200 });

  } catch (error) {
    console.error('❌ Error en GET /api/downtime/[id]:', error);
    return NextResponse.json(
      { error: 'Error al obtener downtime log' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/downtime/[id]
 * Actualiza un downtime log
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const downtimeId = parseInt(params.id);

    if (isNaN(downtimeId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Parsear y validar body
    const body = await request.json();
    const validationResult = updateDowntimeSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e =>
        `${e.path.join('.')}: ${e.message}`
      ).join(', ');

      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos para actualizar' },
        { status: 400 }
      );
    }

    // 3. Verificar que existe y pertenece a la empresa
    const existing = await prisma.downtimeLog.findUnique({
      where: { id: downtimeId }
    });

    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Downtime log no encontrado' },
        { status: 404 }
      );
    }

    // 4. Actualizar
    const updated = await prisma.downtimeLog.update({
      where: { id: downtimeId },
      data: updates,
      include: {
        machine: { select: { id: true, name: true } },
        failureOccurrence: { select: { id: true, title: true } },
        workOrder: { select: { id: true, status: true } }
      }
    });

    return NextResponse.json(updated, { status: 200 });

  } catch (error) {
    console.error('❌ Error en PATCH /api/downtime/[id]:', error);
    return NextResponse.json(
      { error: 'Error al actualizar downtime log' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/downtime/[id]
 * Elimina un downtime log (solo si está abierto y no tiene WorkOrder crítico)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const downtimeId = parseInt(params.id);

    if (isNaN(downtimeId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Verificar que existe y pertenece a la empresa
    const existing = await prisma.downtimeLog.findUnique({
      where: { id: downtimeId },
      include: {
        workOrder: { select: { id: true, status: true } }
      }
    });

    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Downtime log no encontrado' },
        { status: 404 }
      );
    }

    // 3. Validaciones de negocio
    if (existing.endedAt) {
      return NextResponse.json(
        { error: 'No se puede eliminar un downtime cerrado' },
        { status: 400 }
      );
    }

    if (existing.workOrder && existing.workOrder.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'No se puede eliminar downtime con WorkOrder activa' },
        { status: 400 }
      );
    }

    // 4. Eliminar
    await prisma.downtimeLog.delete({
      where: { id: downtimeId }
    });

    return NextResponse.json({
      success: true,
      message: `Downtime log #${downtimeId} eliminado`
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Error en DELETE /api/downtime/[id]:', error);
    return NextResponse.json(
      { error: 'Error al eliminar downtime log' },
      { status: 500 }
    );
  }
}
