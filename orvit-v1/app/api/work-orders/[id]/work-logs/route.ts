/**
 * API: /api/work-orders/[id]/work-logs
 *
 * GET - Lista paginada de work logs
 * POST - Crear nuevo work log
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema de validación para crear work log
 */
const createWorkLogSchema = z.object({
  activityType: z.enum([
    'EXECUTION',      // Ejecución de trabajo
    'DIAGNOSIS',      // Diagnóstico
    'WAITING',        // Esperando
    'TRAVEL',         // Desplazamiento
    'DOCUMENTATION',  // Documentación
    'INSPECTION',     // Inspección
    'PARTS_PICKUP',   // Retiro de repuestos
    'OTHER'           // Otro
  ]),
  description: z.string().min(5, 'La descripción debe tener al menos 5 caracteres').max(1000),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  actualMinutes: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

/**
 * Schema de validación para actualizar work log
 */
const updateWorkLogSchema = z.object({
  description: z.string().min(5).max(1000).optional(),
  endedAt: z.string().datetime().optional(),
  actualMinutes: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
}).strict();

/**
 * GET /api/work-orders/[id]/work-logs
 * Lista paginada de work logs
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
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Verificar que la orden existe y pertenece a la empresa
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, companyId: true }
    });

    if (!workOrder || workOrder.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    // 3. Parsear query params
    const searchParams = request.nextUrl.searchParams;
    const take = parseInt(searchParams.get('take') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');

    // 4. Obtener work logs
    const [workLogs, total] = await Promise.all([
      prisma.workLog.findMany({
        where: { workOrderId },
        include: {
          performedBy: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { startedAt: 'desc' },
        take,
        skip
      }),
      prisma.workLog.count({ where: { workOrderId } })
    ]);

    // 5. Calcular tiempo total trabajado
    const totalMinutes = workLogs.reduce((sum, log) => sum + (log.actualMinutes || 0), 0);

    return NextResponse.json({
      success: true,
      data: workLogs,
      total,
      totalMinutes,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      pagination: {
        take,
        skip,
        hasMore: skip + take < total
      }
    });

  } catch (error: any) {
    console.error('❌ Error en GET /api/work-orders/[id]/work-logs:', error);
    console.error('❌ Stack:', error?.stack);
    console.error('❌ Code:', error?.code);

    // Si es error de tabla/columna no existente
    if (error?.code === 'P2021' || error?.code === 'P2010' || error?.code === 'P2022' ||
        error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
      console.warn('⚠️ Tabla work_logs no existe. Ejecutar: npx prisma db push');
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        totalMinutes: 0,
        totalHours: 0,
        pagination: { take: 50, skip: 0, hasMore: false },
        _warning: 'Tabla work_logs no migrada - ejecutar: npx prisma db push'
      });
    }

    return NextResponse.json(
      { error: 'Error al obtener work logs', detail: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/work-orders/[id]/work-logs
 * Crear nuevo work log
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
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Parsear y validar body
    const body = await request.json();
    const validationResult = createWorkLogSchema.safeParse(body);

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

    // 3. Verificar que la orden existe y pertenece a la empresa
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, companyId: true, status: true }
    });

    if (!workOrder || workOrder.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    // 4. Calcular actualMinutes si hay startedAt y endedAt
    let actualMinutes = data.actualMinutes;
    if (!actualMinutes && data.startedAt && data.endedAt) {
      const start = new Date(data.startedAt);
      const end = new Date(data.endedAt);
      actualMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    }

    // 5. Crear work log
    const workLog = await prisma.workLog.create({
      data: {
        workOrderId,
        performedById: userId,
        performedByType: 'USER',
        activityType: data.activityType,
        description: data.description,
        startedAt: data.startedAt ? new Date(data.startedAt) : new Date(),
        endedAt: data.endedAt ? new Date(data.endedAt) : null,
        actualMinutes
      },
      include: {
        performedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: workLog,
      message: 'Work log creado exitosamente'
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Error en POST /api/work-orders/[id]/work-logs:', error);
    return NextResponse.json(
      { error: 'Error al crear work log' },
      { status: 500 }
    );
  }
}
