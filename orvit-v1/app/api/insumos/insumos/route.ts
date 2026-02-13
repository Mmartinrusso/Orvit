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

    const supplies = await prisma.$queryRaw`
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
        sup.email as "supplierEmail"
      FROM supplies s
      LEFT JOIN suppliers sup ON s.supplier_id = sup.id
      WHERE s.company_id = ${parseInt(companyId)}
      ORDER BY s.name
    `;

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
