import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';
    const productionMonth = searchParams.get('month') || '2025-08';

    console.log('🔍 === DEBUG COSTOS INDIRECTOS ===');
    console.log('CompanyId:', companyId);
    console.log('Mes:', productionMonth);

    // 1. Obtener registros mensuales de costos indirectos
    const monthlyRecords = await prisma.$queryRaw`
      SELECT 
        icmr.id,
        icmr.amount,
        icmr.fecha_imputacion,
        icb.name as cost_name
      FROM indirect_cost_monthly_records icmr
      JOIN indirect_cost_base icb ON icmr.cost_base_id = icb.id
      WHERE icmr.company_id = ${parseInt(companyId)}
      AND icmr.fecha_imputacion = ${productionMonth}
      ORDER BY icb.name
    ` as any[];

    console.log('📅 Registros mensuales encontrados:', monthlyRecords.length);

    // 2. Obtener configuración de distribución por categorías
    const distributionConfig = await prisma.$queryRaw`
      SELECT 
        cdc.product_category_id,
        pc.name as category_name,
        cdc.cost_name,
        cdc.percentage,
        cdc.is_active
      FROM cost_distribution_config cdc
      LEFT JOIN product_categories pc ON cdc.product_category_id = pc.id
      WHERE cdc.company_id = ${parseInt(companyId)}
      AND cdc.is_active = true
      ORDER BY pc.name, cdc.cost_name
    ` as any[];

    console.log('🎯 Configuración de distribución:', distributionConfig.length);

    // 3. Calcular costos por categoría
    const costsByCategory: { [categoryId: number]: { total: number, breakdown: any[] } } = {};

    // Agrupar distribución por categoría
    const categoriesMap: { [categoryId: number]: any[] } = {};
    distributionConfig.forEach((config: any) => {
      if (!categoriesMap[config.product_category_id]) {
        categoriesMap[config.product_category_id] = [];
      }
      categoriesMap[config.product_category_id].push(config);
    });

    // Calcular costos para cada categoría
    Object.keys(categoriesMap).forEach(categoryIdStr => {
      const categoryId = parseInt(categoryIdStr);
      const categoryConfigs = categoriesMap[categoryId];
      let totalCategoryIndirectCost = 0;
      const breakdown: any[] = [];

      categoryConfigs.forEach((config: any) => {
        const monthlyRecord = monthlyRecords.find((record: any) => record.cost_name === config.cost_name);
        if (monthlyRecord) {
          const costAmount = Number(monthlyRecord.amount) * (Number(config.percentage) / 100);
          totalCategoryIndirectCost += costAmount;
          breakdown.push({
            cost_name: config.cost_name,
            base_amount: Number(monthlyRecord.amount),
            percentage: Number(config.percentage),
            assigned_amount: costAmount
          });
        }
      });

      costsByCategory[categoryId] = {
        total: totalCategoryIndirectCost,
        breakdown: breakdown
      };

      console.log(`💰 Categoría ${categoryId}: ${totalCategoryIndirectCost.toLocaleString('es-AR')}`);
    });

    return NextResponse.json({
      companyId: parseInt(companyId),
      productionMonth: productionMonth,
      monthlyRecords: monthlyRecords,
      distributionConfig: distributionConfig,
      categoriesMap: categoriesMap,
      costsByCategory: costsByCategory,
      summary: {
        monthlyRecordsCount: monthlyRecords.length,
        distributionConfigCount: distributionConfig.length,
        categoriesWithCosts: Object.keys(costsByCategory).length,
        totalIndirectCosts: Object.values(costsByCategory).reduce((sum, cat) => sum + cat.total, 0)
      }
    });

  } catch (error) {
    console.error('❌ Error en debug costos indirectos:', error);
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