import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startPerf, endParse, startDb, endDb, startCompute, endCompute, startJson, endJson, withPerfHeaders, shouldDisableCache } from '@/lib/perf';

export const dynamic = 'force-dynamic';


// GET - Obtener categorías de empleados con paginación
export async function GET(request: NextRequest) {
  const perfCtx = startPerf();

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    endParse(perfCtx);

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    const companyIdNum = parseInt(companyId);

    startDb(perfCtx);
    const [categories, countResult] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT
          ec.id,
          ec.name,
          ec.description,
          ec.is_active as "isActive",
          ec.company_id as "companyId",
          ec.created_at as "createdAt",
          ec.updated_at as "updatedAt",
          (
            SELECT COUNT(*)
            FROM employees e
            WHERE e.category_id = ec.id
              AND e.company_id = ${companyIdNum}
              AND e.active = true
          ) as "employeeCount"
        FROM employee_categories ec
        WHERE ec.company_id = ${companyIdNum}
          AND ec.is_active = true
        ORDER BY ec.name ASC
        LIMIT ${limit} OFFSET ${skip}
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM employee_categories
        WHERE company_id = ${companyIdNum} AND is_active = true
      `,
    ]);
    endDb(perfCtx);

    startCompute(perfCtx);
    const processedCategories = categories.map((category: any) => ({
      ...category,
      id: Number(category.id),
      companyId: Number(category.companyId),
      employeeCount: Number(category.employeeCount)
    }));
    const total = Number(countResult[0].count);
    endCompute(perfCtx);

    startJson(perfCtx);
    const response = NextResponse.json({
      items: processedCategories,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    }, {
      headers: {
        'Cache-Control': shouldDisableCache(searchParams)
          ? 'no-cache, no-store, must-revalidate'
          : 'private, max-age=120, s-maxage=120',
      }
    });
    const metrics = endJson(perfCtx, processedCategories);
    return withPerfHeaders(response, metrics, searchParams);
  } catch (error) {
    console.error('Error detallado obteniendo categorías:', error);
    
    let errorMessage = 'Error interno del servidor';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

// POST - Crear nueva categoría usando SQL directo
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 POST /api/costos/categorias - Iniciando...');
    
    const body = await request.json();
    const { name, description, companyId } = body;

    console.log('📥 Datos recibidos:', { name, description, companyId });

    if (!name || !companyId) {
      return NextResponse.json(
        { error: 'Nombre y companyId son requeridos' },
        { status: 400 }
      );
    }

    console.log('🔧 Ejecutando SQL INSERT...');
    
    // Usar SQL directo para crear la categoría
    const result = await prisma.$queryRaw`
      INSERT INTO employee_categories (name, description, company_id, is_active, created_at, updated_at)
      VALUES (${name}, ${description || null}, ${parseInt(companyId)}, true, NOW(), NOW())
      RETURNING 
        id,
        name,
        description,
        is_active as "isActive",
        company_id as "companyId",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    const newCategory = Array.isArray(result) ? result[0] : result;
    console.log('✅ Categoría creada exitosamente en BD:', newCategory);
    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error('Error detallado creando categoría:', error);
    
    let errorMessage = 'Error interno del servidor';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}
