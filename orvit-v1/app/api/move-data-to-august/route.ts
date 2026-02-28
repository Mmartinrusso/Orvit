import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔄 === MOVIENDO DATOS A AGOSTO ===');
    console.log('CompanyId:', companyId);

    let results: any = {};

    // 1. Mover costos indirectos mensuales a agosto
    try {
      // Primero eliminar datos existentes de agosto
      await prisma.$executeRaw`
        DELETE FROM indirect_cost_monthly_records 
        WHERE company_id = ${parseInt(companyId)} 
        AND fecha_imputacion = '2025-08'
      `;

      // Copiar datos de 2025-08 (si existen) o crear datos de ejemplo
      const existingRecords = await prisma.$queryRaw`
        SELECT * FROM indirect_cost_monthly_records 
        WHERE company_id = ${parseInt(companyId)}
        LIMIT 1
      ` as any[];

      if (existingRecords.length > 0) {
        // Copiar todos los registros existentes a agosto
        await prisma.$executeRaw`
          INSERT INTO indirect_cost_monthly_records (company_id, cost_base_id, amount, fecha_imputacion)
          SELECT DISTINCT company_id, cost_base_id, amount, '2025-08'
          FROM indirect_cost_monthly_records 
          WHERE company_id = ${parseInt(companyId)}
          ON CONFLICT (company_id, cost_base_id, fecha_imputacion) DO UPDATE SET
            amount = EXCLUDED.amount
        `;
      }

      const augustRecords = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM indirect_cost_monthly_records 
        WHERE company_id = ${parseInt(companyId)} 
        AND fecha_imputacion = '2025-08'
      ` as any[];

      results.indirect_costs = {
        moved: true,
        count: Number(augustRecords[0].count)
      };

      console.log('✅ Costos indirectos movidos a agosto:', results.indirect_costs.count);
    } catch (error) {
      results.indirect_costs = {
        moved: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      console.log('❌ Error moviendo costos indirectos:', error);
    }

    // 2. Verificar/crear datos de ventas para agosto
    try {
      // Eliminar ventas existentes de agosto
      await prisma.$executeRaw`
        DELETE FROM monthly_sales 
        WHERE company_id = ${parseInt(companyId)} 
        AND DATE_TRUNC('month', created_at) = '2025-08-01'::date
      `;

      // Crear datos de ventas de ejemplo para algunos productos
      const products = await prisma.$queryRaw`
        SELECT p.id, p.name, pc.name as category_name
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.company_id = ${parseInt(companyId)}
        AND pc.name IN ('Bloques', 'Viguetas')
        LIMIT 8
      ` as any[];

      let salesCreated = 0;
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const quantity = [1000, 800, 600, 400, 300, 200, 150, 100][i] || 50;
        const price = 500 + (i * 100);

        try {
          await prisma.$executeRaw`
            INSERT INTO monthly_sales (
              company_id, product_id, quantity, unit_price, total_amount, created_at
            ) VALUES (
              ${parseInt(companyId)}, ${product.id}, ${quantity}, ${price}, 
              ${quantity * price}, '2025-08-15'::timestamp
            )
          `;
          salesCreated++;
        } catch (error) {
          console.log(`Error creando venta para ${product.name}:`, error);
        }
      }

      results.sales = {
        moved: true,
        count: salesCreated,
        products: products.length
      };

      console.log('✅ Ventas creadas para agosto:', salesCreated, 'productos');
    } catch (error) {
      results.sales = {
        moved: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      console.log('❌ Error creando ventas:', error);
    }

    // 3. Verificar datos de producción para agosto
    try {
      // Eliminar producción existente de agosto
      await prisma.$executeRaw`
        DELETE FROM monthly_production 
        WHERE company_id = ${parseInt(companyId)} 
        AND production_month = '2025-08'
      `;

      // Crear datos de producción de ejemplo
      const products = await prisma.$queryRaw`
        SELECT p.id, p.name, pc.name as category_name
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.company_id = ${parseInt(companyId)}
        AND pc.name IN ('Bloques', 'Viguetas')
        LIMIT 6
      ` as any[];

      let productionCreated = 0;
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const quantity = [1200, 900, 700, 500, 350, 200][i] || 100;

        try {
          await prisma.$executeRaw`
            INSERT INTO monthly_production (
              company_id, product_id, quantity, production_month, created_at
            ) VALUES (
              ${parseInt(companyId)}, ${product.id}, ${quantity}, 
              '2025-08', '2025-08-15'::timestamp
            )
          `;
          productionCreated++;
        } catch (error) {
          console.log(`Error creando producción para ${product.name}:`, error);
        }
      }

      results.production = {
        moved: true,
        count: productionCreated,
        products: products.length
      };

      console.log('✅ Producción creada para agosto:', productionCreated, 'productos');
    } catch (error) {
      results.production = {
        moved: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      console.log('❌ Error creando producción:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Datos movidos a agosto exitosamente',
      results: results,
      summary: {
        indirect_costs_moved: results.indirect_costs?.moved || false,
        sales_created: results.sales?.count || 0,
        production_created: results.production?.count || 0
      }
    });

  } catch (error) {
    console.error('❌ Error moviendo datos a agosto:', error);
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