import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplyId = parseInt(params.id);
    const body = await request.json();
    const { name, unitMeasure, supplierId, isActive } = body;

    if (!name || !unitMeasure) {
      return NextResponse.json(
        { error: 'Nombre y unidad de medida son requeridos' },
        { status: 400 }
      );
    }

    const updatedSupply = await prisma.$queryRaw`
      UPDATE supplies 
      SET 
        name = ${name}, 
        unit_measure = ${unitMeasure}, 
        supplier_id = ${supplierId ? parseInt(supplierId) : null},
        is_active = ${isActive !== undefined ? isActive : true},
        updated_at = NOW()
      WHERE id = ${supplyId}
      RETURNING 
        id, 
        name, 
        unit_measure as "unitMeasure", 
        supplier_id as "supplierId", 
        company_id as "companyId", 
        is_active as "isActive", 
        created_at as "createdAt", 
        updated_at as "updatedAt"
    `;

    if ((updatedSupply as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Insumo no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json((updatedSupply as any[])[0]);

  } catch (error) {
    console.error('Error actualizando insumo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplyId = parseInt(params.id);

    // Eliminar precios asociados primero
    await prisma.$queryRaw`
      DELETE FROM supply_monthly_prices WHERE supply_id = ${supplyId}
    `;

    // Eliminar historial asociado
    await prisma.$queryRaw`
      DELETE FROM supply_price_history WHERE supply_id = ${supplyId}
    `;

    // Eliminar el insumo
    const deletedSupply = await prisma.$queryRaw`
      DELETE FROM supplies WHERE id = ${supplyId}
      RETURNING id, name
    `;

    if ((deletedSupply as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Insumo no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      message: 'Insumo eliminado exitosamente',
      deletedSupply: (deletedSupply as any[])[0]
    });

  } catch (error) {
    console.error('Error eliminando insumo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
