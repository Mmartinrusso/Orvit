import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
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
        smp.id,
        smp.supply_id as "supplyId",
        smp.month_year as "monthYear",
        smp.fecha_imputacion,
        smp.price_per_unit as "pricePerUnit",
        COALESCE(smp.freight_cost, 0) as "freightCost",
        (smp.price_per_unit + COALESCE(smp.freight_cost, 0)) as "totalPrice",
        COALESCE(smp.notes, '') as "notes",
        smp.company_id as "companyId",
        COALESCE(smp.created_at, NOW()) as "createdAt",
        COALESCE(smp.updated_at, NOW()) as "updatedAt",
        s.name as "supplyName",
        s.unit_measure as "unitMeasure",
        COALESCE(sp.name, 'Sin proveedor') as "supplierName"
      FROM supply_monthly_prices smp
      INNER JOIN supplies s ON smp.supply_id = s.id
      LEFT JOIN suppliers sp ON s.supplier_id = sp.id
      WHERE smp.company_id = ${parseInt(companyId)}
    `;

    if (supplyId) {
      query += ` AND smp.supply_id = ${parseInt(supplyId)}`;
    }

    query += ` ORDER BY smp.month_year DESC, s.name`;

    const prices = await prisma.$queryRawUnsafe(query);
    
    console.log('🔍 PRECIOS DEVUELTOS:', prices);

    return NextResponse.json(prices);

  } catch (error) {
    console.error('Error obteniendo precios:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplyId, fecha_imputacion, pricePerUnit, freightCost, notes, companyId } = body;

    if (!supplyId || !fecha_imputacion || !pricePerUnit || !companyId) {
      return NextResponse.json(
        { error: 'supplyId, fecha_imputacion, pricePerUnit y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Parsear fecha del frontend (formato YYYY-MM)
    const [year, month] = fecha_imputacion.split('-');
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    
    if (monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        { error: 'Mes inválido. Debe estar entre 1 y 12' },
        { status: 400 }
      );
    }
    
    // Crear fecha en formato YYYY-MM-01
    const formattedDate = `${yearNum}-${monthNum.toString().padStart(2, '0')}-01`;
    
    // Verificar si ya existe un precio para este mes e insumo
    const existingPrice = await prisma.$queryRaw`
      SELECT id, price_per_unit, freight_cost FROM supply_monthly_prices 
      WHERE supply_id = ${parseInt(supplyId)} AND month_year = ${formattedDate}::date
    `;

    let result;
    if (existingPrice && (existingPrice as any[]).length > 0) {
      // ACTUALIZAR precio existente
      const oldPrice = (existingPrice as any[])[0].price_per_unit;
      const oldFreightCost = (existingPrice as any[])[0].freight_cost || 0;
      
      result = await prisma.$queryRaw`
        UPDATE supply_monthly_prices 
        SET price_per_unit = ${parseFloat(pricePerUnit)}, 
            freight_cost = ${parseFloat(freightCost || 0)}, 
            notes = ${notes || null}, 
            fecha_imputacion = ${fecha_imputacion}, 
            updated_at = NOW()
        WHERE supply_id = ${parseInt(supplyId)} AND month_year = ${formattedDate}::date
        RETURNING id, supply_id as "supplyId", month_year as "monthYear", fecha_imputacion, price_per_unit as "pricePerUnit", freight_cost as "freightCost", (price_per_unit + freight_cost) as "totalPrice", notes
      `;

      // Registrar en historial (actualización)
      await prisma.$queryRaw`
        INSERT INTO supply_price_history (supply_id, change_type, old_price, new_price, old_freight_cost, new_freight_cost, month_year, notes, company_id)
        VALUES (${parseInt(supplyId)}, 'precio_actualizado', ${oldPrice}, ${parseFloat(pricePerUnit)}, ${oldFreightCost}, ${parseFloat(freightCost || 0)}, ${formattedDate}::date, ${notes || 'Precio actualizado'}, ${parseInt(companyId)})
      `;
    } else {
      // CREAR nuevo precio
      result = await prisma.$queryRaw`
        INSERT INTO supply_monthly_prices (supply_id, month_year, fecha_imputacion, price_per_unit, freight_cost, notes, company_id)
        VALUES (${parseInt(supplyId)}, ${formattedDate}::date, ${fecha_imputacion}, ${parseFloat(pricePerUnit)}, ${parseFloat(freightCost || 0)}, ${notes || null}, ${parseInt(companyId)})
        RETURNING id, supply_id as "supplyId", month_year as "monthYear", fecha_imputacion, price_per_unit as "pricePerUnit", freight_cost as "freightCost", (price_per_unit + freight_cost) as "totalPrice", notes
      `;

      // Registrar en historial (nuevo precio)
      await prisma.$queryRaw`
        INSERT INTO supply_price_history (supply_id, change_type, new_price, new_freight_cost, month_year, notes, company_id)
        VALUES (${parseInt(supplyId)}, 'precio_registrado', ${parseFloat(pricePerUnit)}, ${parseFloat(freightCost || 0)}, ${formattedDate}::date, ${notes || 'Nuevo precio registrado'}, ${parseInt(companyId)})
      `;
    }

    return NextResponse.json((result as any[])[0]);

  } catch (error) {
    console.error('Error en POST /api/insumos/precios:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
