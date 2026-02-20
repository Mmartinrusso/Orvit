import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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

    const cid = parseInt(companyId);
    const supplies = await prisma.$queryRawUnsafe(`
      SELECT
        s.id,
        s.name,
        s.unit_measure as "unitMeasure",
        s.supplier_id as "supplierId",
        s.company_id as "companyId",
        s.is_active as "isActive",
        s.created_at as "createdAt",
        s.updated_at as "updatedAt",
        sup.name as "supplierName",
        sup.contact_person as "supplierContactPerson",
        sup.phone as "supplierPhone",
        sup.email as "supplierEmail",
        s."categoryId" as "categoryId",
        sc.name as "categoryName",
        COALESCE(stock_agg.stock_cantidad, 0) as "stockCantidad",
        COALESCE(stock_agg.supplier_item_count, 0) as "supplierItemCount",
        smp_last.month_year as "ultimaCompraMonth"
      FROM supplies s
      LEFT JOIN suppliers sup ON s.supplier_id = sup.id
      LEFT JOIN supply_categories sc ON sc.id = s."categoryId"
      LEFT JOIN (
        SELECT
          si."supplyId",
          CAST(SUM(COALESCE(st.cantidad, 0)) AS FLOAT) as stock_cantidad,
          CAST(COUNT(si.id) AS INTEGER) as supplier_item_count
        FROM "SupplierItem" si
        LEFT JOIN "Stock" st ON st."supplierItemId" = si.id
        WHERE si."companyId" = ${cid}
        GROUP BY si."supplyId"
      ) stock_agg ON stock_agg."supplyId" = s.id
      LEFT JOIN (
        SELECT DISTINCT ON (supply_id)
          supply_id,
          month_year
        FROM supply_monthly_prices
        WHERE company_id = ${cid}
        ORDER BY supply_id, month_year DESC
      ) smp_last ON smp_last.supply_id = s.id
      WHERE s.company_id = ${cid}
      ORDER BY
        CASE WHEN COALESCE(stock_agg.stock_cantidad, 0) > 0 THEN 0
             WHEN COALESCE(stock_agg.supplier_item_count, 0) > 0 THEN 1
             ELSE 2 END,
        s.name
    `);

    return NextResponse.json(supplies);

  } catch (error) {
    console.error('Error obteniendo insumos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, unitMeasure, supplierId, companyId } = body;

    if (!name || !unitMeasure || !companyId) {
      return NextResponse.json(
        { error: 'Nombre, unidad de medida y companyId son requeridos' },
        { status: 400 }
      );
    }

    const newSupply = await prisma.$queryRaw`
      INSERT INTO supplies (name, unit_measure, supplier_id, company_id)
      VALUES (${name}, ${unitMeasure}, ${supplierId ? parseInt(supplierId) : null}, ${parseInt(companyId)})
      RETURNING id, name, unit_measure as "unitMeasure", supplier_id as "supplierId", company_id as "companyId", is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
    `;

    return NextResponse.json((newSupply as any[])[0]);

  } catch (error) {
    console.error('Error creando insumo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
