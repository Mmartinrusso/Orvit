import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const month = searchParams.get('month'); // Opcional: filtrar por mes
    const categoryId = searchParams.get('categoryId'); // Opcional: filtrar por categoría

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    let query = `
      SELECT 
        ich.id,
        ich.cost_id as "costId",
        ic.name as "costName",
        icc.name as "categoryName",
        ich.old_amount as "oldAmount",
        ich.new_amount as "newAmount",
        ich.change_type as "changeType",
        ich.reason,
        ich.created_at as "createdAt",
        ic.fecha_imputacion as month,
        ic.status
      FROM indirect_cost_history ich
      INNER JOIN indirect_costs ic ON ich.cost_id = ic.id
      INNER JOIN indirect_cost_categories icc ON ic.category_id = icc.id
      WHERE ich.company_id = $1
    `;

    const params = [parseInt(companyId)];

    if (month) {
      query += ` AND ic.fecha_imputacion = $${params.length + 1}`;
      params.push(month);
    }

    if (categoryId) {
      query += ` AND ic.category_id = $${params.length + 1}`;
      params.push(parseInt(categoryId));
    }

    query += ` ORDER BY ich.created_at DESC`;

    const history = await prisma.$queryRawUnsafe(query, ...params);

    return NextResponse.json(history);

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
