import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/employee-cost-distribution/bulk - Guardar múltiples distribuciones de costos por empleados
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { distributions, companyId } = body;

    if (!distributions || !Array.isArray(distributions)) {
      return NextResponse.json(
        { error: 'distributions debe ser un array' },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    console.log('🔍 Guardando distribuciones de costos por empleados:', {
      companyId,
      totalDistributions: distributions.length
    });

    // Validar que todas las distribuciones tengan los campos requeridos
    for (const dist of distributions) {
      if (!dist.employeeCategoryId || !dist.productCategoryId || dist.percentage === undefined) {
        return NextResponse.json(
          { error: 'Cada distribución debe tener employeeCategoryId, productCategoryId y percentage' },
          { status: 400 }
        );
      }
    }

    // Usar transacción para asegurar consistencia
    const result = await prisma.$transaction(async (tx) => {
      // Eliminar distribuciones existentes para esta empresa
      await tx.$executeRaw`
        DELETE FROM employee_cost_distribution 
        WHERE company_id = ${parseInt(companyId)}
      `;

      // Insertar nuevas distribuciones usando UPSERT para manejar conflictos
      let totalInserted = 0;
      for (const dist of distributions) {
        try {
          await tx.$executeRaw`
            INSERT INTO employee_cost_distribution (
              cost_type,
              cost_name,
              employee_category_id,
              product_category_id,
              percentage,
              company_id
            ) VALUES (
              ${dist.employeeCategoryName},  -- Usar employeeCategoryName como cost_type para hacer único cada categoría de empleado
              ${dist.employeeCategoryName},
              ${parseInt(dist.employeeCategoryId)},
              ${parseInt(dist.productCategoryId)},
              ${parseFloat(dist.percentage)},
              ${parseInt(companyId)}
            )
            ON CONFLICT (company_id, cost_type, employee_category_id, product_category_id) 
            DO UPDATE SET 
              percentage = EXCLUDED.percentage,
              cost_name = EXCLUDED.cost_name,
              updated_at = CURRENT_TIMESTAMP
          `;
          totalInserted++;
        } catch (error) {
          console.warn(`Error insertando distribución para ${dist.employeeCategoryName} - categoría producto ${dist.productCategoryId}:`, error);
          // Continuar con las siguientes distribuciones
        }
      }

      return {
        success: true,
        totalInserted
      };
    });

    console.log('✅ Distribuciones de costos por empleados guardadas exitosamente:', result);

    return NextResponse.json({
      success: true,
      message: `${distributions.length} distribuciones de costos por empleados guardadas exitosamente`,
      totalInserted: result.totalInserted
    });

  } catch (error) {
    console.error('Error en POST /api/employee-cost-distribution/bulk:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET /api/employee-cost-distribution/bulk - Obtener distribuciones existentes para la matriz
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const distributions = await prisma.$queryRaw`
      SELECT 
        ecd.id,
        ecd.cost_type as "costType",
        ecd.cost_name as "costName",
        ecd.employee_category_id as "employeeCategoryId",
        ecd.product_category_id as "productCategoryId",
        ecd.percentage,
        ec.name as "employeeCategoryName",
        pc.name as "productCategoryName"
      FROM employee_cost_distribution ecd
      LEFT JOIN employee_categories ec ON ecd.employee_category_id = ec.id
      LEFT JOIN product_categories pc ON ecd.product_category_id = pc.id
      WHERE ecd.company_id = ${parseInt(companyId)}
      ORDER BY ecd.cost_name, ec.name, pc.name
    `;

    return NextResponse.json(distributions);

  } catch (error) {
    console.error('Error en GET /api/employee-cost-distribution/bulk:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
