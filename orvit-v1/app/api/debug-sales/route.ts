import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';
    const productionMonth = searchParams.get('month') || '2025-08';

    console.log('🔍 === DEBUG VENTAS ===');
    console.log('CompanyId:', companyId);
    console.log('Mes:', productionMonth);

    // 1. Verificar si existe la tabla monthly_sales
    let salesTableExists = false;
    try {
      await prisma.$queryRaw`SELECT 1 FROM monthly_sales LIMIT 1`;
      salesTableExists = true;
      console.log('✅ Tabla monthly_sales existe');
    } catch (error) {
      console.log('❌ Tabla monthly_sales no existe:', error);
    }

    // 2. Verificar datos de ventas disponibles
    let salesData: any[] = [];
    let availableMonths: any[] = [];
    
    if (salesTableExists) {
      try {
        // Obtener ventas del mes específico
        salesData = await prisma.$queryRaw`
          SELECT 
            product_id,
            SUM(quantity) as total_sales,
            COUNT(*) as records_count
          FROM monthly_sales
          WHERE company_id = ${parseInt(companyId)}
          AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', ${productionMonth}::date)
          GROUP BY product_id
          ORDER BY total_sales DESC
        ` as any[];

        console.log('📊 Ventas encontradas para', productionMonth, ':', salesData.length, 'productos');

        // Obtener todos los meses disponibles
        availableMonths = await prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('month', created_at) as month,
            COUNT(DISTINCT product_id) as products_count,
            SUM(quantity) as total_quantity
          FROM monthly_sales
          WHERE company_id = ${parseInt(companyId)}
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY month DESC
          LIMIT 12
        ` as any[];

        console.log('📅 Meses con ventas disponibles:', availableMonths.length);
      } catch (error) {
        console.log('❌ Error consultando ventas:', error);
      }
    }

    // 3. Verificar tabla de productos para obtener nombres
    let productsWithSales: any[] = [];
    if (salesData.length > 0) {
      try {
        const productIds = salesData.map(s => s.product_id).join(',');
        productsWithSales = await prisma.$queryRaw`
          SELECT 
            p.id,
            p.name,
            pc.name as category_name
          FROM products p
          LEFT JOIN product_categories pc ON p.category_id = pc.id
          WHERE p.id IN (${productIds})
          AND p.company_id = ${parseInt(companyId)}
        ` as any[];
      } catch (error) {
        console.log('❌ Error obteniendo nombres de productos:', error);
      }
    }

    // 4. Combinar datos
    const salesWithNames = salesData.map(sale => {
      const product = productsWithSales.find(p => p.id === sale.product_id);
      return {
        product_id: sale.product_id,
        product_name: product?.name || 'Desconocido',
        category_name: product?.category_name || 'Sin categoría',
        total_sales: Number(sale.total_sales),
        records_count: Number(sale.records_count)
      };
    });

    return NextResponse.json({
      companyId: parseInt(companyId),
      productionMonth: productionMonth,
      salesTableExists: salesTableExists,
      salesData: salesWithNames,
      availableMonths: availableMonths,
      summary: {
        products_with_sales: salesData.length,
        total_sales: salesData.reduce((sum, s) => sum + Number(s.total_sales), 0),
        months_available: availableMonths.length
      }
    });

  } catch (error) {
    console.error('❌ Error en debug ventas:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}