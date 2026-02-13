import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const costBaseId = searchParams.get('costBaseId'); // Opcional: filtrar por costo base
    const month = searchParams.get('month'); // Opcional: filtrar por mes

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    let query = `
      SELECT 
        ich.id,
        ich.cost_base_id as "costBaseId",
        icb.name as "costName",
        icb.description as "costDescription",
        ich.monthly_record_id as "monthlyRecordId",
        ich.change_type as "changeType",
        ich.old_amount as "oldAmount",
        ich.new_amount as "newAmount",
        ich.old_status as "oldStatus",
        ich.new_status as "newStatus",
        ich.fecha_imputacion as month,
        ich.reason,
        ich.company_id as "companyId",
        ich.created_at as "createdAt",
        icc.name as "categoryName",
        icc.type as "categoryType"
      FROM indirect_cost_change_history ich
      INNER JOIN indirect_cost_base icb ON ich.cost_base_id = icb.id
      INNER JOIN indirect_cost_categories icc ON icb.category_id = icc.id
      WHERE ich.company_id = $1
    `;

    const params = [parseInt(companyId)];

    if (costBaseId) {
      query += ` AND ich.cost_base_id = $${params.length + 1}`;
      params.push(parseInt(costBaseId));
    }

    if (month) {
      query += ` AND ich.fecha_imputacion = $${params.length + 1}`;
      params.push(month);
    }

    query += ` ORDER BY ich.created_at DESC`;

    const history = await prisma.$queryRawUnsafe(query, ...params);

    return NextResponse.json(history);

  } catch (error) {
    console.error('Error obteniendo historial de cambios:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
