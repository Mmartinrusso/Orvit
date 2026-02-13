/**
 * API: /api/downtime
 *
 * GET - Lista de registros de downtime con filtros
 * POST - Crear nuevo registro de downtime (normalmente auto-creado, pero disponible manualmente)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';
import { handleDowntime } from '@/lib/corrective/downtime-manager';

export const dynamic = 'force-dynamic';

/**
 * Schema de validación para POST (crear downtime)
 */
const createDowntimeSchema = z.object({
  failureOccurrenceId: z.number().int().positive('failureOccurrenceId es obligatorio'),
  workOrderId: z.number().int().positive().optional(),
  machineId: z.number().int().positive('machineId es obligatorio'),

  category: z.enum(['UNPLANNED', 'PLANNED', 'EXTERNAL']).optional().default('UNPLANNED'),
  reason: z.string().max(500).optional(),
  productionImpact: z.string().max(500).optional(),

  // Campos opcionales si se quiere crear con fechas específicas (no recomendado)
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
});

/**
 * GET /api/downtime
 * Lista de registros de downtime con filtros
 */
export async function GET(request: NextRequest) {
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

    // 2. Parsear query params
    const searchParams = request.nextUrl.searchParams;

    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    const machineId = searchParams.get('machineId')
      ? parseInt(searchParams.get('machineId')!)
      : undefined;

    const workOrderId = searchParams.get('workOrderId')
      ? parseInt(searchParams.get('workOrderId')!)
      : undefined;

    const failureOccurrenceId = searchParams.get('failureOccurrenceId')
      ? parseInt(searchParams.get('failureOccurrenceId')!)
      : undefined;

    const category = searchParams.get('category') as 'UNPLANNED' | 'PLANNED' | 'EXTERNAL' | undefined;

    const isOpen = searchParams.get('isOpen'); // 'true' = solo abiertos, 'false' = solo cerrados

    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;

    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;

    // 3. Construir where clause
    const where: any = {
      companyId,
    };

    if (machineId) {
      where.machineId = machineId;
    }

    if (workOrderId) {
      where.workOrderId = workOrderId;
    }

    if (failureOccurrenceId) {
      where.failureOccurrenceId = failureOccurrenceId;
    }

    if (category) {
      where.category = category;
    }

    if (isOpen === 'true') {
      where.endedAt = null; // Solo downtimes abiertos
    } else if (isOpen === 'false') {
      where.endedAt = { not: null }; // Solo downtimes cerrados
    }

    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) {
        where.startedAt.gte = startDate;
      }
      if (endDate) {
        where.startedAt.lte = endDate;
      }
    }

    // 4. Obtener total count
    const totalCount = await prisma.downtimeLog.count({ where });

    // 5. Obtener registros con relaciones
    const downtimeLogs = await prisma.downtimeLog.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { startedAt: 'desc' },
      include: {
        machine: {
          select: { id: true, name: true, assetCode: true }
        },
        failureOccurrence: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true
          }
        },
        workOrder: {
          select: {
            id: true,
            status: true,
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

    // 6. Calcular estadísticas
    const stats = {
      totalOpen: await prisma.downtimeLog.count({
        where: { ...where, endedAt: null }
      }),
      totalClosed: await prisma.downtimeLog.count({
        where: { ...where, endedAt: { not: null } }
      }),
      totalMinutes: await prisma.downtimeLog.aggregate({
        where: { ...where, totalMinutes: { not: null } },
        _sum: { totalMinutes: true }
      }).then(res => res._sum.totalMinutes || 0)
    };

    return NextResponse.json({
      data: downtimeLogs,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      stats
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Error en GET /api/downtime:', error);
    return NextResponse.json(
      { error: 'Error al obtener registros de downtime' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/downtime
 * Crear nuevo registro de downtime (normalmente auto-creado)
 */
export async function POST(request: NextRequest) {
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

    // 2. Parsear y validar body
    const body = await request.json();
    const validationResult = createDowntimeSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e =>
        `${e.path.join('.')}: ${e.message}`
      ).join(', ');

      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // 3. Usar helper handleDowntime (con transacción interna)
    const downtimeLog = await handleDowntime({
      failureOccurrenceId: data.failureOccurrenceId,
      workOrderId: data.workOrderId,
      machineId: data.machineId,
      causedDowntime: true,
      companyId,
      category: data.category,
      reason: data.reason,
      productionImpact: data.productionImpact,
    });

    if (!downtimeLog) {
      return NextResponse.json(
        { error: 'No se pudo crear el downtime log' },
        { status: 500 }
      );
    }

    // 4. Si se proporcionaron fechas específicas, actualizar
    if (data.startedAt || data.endedAt) {
      const updated = await prisma.downtimeLog.update({
        where: { id: downtimeLog.id },
        data: {
          ...(data.startedAt && { startedAt: new Date(data.startedAt) }),
          ...(data.endedAt && {
            endedAt: new Date(data.endedAt),
            totalMinutes: Math.floor(
              (new Date(data.endedAt).getTime() - new Date(data.startedAt || downtimeLog.startedAt).getTime()) / 60000
            )
          })
        },
        include: {
          machine: { select: { id: true, name: true } },
          failureOccurrence: { select: { id: true, title: true } },
          workOrder: { select: { id: true, status: true } }
        }
      });

      return NextResponse.json(updated, { status: 201 });
    }

    return NextResponse.json(downtimeLog, { status: 201 });

  } catch (error) {
    console.error('❌ Error en POST /api/downtime:', error);
    return NextResponse.json(
      { error: 'Error al crear downtime log' },
      { status: 500 }
    );
  }
}
