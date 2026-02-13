import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  console.log('🚀 === TEST COSTS ENDPOINT ===');
  console.log('🚀 Timestamp:', new Date().toISOString());
  
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const productionMonth = searchParams.get('productionMonth');

    console.log('🔍 CompanyId:', companyId);
    console.log('🔍 ProductionMonth:', productionMonth);

    if (!companyId || !productionMonth) {
      return NextResponse.json({ error: 'Parámetros requeridos' }, { status: 400 });
    }

    // Obtener costos indirectos del mes
    const costs = await prisma.$queryRaw`
      SELECT amount FROM indirect_cost_monthly_records 
      WHERE company_id = ${parseInt(companyId)} 
      AND fecha_imputacion = ${productionMonth}
    ` as any[];

    console.log(`📊 Costos encontrados: ${costs.length}`);

    const totalCosts = costs.reduce((sum, cost) => sum + Number(cost.amount), 0);
    console.log(`💰 Total costos: $${totalCosts.toFixed(2)}`);

    return NextResponse.json({
      success: true,
      count: costs.length,
      total: totalCosts,
      data: costs
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
