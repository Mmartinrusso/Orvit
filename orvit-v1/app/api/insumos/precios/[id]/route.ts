import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const priceId = parseInt(params.id);
    const body = await request.json();
    const { pricePerUnit, notes } = body;

    if (!pricePerUnit) {
      return NextResponse.json(
        { error: 'pricePerUnit es requerido' },
        { status: 400 }
      );
    }

    // Obtener el precio actual para el historial
    const currentPrice = await prisma.$queryRaw`
      SELECT 
        id, 
        supply_id, 
        month_year, 
        price_per_unit, 
        notes,
        company_id
      FROM supply_monthly_prices 
      WHERE id = ${priceId}
    `;

    if ((currentPrice as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Precio no encontrado' },
        { status: 404 }
      );
    }

    const oldPrice = (currentPrice as any[])[0].price_per_unit;
    const supplyId = (currentPrice as any[])[0].supply_id;
    const monthYear = (currentPrice as any[])[0].month_year;
    const companyId = (currentPrice as any[])[0].company_id;

    // Actualizar el precio
    const updatedPrice = await prisma.$queryRaw`
      UPDATE supply_monthly_prices 
      SET price_per_unit = ${parseFloat(pricePerUnit)}, notes = ${notes || null}, updated_at = NOW()
      WHERE id = ${priceId}
      RETURNING id, supply_id as "supplyId", month_year as "monthYear", price_per_unit as "pricePerUnit", notes
    `;

    // Registrar en historial
    await prisma.$queryRaw`
      INSERT INTO supply_price_history (
        supply_id, 
        change_type, 
        old_price, 
        new_price, 
        month_year, 
        notes, 
        company_id
      ) VALUES (
        ${supplyId}, 
        'precio_editado', 
        ${oldPrice}, 
        ${parseFloat(pricePerUnit)}, 
        ${monthYear}, 
        ${notes || 'Precio editado manualmente'}, 
        ${companyId}
      )
    `;

    return NextResponse.json((updatedPrice as any[])[0]);

  } catch (error) {
    console.error('Error editando precio:', error);
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
    const priceId = parseInt(params.id);

    // Eliminar el precio
    const deletedPrice = await prisma.$queryRaw`
      DELETE FROM supply_monthly_prices WHERE id = ${priceId}
      RETURNING id, supply_id as "supplyId", month_year as "monthYear", price_per_unit as "pricePerUnit"
    `;

    if ((deletedPrice as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Precio no encontrado' },
        { status: 404 }
      );
    }

    // Registrar en el historial
    await prisma.$queryRaw`
      INSERT INTO supply_price_history (
        supply_id, 
        change_type, 
        old_price, 
        new_price, 
        month_year, 
        notes, 
        company_id, 
        created_at
      ) VALUES (
        ${(deletedPrice as any[])[0].supplyId},
        'precio_eliminado',
        ${(deletedPrice as any[])[0].pricePerUnit},
        NULL,
        ${(deletedPrice as any[])[0].monthYear},
        'Precio eliminado manualmente',
        (SELECT company_id FROM supplies WHERE id = ${(deletedPrice as any[])[0].supplyId}),
        NOW()
      )
    `;

    return NextResponse.json({ 
      message: 'Precio eliminado exitosamente',
      deletedPrice: (deletedPrice as any[])[0]
    });

  } catch (error) {
    console.error('Error eliminando precio:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
