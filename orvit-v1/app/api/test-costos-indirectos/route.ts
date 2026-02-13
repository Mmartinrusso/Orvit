import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const month = searchParams.get('month');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    console.log('🔍 === TEST COSTOS INDIRECTOS (MonthlyIndirect) ===');
    console.log('CompanyId:', companyId);
    console.log('Mes:', month);

    // 1. VERIFICAR REGISTROS MENSUALES (indirect_cost_monthly_records - igual que el sistema legacy)
    let registrosMensuales = [];
    if (month) {
      registrosMensuales = await prisma.$queryRaw`
        SELECT 
          icmr.id,
          icmr.amount,
          icmr.fecha_imputacion,
          icb.name as cost_name
        FROM indirect_cost_monthly_records icmr
        JOIN indirect_cost_base icb ON icmr.cost_base_id = icb.id
        WHERE icmr.company_id = ${parseInt(companyId)}
        AND icmr.fecha_imputacion = ${month}
        ORDER BY icb.name
      ` as any[];

      console.log('📅 Registros mensuales (indirect_cost_monthly_records) para', month, ':', registrosMensuales.length);
      registrosMensuales.forEach((record: any) => {
        console.log(`  - ${record.cost_name}: $${Number(record.amount).toLocaleString('es-AR')}`);
      });

      const totalMensual = registrosMensuales.reduce((sum: number, record: any) => sum + Number(record.amount), 0);
      console.log('💰 Total costos indirectos del mes:', totalMensual.toLocaleString('es-AR'));
    }

    // 2. VERIFICAR TODOS LOS MESES DISPONIBLES
    const allMonths = await prisma.$queryRaw`
      SELECT DISTINCT icmr.fecha_imputacion as month, COUNT(*) as count, SUM(icmr.amount) as total
      FROM indirect_cost_monthly_records icmr
      WHERE icmr.company_id = ${parseInt(companyId)}
      GROUP BY icmr.fecha_imputacion
      ORDER BY icmr.fecha_imputacion DESC
    ` as any[];

    console.log('📅 Meses disponibles:', allMonths.length);
    allMonths.forEach((monthData: any) => {
      console.log(`  - ${monthData.month}: ${monthData.count} registros, Total: $${Number(monthData.total).toLocaleString('es-AR')}`);
    });

    // 3. VERIFICAR DISTRIBUCIÓN POR CATEGORÍAS
    const distribucion = await prisma.$queryRaw`
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

    console.log('🎯 Distribución por categorías:', distribucion.length);
    const categorias: { [key: string]: any[] } = {};
    distribucion.forEach((dist: any) => {
      if (!categorias[dist.category_name]) {
        categorias[dist.category_name] = [];
      }
      categorias[dist.category_name].push({
        cost_name: dist.cost_name,
        percentage: dist.percentage
      });
    });

    Object.keys(categorias).forEach(categoryName => {
      console.log(`  📦 ${categoryName}:`);
      categorias[categoryName].forEach((item: any) => {
        console.log(`    - ${item.cost_name}: ${item.percentage}%`);
      });
    });

    // 4. CALCULAR COSTOS POR CATEGORÍA
    const resultadosPorCategoria: { [key: string]: number } = {};
    
    if (month && registrosMensuales.length > 0) {
      for (const categoria of Object.keys(categorias)) {
        let totalCategoria = 0;
        
        for (const item of categorias[categoria]) {
          const registro = registrosMensuales.find((r: any) => r.cost_name === item.cost_name);
          if (registro) {
            const costoAsignado = Number(registro.amount) * (Number(item.percentage) / 100);
            totalCategoria += costoAsignado;
            console.log(`    💰 ${item.cost_name}: $${Number(registro.amount).toLocaleString('es-AR')} × ${item.percentage}% = $${costoAsignado.toFixed(2)}`);
          }
        }
        
        resultadosPorCategoria[categoria] = totalCategoria;
        console.log(`  🎯 Total ${categoria}: $${totalCategoria.toLocaleString('es-AR')}`);
      }
    }

    return NextResponse.json({
      companyId: parseInt(companyId),
      month: month,
      registrosMensuales: registrosMensuales,
      allMonths: allMonths,
      distribucion: distribucion,
      resultadosPorCategoria: resultadosPorCategoria,
      resumen: {
        totalRegistrosMensuales: registrosMensuales.length,
        totalDistribucion: distribucion.length,
        totalMensual: registrosMensuales.reduce((sum: number, record: any) => sum + Number(record.amount), 0),
        mesesDisponibles: allMonths.length
      }
    });

  } catch (error) {
    console.error('❌ Error en test costos indirectos:', error);
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