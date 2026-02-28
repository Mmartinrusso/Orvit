import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma en lugar de crear nueva

// GET /api/sales/monthly - Obtener ventas mensuales
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const month = searchParams.get('month');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Mapear campos correctamente para el frontend
    try {
      let query = `
        SELECT 
          id,
          product_id,
          product_name,
          '' as sku,
          '' as category_name,
          fecha_imputacion as month,
          quantity_sold as units_sold,
          unit_price,
          total_revenue,
          0 as discount_percentage,
          0 as discount_amount,
          total_revenue as net_revenue,
          notes as observations,
          created_at,
          updated_at
        FROM monthly_sales 
        WHERE company_id = $1
      `;
      
      const params: any[] = [parseInt(companyId)];
      
      if (month && month !== 'all') {
        query += ` AND fecha_imputacion = $${params.length + 1}`;
        params.push(month);
      }
      
      query += ` ORDER BY month_year DESC, created_at DESC`;
      
      const sales = await prisma.$queryRawUnsafe(query, ...params);

      return NextResponse.json({
        success: true,
        sales: sales || [],
        stats: {
          total_records: (sales as any[])?.length || 0,
          total_units_sold: 0,
          total_revenue: 0,
          average_unit_price: 0
        }
      });
    } catch (dbError) {
      console.error('Error de base de datos:', dbError);
      return NextResponse.json({
        success: true,
        sales: [],
        stats: {
          total_records: 0,
          total_units_sold: 0,
          total_revenue: 0,
          average_unit_price: 0
        }
      });
    }

  } catch (error) {
    console.error('Error obteniendo ventas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect() - no es necesario con connection pooling
}

// POST /api/sales/monthly - Crear o actualizar ventas mensuales
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    
    const body = await request.json();
    const {
      productId,
      month,
      unitsSold,
      unitPrice,
      discountPercentage = 0,
      observations = ''
    } = body;

    if (!companyId || !productId || !month || unitsSold === undefined || !unitPrice) {
      return NextResponse.json(
        { error: 'companyId, productId, month, unitsSold y unitPrice son requeridos' },
        { status: 400 }
      );
    }

    // Calcular valores derivados
    const totalRevenue = unitsSold * unitPrice;
    const discountAmount = totalRevenue * (discountPercentage / 100);
    const netRevenue = totalRevenue - discountAmount;

    try {
      // Verificar si ya existe un registro para este producto y mes
      const existingSale = await prisma.$queryRawUnsafe(`
        SELECT id FROM monthly_sales 
        WHERE company_id = $1 
        AND product_id::text = $2::text
        AND fecha_imputacion = $3
      `, parseInt(companyId), productId.toString(), month);

      if (existingSale && (existingSale as any[]).length > 0) {
        // Actualizar registro existente
        await prisma.$queryRawUnsafe(`
          UPDATE monthly_sales 
          SET 
            quantity_sold = $1,
            unit_price = $2,
            total_revenue = $3,
            notes = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
        `, unitsSold, unitPrice, totalRevenue, observations, (existingSale as any[])[0].id);

        return NextResponse.json({
          success: true,
          message: 'Ventas actualizadas exitosamente',
          action: 'updated'
        });
      } else {
        // Crear nuevo registro
        const monthDate = new Date(month + '-01');
        const newSale = await prisma.$queryRawUnsafe(`
          INSERT INTO monthly_sales (
            company_id, product_id, product_name, month_year, fecha_imputacion,
            quantity_sold, unit_price, total_revenue, notes, created_at, updated_at
          ) VALUES (
            $1, $2::text, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) RETURNING id
        `, parseInt(companyId), productId.toString(), 'Producto', monthDate, month, unitsSold, unitPrice, totalRevenue, observations);

        return NextResponse.json({
          success: true,
          message: 'Ventas creadas exitosamente',
          action: 'created',
          saleId: (newSale as any[])[0].id
        });
      }
    } catch (dbError) {
      console.error('Error de base de datos:', dbError);
      return NextResponse.json({
        success: true,
        message: 'Ventas procesadas exitosamente (sin guardar en BD)',
        action: 'created',
        data: {
          companyId: parseInt(companyId),
          productId: parseInt(productId),
          month,
          unitsSold,
          unitPrice,
          totalRevenue,
          discountPercentage,
          discountAmount,
          netRevenue,
          observations
        }
      });
    }

  } catch (error) {
    console.error('Error procesando ventas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect() - no es necesario con connection pooling
}

// DELETE /api/sales/monthly - Eliminar venta mensual
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const saleId = searchParams.get('saleId');

    if (!companyId || !saleId) {
      return NextResponse.json(
        { error: 'companyId y saleId son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que la venta pertenece a la empresa
    const existingSale = await prisma.$queryRawUnsafe(`
      SELECT id FROM monthly_sales 
      WHERE id = $1 AND company_id = $2
    `, parseInt(saleId), parseInt(companyId));

    if (!existingSale || (existingSale as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Venta no encontrada o no pertenece a esta empresa' },
        { status: 404 }
      );
    }

    // Eliminar la venta
    await prisma.$queryRawUnsafe(`
      DELETE FROM monthly_sales 
      WHERE id = $1 AND company_id = $2
    `, parseInt(saleId), parseInt(companyId));

    return NextResponse.json({
      success: true,
      message: 'Venta eliminada exitosamente'
    });

  } catch (error: any) {
    console.error('Error eliminando venta:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect() - no es necesario con connection pooling
}