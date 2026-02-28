import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

// GET /api/production/monthly - Obtener producción mensual
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.REPORTES.VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const companyId = String(user!.companyId);
    const month = searchParams.get('month');
    const productId = searchParams.get('productId');

    let query = `
      SELECT 
        mp.id,
        mp.product_id,
        mp.product_name,
        '' as sku,
        '' as category_name,
        mp.fecha_imputacion as month,
        mp.quantity_produced as good_units,
        0 as scrap_units,
        mp.quantity_produced as total_units,
        mp.notes as observations,
        mp.created_at,
        mp.updated_at
      FROM monthly_production mp
      WHERE mp.company_id = $1
    `;
    
    const params = [parseInt(companyId)];
    
    if (month && month !== 'all') {
      query += ` AND mp.fecha_imputacion = $${params.length + 1}`;
      params.push(month);
    }
    
    if (productId && productId !== 'all') {
      query += ` AND mp.product_id = $${params.length + 1}`;
      params.push(productId);
    }
    
    query += ` ORDER BY mp.month_year DESC, mp.product_name`;

    // Obtener producción mensual con información del producto
    const production = await prisma.$queryRawUnsafe(query, ...params);

    return NextResponse.json(production);

  } catch (error) {
    console.error('Error obteniendo producción mensual:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/production/monthly - Crear/actualizar producción mensual
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.REPORTES.VIEW);
    if (error) return error;

    const body = await request.json();
    const {
      productId,
      month,
      goodUnits,
      scrapUnits,
      observations
    } = body;
    const companyId = user!.companyId;

    // Validar campos requeridos
    if (!productId || !month) {
      return NextResponse.json(
        { error: 'productId y month son requeridos' },
        { status: 400 }
      );
    }

    // Validar que goodUnits y scrapUnits sean números válidos (pueden ser 0)
    const goodUnitsNum = goodUnits !== undefined && goodUnits !== null ? parseFloat(goodUnits) : 0;
    const scrapUnitsNum = scrapUnits !== undefined && scrapUnits !== null ? parseFloat(scrapUnits) : 0;

    // Validar que al menos uno sea mayor a 0
    if (goodUnitsNum < 0 || scrapUnitsNum < 0) {
      return NextResponse.json(
        { error: 'Las unidades buenas y scrap no pueden ser negativas' },
        { status: 400 }
      );
    }

    if (goodUnitsNum === 0 && scrapUnitsNum === 0) {
      return NextResponse.json(
        { error: 'Debes ingresar al menos unidades buenas o scrap' },
        { status: 400 }
      );
    }

    // Calcular cantidad total producida (buenas + scrap)
    const quantityProduced = goodUnitsNum + scrapUnitsNum;

    // Validar formato de mes (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Formato de mes inválido. Debe ser YYYY-MM (ej: 2025-08)' },
        { status: 400 }
      );
    }

    // Obtener información del producto
    let productName = '';
    try {
      const product = await prisma.$queryRawUnsafe(`
        SELECT name FROM products WHERE id = $1
      `, productId);
      
      if (product && (product as any[]).length > 0) {
        productName = (product as any[])[0].name;
      } else {
        return NextResponse.json(
          { error: 'Producto no encontrado' },
          { status: 404 }
        );
      }
    } catch (error) {
      console.error('Error obteniendo producto:', error);
      return NextResponse.json(
        { error: 'Error al obtener información del producto' },
        { status: 500 }
      );
    }

    // Crear fecha para month_year (primer día del mes)
    const monthYear = new Date(month + '-01');
    const fechaImputacion = month;

    // Por ahora, unit_cost y total_cost se establecen en 0 (se pueden calcular después)
    const unitCost = 0;
    const totalCost = 0;

    // Verificar si ya existe producción para este producto y mes
    const existingProduction = await prisma.$queryRawUnsafe(`
      SELECT id FROM monthly_production 
      WHERE company_id = $1
      AND product_id = $2
      AND fecha_imputacion = $3
    `, parseInt(companyId), productId, fechaImputacion);

    if (existingProduction && (existingProduction as any[]).length > 0) {
      // Actualizar producción existente
      const updatedProduction = await prisma.$queryRawUnsafe(`
        UPDATE monthly_production 
        SET 
          quantity_produced = $1,
          notes = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id
      `, quantityProduced, observations || '', (existingProduction as any[])[0].id);

      return NextResponse.json({
        success: true,
        message: 'Producción mensual actualizada exitosamente',
        id: (updatedProduction as any[])[0].id
      });
    } else {
      // Crear nueva producción
      const newProduction = await prisma.$queryRawUnsafe(`
        INSERT INTO monthly_production (
          company_id, product_id, product_name, month_year, fecha_imputacion,
          quantity_produced, unit_cost, total_cost, notes,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING id
      `, 
        parseInt(companyId), 
        productId, 
        productName,
        monthYear,
        fechaImputacion,
        quantityProduced, 
        unitCost, 
        totalCost, 
        observations || ''
      );

      return NextResponse.json({
        success: true,
        message: 'Producción mensual creada exitosamente',
        id: (newProduction as any[])[0].id
      }, { status: 201 });
    }

  } catch (error) {
    console.error('Error creando/actualizando producción mensual:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
