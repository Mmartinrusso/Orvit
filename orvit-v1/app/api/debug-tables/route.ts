import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

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

    console.log('🔍 === DEBUG TABLAS ===');
    console.log('CompanyId:', companyId);

    const results: any = {};

    // 1. Verificar MonthlyIndirect
    try {
      const monthlyIndirect = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "MonthlyIndirect" 
        WHERE "companyId" = ${parseInt(companyId)}
        LIMIT 5
      ` as any[];
      results.MonthlyIndirect = {
        exists: true,
        count: monthlyIndirect[0]?.count || 0
      };
      console.log('✅ MonthlyIndirect existe:', results.MonthlyIndirect.count, 'registros');
    } catch (error) {
      results.MonthlyIndirect = {
        exists: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      console.log('❌ MonthlyIndirect no existe:', results.MonthlyIndirect.error);
    }

    // 2. Verificar indirect_cost_monthly_records
    try {
      const indirectCostMonthly = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM indirect_cost_monthly_records 
        WHERE company_id = ${parseInt(companyId)}
        LIMIT 5
      ` as any[];
      results.indirect_cost_monthly_records = {
        exists: true,
        count: indirectCostMonthly[0]?.count || 0
      };
      console.log('✅ indirect_cost_monthly_records existe:', results.indirect_cost_monthly_records.count, 'registros');
    } catch (error) {
      results.indirect_cost_monthly_records = {
        exists: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      console.log('❌ indirect_cost_monthly_records no existe:', results.indirect_cost_monthly_records.error);
    }

    // 3. Verificar indirect_cost_base
    try {
      const indirectCostBase = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM indirect_cost_base 
        WHERE company_id = ${parseInt(companyId)}
        LIMIT 5
      ` as any[];
      results.indirect_cost_base = {
        exists: true,
        count: indirectCostBase[0]?.count || 0
      };
      console.log('✅ indirect_cost_base existe:', results.indirect_cost_base.count, 'registros');
    } catch (error) {
      results.indirect_cost_base = {
        exists: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      console.log('❌ indirect_cost_base no existe:', results.indirect_cost_base.error);
    }

    // 4. Verificar IndirectItem (legacy)
    try {
      const indirectItem = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "IndirectItem" 
        WHERE "companyId" = ${parseInt(companyId)}
        LIMIT 5
      ` as any[];
      results.IndirectItem = {
        exists: true,
        count: indirectItem[0]?.count || 0
      };
      console.log('✅ IndirectItem existe:', results.IndirectItem.count, 'registros');
    } catch (error) {
      results.IndirectItem = {
        exists: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      console.log('❌ IndirectItem no existe:', results.IndirectItem.error);
    }

    // 5. Verificar cost_distribution_config
    try {
      const costDistribution = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM cost_distribution_config 
        WHERE company_id = ${parseInt(companyId)}
        LIMIT 5
      ` as any[];
      results.cost_distribution_config = {
        exists: true,
        count: costDistribution[0]?.count || 0
      };
      console.log('✅ cost_distribution_config existe:', results.cost_distribution_config.count, 'registros');
    } catch (error) {
      results.cost_distribution_config = {
        exists: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      console.log('❌ cost_distribution_config no existe:', results.cost_distribution_config.error);
    }

    return NextResponse.json({
      companyId: parseInt(companyId),
      tables: results,
      summary: {
        MonthlyIndirect: results.MonthlyIndirect.exists,
        indirect_cost_monthly_records: results.indirect_cost_monthly_records.exists,
        indirect_cost_base: results.indirect_cost_base.exists,
        IndirectItem: results.IndirectItem.exists,
        cost_distribution_config: results.cost_distribution_config.exists
      }
    });

  } catch (error) {
    console.error('❌ Error en debug tables:', error);
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