import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const supplyId = searchParams.get('supplyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    let query = `
      SELECT 
        sph.id,
        sph.supply_id as "supplyId",
        sph.change_type as "changeType",
        sph.old_price as "oldPrice",
        sph.new_price as "newPrice",
        sph.old_freight_cost as "oldFreightCost",
        sph.new_freight_cost as "newFreightCost",
        sph.month_year as "monthYear",
        sph.notes,
        sph.company_id as "companyId",
        sph.created_at as "createdAt",
        s.name as "supplyName",
        s.unit_measure as "unitMeasure",
        COALESCE(sp.name, 'Sin proveedor') as "supplierName"
      FROM supply_price_history sph
      INNER JOIN supplies s ON sph.supply_id = s.id
      LEFT JOIN suppliers sp ON s.supplier_id = sp.id
      WHERE sph.company_id = ${parseInt(companyId)}
    `;

    if (supplyId) {
      query += ` AND sph.supply_id = ${parseInt(supplyId)}`;
    }

    query += ` ORDER BY sph.created_at DESC`;

    const history = await prisma.$queryRawUnsafe(query);

    return NextResponse.json(history);

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
