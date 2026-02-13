/**
 * API: /api/work-orders/[id]/watchers
 *
 * GET - Obtener watchers de una OT
 * POST - Agregar watcher (seguir)
 * DELETE - Eliminar watcher (dejar de seguir)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/work-orders/[id]/watchers
 * Obtiene la lista de watchers de una OT
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que la OT existe y pertenece a la empresa
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, companyId: true }
    });

    if (!workOrder || workOrder.companyId !== companyId) {
      return NextResponse.json({ error: 'OT no encontrada' }, { status: 404 });
    }

    // Obtener watchers
    const watchers = await prisma.workOrderWatcher.findMany({
      where: { workOrderId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: watchers
    });

  } catch (error) {
    console.error('Error en GET /api/work-orders/[id]/watchers:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * POST /api/work-orders/[id]/watchers
 * Agrega al usuario actual como watcher (seguir OT)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = body.reason || 'MANUAL';

    // Verificar que la OT existe y pertenece a la empresa
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, companyId: true }
    });

    if (!workOrder || workOrder.companyId !== companyId) {
      return NextResponse.json({ error: 'OT no encontrada' }, { status: 404 });
    }

    // Verificar si ya es watcher
    const existingWatcher = await prisma.workOrderWatcher.findUnique({
      where: {
        workOrderId_userId: {
          workOrderId,
          userId
        }
      }
    });

    if (existingWatcher) {
      return NextResponse.json({
        success: true,
        message: 'Ya sigues esta OT',
        data: existingWatcher
      });
    }

    // Crear watcher
    const watcher = await prisma.workOrderWatcher.create({
      data: {
        workOrderId,
        userId,
        reason
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Ahora sigues esta OT',
      data: watcher
    }, { status: 201 });

  } catch (error) {
    console.error('Error en POST /api/work-orders/[id]/watchers:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * DELETE /api/work-orders/[id]/watchers
 * Elimina al usuario actual como watcher (dejar de seguir)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que la OT existe y pertenece a la empresa
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, companyId: true }
    });

    if (!workOrder || workOrder.companyId !== companyId) {
      return NextResponse.json({ error: 'OT no encontrada' }, { status: 404 });
    }

    // Eliminar watcher
    try {
      await prisma.workOrderWatcher.delete({
        where: {
          workOrderId_userId: {
            workOrderId,
            userId
          }
        }
      });
    } catch (e) {
      // Si no existe, no es error
    }

    return NextResponse.json({
      success: true,
      message: 'Ya no sigues esta OT'
    });

  } catch (error) {
    console.error('Error en DELETE /api/work-orders/[id]/watchers:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
