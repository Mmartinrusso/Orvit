import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// POST /api/cost-distribution/bulk - Guardar múltiples distribuciones de costos
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

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

    console.log('🔍 Guardando distribuciones masivas:', {
      companyId,
      totalDistributions: distributions.length
    });

    // Validar que todas las distribuciones tengan los campos requeridos
    for (const dist of distributions) {
      if (!dist.costId || !dist.categoryId || dist.percentage === undefined) {
        return NextResponse.json(
          { error: 'Cada distribución debe tener costId, categoryId y percentage' },
          { status: 400 }
        );
      }
    }

    // Usar transacción para asegurar consistencia
    const result = await prisma.$transaction(async (tx) => {
      // Eliminar distribuciones existentes para esta empresa
      await tx.$executeRaw`
        DELETE FROM cost_distribution_config 
        WHERE company_id = ${parseInt(companyId)}
      `;

      // Insertar nuevas distribuciones usando UPSERT para manejar conflictos
      let totalInserted = 0;
      for (const dist of distributions) {
        try {
          await tx.$executeRaw`
            INSERT INTO cost_distribution_config (
              cost_type,
              cost_name,
              product_category_id,
              percentage,
              company_id
            ) VALUES (
              ${dist.costName},  -- Usar costName como cost_type para hacer único cada costo indirecto
              ${dist.costName},
              ${parseInt(dist.categoryId)},
              ${parseFloat(dist.percentage)},
              ${parseInt(companyId)}
            )
            ON CONFLICT (company_id, cost_type, product_category_id) 
            DO UPDATE SET 
              percentage = EXCLUDED.percentage,
              cost_name = EXCLUDED.cost_name,
              updated_at = CURRENT_TIMESTAMP
          `;
          totalInserted++;
        } catch (error) {
          console.warn(`Error insertando distribución para ${dist.costName} - categoría ${dist.categoryId}:`, error);
          // Continuar con las siguientes distribuciones
        }
      }

      return {
        success: true,
        totalInserted
      };
    });

    console.log('✅ Distribuciones guardadas exitosamente:', result);

    return NextResponse.json({
      success: true,
      message: `${distributions.length} distribuciones guardadas exitosamente`,
      totalInserted: distributions.length
    });

  } catch (error) {
    console.error('Error en POST /api/cost-distribution/bulk:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET /api/cost-distribution/bulk - Obtener distribuciones existentes para la matriz
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

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
        cdc.id,
        cdc.cost_type as "costType",
        cdc.cost_name as "costName",
        cdc.product_category_id as "productCategoryId",
        cdc.percentage,
        pc.name as "productCategoryName"
      FROM cost_distribution_config cdc
      LEFT JOIN product_categories pc ON cdc.product_category_id = pc.id
      WHERE cdc.company_id = ${parseInt(companyId)}
      ORDER BY cdc.cost_name, pc.name
    `;

    return NextResponse.json(distributions);

  } catch (error) {
    console.error('Error en GET /api/cost-distribution/bulk:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
