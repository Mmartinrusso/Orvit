/**
 * API: /api/symptom-library
 *
 * GET - Lista y búsqueda de síntomas
 * POST - Crear nuevo síntoma
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema para crear síntoma
 */
const createSymptomSchema = z.object({
  title: z.string().min(3).max(100),
  keywords: z.array(z.string()).optional().default([]),
  shortNote: z.string().max(255).optional(),
  componentId: z.number().int().positive().optional(),
  subcomponentId: z.number().int().positive().optional(),
  machineId: z.number().int().positive().optional(),
});

/**
 * GET /api/symptom-library
 * Lista y búsqueda de síntomas
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
    const componentId = searchParams.get('componentId') ? parseInt(searchParams.get('componentId')!) : undefined;
    const subcomponentId = searchParams.get('subcomponentId') ? parseInt(searchParams.get('subcomponentId')!) : undefined;
    const machineId = searchParams.get('machineId') ? parseInt(searchParams.get('machineId')!) : undefined;
    const topUsed = searchParams.get('topUsed') === 'true';
    const take = parseInt(searchParams.get('take') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');

    // 3. Construir where
    const where: any = {
      companyId,
      isActive: true,
      ...(componentId && { componentId }),
      ...(subcomponentId && { subcomponentId }),
      ...(machineId && { machineId }),
    };

    // Búsqueda por título o keywords
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { keywords: { array_contains: search.toLowerCase() } }
      ];
    }

    // 4. Obtener síntomas
    const [symptoms, total] = await Promise.all([
      prisma.symptomLibrary.findMany({
        where,
        orderBy: topUsed
          ? { usageCount: 'desc' }
          : { title: 'asc' },
        take,
        skip
      }),
      prisma.symptomLibrary.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: symptoms.map(s => ({
        ...s,
        keywords: s.keywords || []
      })),
      total,
      pagination: {
        take,
        skip,
        hasMore: skip + take < total
      }
    });

  } catch (error) {
    console.error('❌ Error en GET /api/symptom-library:', error);
    return NextResponse.json(
      { error: 'Error al obtener síntomas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/symptom-library
 * Crear nuevo síntoma
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
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;

    // 2. Parsear y validar body
    const body = await request.json();
    const validationResult = createSymptomSchema.safeParse(body);

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

    // 3. Verificar que no exista duplicado
    const existing = await prisma.symptomLibrary.findFirst({
      where: {
        companyId,
        title: { equals: data.title, mode: 'insensitive' }
      }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un síntoma con ese título' },
        { status: 400 }
      );
    }

    // 4. Crear síntoma
    const symptom = await prisma.symptomLibrary.create({
      data: {
        companyId,
        title: data.title,
        keywords: data.keywords,
        shortNote: data.shortNote,
        componentId: data.componentId,
        subcomponentId: data.subcomponentId,
        machineId: data.machineId
      }
    });

    return NextResponse.json({
      success: true,
      data: symptom,
      message: 'Síntoma creado exitosamente'
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Error en POST /api/symptom-library:', error);
    return NextResponse.json(
      { error: 'Error al crear síntoma' },
      { status: 500 }
    );
  }
}
