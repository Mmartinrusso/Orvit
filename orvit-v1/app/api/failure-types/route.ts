import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET: Listar tipos de falla del catálogo
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get('machineId');
    const search = searchParams.get('search');
    const isActive = searchParams.get('isActive');

    const companyId = user!.companyId;

    // Construir filtros de forma más simple para evitar errores
    const where: any = {};

    // Filtrar por máquina si se especifica, sino por empresa
    if (machineId) {
      where.machine_id = parseInt(machineId);
    } else {
      // Si no hay máquina específica, buscar por empresa
      where.OR = [
        { companyId },
        { Machine: { companyId } }
      ];
    }

    // Filtrar por estado activo
    if (isActive === 'true') {
      where.isActive = true;
    } else if (isActive === 'false') {
      where.isActive = false;
    }

    // Búsqueda por texto
    if (search && search.trim()) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ]
        }
      ];
    }

    console.log('🔍 Query where:', JSON.stringify(where, null, 2));

    // Intentar hacer la query de forma segura
    let failureTypes: any[] = [];
    try {
      failureTypes = await prisma.failure.findMany({
        where,
        include: {
          Machine: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              occurrences: true
            }
          }
        },
        orderBy: [
          { title: 'asc' }
        ],
        take: 100 // Limitar resultados
      });
    } catch (queryError) {
      console.error('⚠️ Error en query con _count, intentando sin:', queryError);
      // Fallback sin _count si hay error
      failureTypes = await prisma.failure.findMany({
        where,
        include: {
          Machine: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [
          { title: 'asc' }
        ],
        take: 100
      });
    }

    // Transformar respuesta
    const result = failureTypes.map((ft: any) => ({
      id: ft.id,
      title: ft.title,
      description: ft.description,
      machineId: ft.machine_id,
      machineName: ft.Machine?.name || null,
      failureType: ft.failure_type,
      priority: ft.priority,
      estimatedHours: ft.estimated_hours ? Number(ft.estimated_hours) : null,
      affectedComponents: ft.affected_components,
      isActive: ft.isActive ?? true,
      occurrencesCount: ft._count?.occurrences ?? 0,
      createdAt: ft.created_at,
      updatedAt: ft.updated_at
    }));

    console.log(`✅ Encontrados ${result.length} tipos de falla`);

    return NextResponse.json({
      success: true,
      failureTypes: result
    });

  } catch (error) {
    console.error('❌ Error en GET /api/failure-types:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// POST: Crear nuevo tipo de falla en el catálogo
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();

    console.log('📋 POST /api/failure-types', body);

    const {
      title,
      description,
      machineId,
      companyId,
      failureType = 'MECANICA',
      priority = 'MEDIUM',
      estimatedHours,
      affectedComponents
    } = body;

    // Validaciones
    if (!title) {
      return NextResponse.json(
        { error: 'El título es requerido' },
        { status: 400 }
      );
    }

    if (!machineId) {
      return NextResponse.json(
        { error: 'La máquina es requerida' },
        { status: 400 }
      );
    }

    // Verificar si ya existe un tipo de falla con el mismo título para la máquina
    const existing = await prisma.failure.findFirst({
      where: {
        title: { equals: title, mode: 'insensitive' },
        machine_id: parseInt(String(machineId))
      }
    });

    if (existing) {
      // Retornar el existente en lugar de error
      console.log(`⚠️ Tipo de falla ya existe: ${existing.id} - ${existing.title}`);
      return NextResponse.json({
        success: true,
        failureType: {
          id: existing.id,
          title: existing.title,
          description: existing.description,
          machineId: existing.machine_id,
          failureType: existing.failure_type,
          priority: existing.priority,
          estimatedHours: existing.estimated_hours ? Number(existing.estimated_hours) : null,
          affectedComponents: existing.affected_components,
          isActive: (existing as any).isActive ?? true,
          createdAt: existing.created_at
        },
        existing: true
      });
    }

    // Crear el tipo de falla
    const failureTypeRecord = await prisma.failure.create({
      data: {
        title,
        description: description || null,
        machine_id: parseInt(String(machineId)),
        companyId: companyId ? parseInt(String(companyId)) : null,
        failure_type: failureType,
        priority,
        estimated_hours: estimatedHours ? parseFloat(String(estimatedHours)) : null,
        affected_components: affectedComponents || null,
        isActive: true,
        status: 'ACTIVE'
      },
      include: {
        Machine: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`✅ Tipo de falla creado: ${failureTypeRecord.id} - ${failureTypeRecord.title}`);

    return NextResponse.json({
      success: true,
      failureType: {
        id: failureTypeRecord.id,
        title: failureTypeRecord.title,
        description: failureTypeRecord.description,
        machineId: failureTypeRecord.machine_id,
        machineName: (failureTypeRecord as any).Machine?.name || null,
        failureType: failureTypeRecord.failure_type,
        priority: failureTypeRecord.priority,
        estimatedHours: failureTypeRecord.estimated_hours ? Number(failureTypeRecord.estimated_hours) : null,
        affectedComponents: failureTypeRecord.affected_components,
        isActive: (failureTypeRecord as any).isActive ?? true,
        createdAt: failureTypeRecord.created_at
      }
    });

  } catch (error) {
    console.error('❌ Error en POST /api/failure-types:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
