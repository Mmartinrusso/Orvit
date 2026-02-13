/**
 * API: /api/templates
 *
 * GET - Lista y búsqueda de plantillas
 * POST - Crear nueva plantilla
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema para crear plantilla
 */
const createTemplateSchema = z.object({
  type: z.enum(['QUICK_CLOSE', 'WORK_ORDER', 'SOLUTION']),
  title: z.string().min(3).max(255),
  description: z.string().max(500).optional(),
  content: z.record(z.any()), // JSON flexible
  componentId: z.number().int().positive().optional(),
  machineId: z.number().int().positive().optional(),
  areaId: z.number().int().positive().optional(),
});

/**
 * GET /api/templates
 * Lista y búsqueda de plantillas
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
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') as 'QUICK_CLOSE' | 'WORK_ORDER' | 'SOLUTION' | null;
    const componentId = searchParams.get('componentId') ? parseInt(searchParams.get('componentId')!) : undefined;
    const machineId = searchParams.get('machineId') ? parseInt(searchParams.get('machineId')!) : undefined;
    const topUsed = searchParams.get('topUsed') === 'true';
    const take = parseInt(searchParams.get('take') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');

    // 3. Construir where
    const where: any = {
      companyId,
      isActive: true,
      ...(type && { type }),
      ...(componentId && { componentId }),
      ...(machineId && { machineId }),
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // 4. Obtener plantillas
    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, name: true }
          }
        },
        orderBy: topUsed
          ? { usageCount: 'desc' }
          : { title: 'asc' },
        take,
        skip
      }),
      prisma.template.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: templates.map(t => ({
        ...t,
        content: t.content || {}
      })),
      total,
      pagination: {
        take,
        skip,
        hasMore: skip + take < total
      }
    });

  } catch (error) {
    console.error('❌ Error en GET /api/templates:', error);
    return NextResponse.json(
      { error: 'Error al obtener plantillas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates
 * Crear nueva plantilla
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
    const userId = payload.userId as number;

    // 2. Parsear y validar body
    const body = await request.json();
    const validationResult = createTemplateSchema.safeParse(body);

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

    // 3. Crear plantilla
    const template = await prisma.template.create({
      data: {
        companyId,
        createdById: userId,
        type: data.type,
        title: data.title,
        description: data.description,
        content: data.content,
        componentId: data.componentId,
        machineId: data.machineId,
        areaId: data.areaId
      },
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: template,
      message: 'Plantilla creada exitosamente'
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Error en POST /api/templates:', error);
    return NextResponse.json(
      { error: 'Error al crear plantilla' },
      { status: 500 }
    );
  }
}
