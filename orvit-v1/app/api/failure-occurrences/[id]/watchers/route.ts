/**
 * API: /api/failure-occurrences/[id]/watchers
 *
 * GET - Lista de seguidores de una falla
 * POST - Seguir una falla
 * DELETE - Dejar de seguir una falla
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const watchSchema = z.object({
  reason: z.string().max(255).optional(),
});

/**
 * GET /api/failure-occurrences/[id]/watchers
 * Lista de seguidores
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
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const currentUserId = payload.userId as number;
    const occurrenceId = parseInt(params.id);

    if (isNaN(occurrenceId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Verificar que la falla existe y pertenece a la empresa
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: { id: occurrenceId, companyId },
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // 3. Obtener watchers
    const watchers = await prisma.failureWatcher.findMany({
      where: { failureOccurrenceId: occurrenceId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Verificar si el usuario actual es watcher
    const isWatching = watchers.some((w) => w.userId === currentUserId);

    return NextResponse.json({
      watchers: watchers.map((w) => ({
        id: w.id,
        user: w.user,
        reason: w.reason,
        createdAt: w.createdAt,
      })),
      count: watchers.length,
      isWatching,
    });
  } catch (error: any) {
    console.error('❌ Error en GET /api/failure-occurrences/[id]/watchers:', error);
    // Si es error de columna/tabla no existente, retornar vacío
    if (error?.code === 'P2010' || error?.code === 'P2022' || error?.message?.includes('column') || error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
      console.warn('⚠️ Tabla failure_watchers no existe. Ejecutar: npx prisma db push');
      return NextResponse.json({
        watchers: [],
        count: 0,
        isWatching: false,
        _warning: 'Schema desactualizado - ejecutar: npx prisma db push'
      });
    }
    return NextResponse.json(
      { error: 'Error al obtener seguidores', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/failure-occurrences/[id]/watchers
 * Seguir una falla
 */
export async function POST(
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
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;
    const occurrenceId = parseInt(params.id);

    if (isNaN(occurrenceId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Parsear body
    const body = await request.json().catch(() => ({}));
    const validationResult = watchSchema.safeParse(body);
    const reason = validationResult.success ? validationResult.data.reason : undefined;

    // 3. Verificar que la falla existe
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: { id: occurrenceId, companyId },
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // 4. Crear watcher (upsert para evitar duplicados)
    const watcher = await prisma.failureWatcher.upsert({
      where: {
        failureOccurrenceId_userId: {
          failureOccurrenceId: occurrenceId,
          userId,
        },
      },
      update: {
        reason,
        updatedAt: new Date(),
      },
      create: {
        failureOccurrenceId: occurrenceId,
        userId,
        reason,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    console.log(`👁️ Usuario ${userId} ahora sigue falla ${occurrenceId}`);

    return NextResponse.json({
      success: true,
      watcher: {
        id: watcher.id,
        user: watcher.user,
        reason: watcher.reason,
        createdAt: watcher.createdAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('❌ Error en POST /api/failure-occurrences/[id]/watchers:', error);
    return NextResponse.json(
      { error: 'Error al seguir falla', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/failure-occurrences/[id]/watchers
 * Dejar de seguir una falla
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
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;
    const occurrenceId = parseInt(params.id);

    if (isNaN(occurrenceId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Verificar que la falla existe
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: { id: occurrenceId, companyId },
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // 3. Eliminar watcher
    await prisma.failureWatcher.deleteMany({
      where: {
        failureOccurrenceId: occurrenceId,
        userId,
      },
    });

    console.log(`👁️ Usuario ${userId} dejó de seguir falla ${occurrenceId}`);

    return NextResponse.json({
      success: true,
      message: 'Dejaste de seguir esta falla',
    });
  } catch (error: any) {
    console.error('❌ Error en DELETE /api/failure-occurrences/[id]/watchers:', error);
    return NextResponse.json(
      { error: 'Error al dejar de seguir', detail: error.message },
      { status: 500 }
    );
  }
}
