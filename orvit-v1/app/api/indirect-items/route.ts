import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET /api/indirect-items - Obtener costos indirectos con precios actuales
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

    // ✅ OPTIMIZADO: Removido console.log innecesario

    // Obtener costos indirectos con el precio más reciente de cada uno
    const indirectItems = await prisma.$queryRaw`
      SELECT DISTINCT
        icb.id,
        icb.name as "label",
        icb.description,
        icb.category_id as "categoryId",
        icc.name as "category",
        icc.type as "categoryType",
        icc.color as "categoryColor",
        COALESCE(latest_record.amount, 0) as "currentPrice",
        latest_record.fecha_imputacion as "lastUpdateDate",
        latest_record.status as "lastStatus"
      FROM indirect_cost_base icb
      LEFT JOIN indirect_cost_categories icc ON icb.category_id = icc.id
      LEFT JOIN LATERAL (
        SELECT 
          icmr.amount,
          icmr.fecha_imputacion,
          icmr.status
        FROM indirect_cost_monthly_records icmr
        WHERE icmr.cost_base_id = icb.id 
          AND icmr.company_id = ${parseInt(companyId)}
        ORDER BY icmr.fecha_imputacion DESC, icmr.created_at DESC
        LIMIT 1
      ) latest_record ON true
      WHERE icb.company_id = ${parseInt(companyId)}
      ORDER BY icb.name ASC
    `;

    // ✅ OPTIMIZADO: Removido console.log innecesario
    return NextResponse.json({
      success: true,
      indirectItems: indirectItems || []
    });

  } catch (error) {
    console.error('Error obteniendo costos indirectos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect() - no es necesario con conexión pooling
}