import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';

    console.log('🔍 === TEST SIMPLE COSTOS ===');
    console.log('CompanyId:', companyId);

    // Verificar si existen las tablas básicas
    const results: any = {};

    // 1. Verificar indirect_cost_base
    try {
      const costBase = await prisma.$queryRaw`
        SELECT id, name, company_id 
        FROM indirect_cost_base 
        WHERE company_id = ${parseInt(companyId)}
        LIMIT 10
      ` as any[];
      
      results.indirect_cost_base = {
        count: costBase.length,
        data: costBase
      };
      console.log('✅ indirect_cost_base:', costBase.length, 'registros');
    } catch (error) {
      results.indirect_cost_base = {
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      console.log('❌ Error en indirect_cost_base:', results.indirect_cost_base.error);
    }

    // 2. Verificar indirect_cost_monthly_records
    try {
      const monthlyRecords = await prisma.$queryRaw`
        SELECT id, amount, fecha_imputacion, cost_base_id, company_id
        FROM indirect_cost_monthly_records 
        WHERE company_id = ${parseInt(companyId)}
        LIMIT 10
      ` as any[];
      
      results.indirect_cost_monthly_records = {
        count: monthlyRecords.length,
        data: monthlyRecords
      };
      console.log('✅ indirect_cost_monthly_records:', monthlyRecords.length, 'registros');
    } catch (error) {
      results.indirect_cost_monthly_records = {
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      console.log('❌ Error en indirect_cost_monthly_records:', results.indirect_cost_monthly_records.error);
    }

    // 3. Verificar cost_distribution_config
    try {
      const distribution = await prisma.$queryRaw`
        SELECT id, product_category_id, cost_name, percentage, is_active, company_id
        FROM cost_distribution_config 
        WHERE company_id = ${parseInt(companyId)}
        LIMIT 10
      ` as any[];
      
      results.cost_distribution_config = {
        count: distribution.length,
        data: distribution
      };
      console.log('✅ cost_distribution_config:', distribution.length, 'registros');
    } catch (error) {
      results.cost_distribution_config = {
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      console.log('❌ Error en cost_distribution_config:', results.cost_distribution_config.error);
    }

    // 4. Verificar product_categories
    try {
      const categories = await prisma.$queryRaw`
        SELECT id, name, company_id
        FROM product_categories 
        WHERE company_id = ${parseInt(companyId)}
        LIMIT 10
      ` as any[];
      
      results.product_categories = {
        count: categories.length,
        data: categories
      };
      console.log('✅ product_categories:', categories.length, 'registros');
    } catch (error) {
      results.product_categories = {
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      console.log('❌ Error en product_categories:', results.product_categories.error);
    }

    return NextResponse.json({
      companyId: parseInt(companyId),
      results: results,
      summary: {
        total_tables_checked: 4,
        tables_with_data: Object.keys(results).filter(key => results[key].count > 0).length,
        tables_with_errors: Object.keys(results).filter(key => results[key].error).length
      }
    });

  } catch (error) {
    console.error('❌ Error en test simple costos:', error);
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