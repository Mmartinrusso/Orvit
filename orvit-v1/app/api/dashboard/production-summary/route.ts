import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    // Obtener datos de producción del mes
    const productionData = await prisma.$queryRaw`
      SELECT 
        mp.product_name,
        CAST(SUM(mp.quantity_produced) AS DECIMAL(15,4)) as total_quantity,
        CAST(COALESCE(SUM(mp.total_cost), 0) AS DECIMAL(15,2)) as total_cost,
        CAST(COALESCE(AVG(mp.unit_cost), 0) AS DECIMAL(15,2)) as avg_unit_cost,
        p.subcategory_id,
        sc.name as subcategory_name
      FROM monthly_production mp
      LEFT JOIN products p ON p.name = mp.product_name AND p.company_id = mp.company_id
      LEFT JOIN product_subcategories sc ON sc.id = p.subcategory_id
      WHERE mp.company_id = ${parseInt(companyId)}
        AND mp.fecha_imputacion = ${month}
      GROUP BY mp.product_name, p.subcategory_id, sc.name
    ` as any[];

    // Calcular métricas de producción
    const totalUnits = productionData.reduce((sum, prod) => {
      const units = typeof prod.total_quantity === 'object' && 'toNumber' in prod.total_quantity 
        ? prod.total_quantity.toNumber() 
        : Number(prod.total_quantity || 0);
      return sum + units;
    }, 0);
    const totalValue = productionData.reduce((sum, prod) => {
      const value = typeof prod.total_cost === 'object' && 'toNumber' in prod.total_cost 
        ? prod.total_cost.toNumber() 
        : Number(prod.total_cost || 0);
      return sum + value;
    }, 0);

    // Agrupar por producto y calcular top productos
    const productStats: { [key: string]: { name: string; units: number; value: number; unitCost: number; subcategoryName: string | null } } = {};
    
    productionData.forEach(prod => {
      const productName = prod.product_name;
      if (!productStats[productName]) {
        productStats[productName] = {
          name: productName,
          units: 0,
          value: 0,
          unitCost: 0,
          subcategoryName: prod.subcategory_name || null
        };
      }
      // Convertir Decimal a Number explícitamente
      const units = typeof prod.total_quantity === 'object' && 'toNumber' in prod.total_quantity 
        ? prod.total_quantity.toNumber() 
        : Number(prod.total_quantity || 0);
      const value = typeof prod.total_cost === 'object' && 'toNumber' in prod.total_cost 
        ? prod.total_cost.toNumber() 
        : Number(prod.total_cost || 0);
      const unitCost = typeof prod.avg_unit_cost === 'object' && 'toNumber' in prod.avg_unit_cost 
        ? prod.avg_unit_cost.toNumber() 
        : Number(prod.avg_unit_cost || 0);
      
      productStats[productName].units += units;
      productStats[productName].value += value;
      productStats[productName].unitCost = unitCost;
    });

    const topProducts = Object.values(productStats)
      .sort((a, b) => b.units - a.units)
      .map(p => ({
        name: p.name,
        units: p.units,
        value: p.value,
        unitCost: p.unitCost,
        subcategoryName: p.subcategoryName
      }));

    return NextResponse.json({
      totalUnits,
      totalValue,
      topProducts
    });

  } catch (error) {
    console.error('Error fetching production summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch production summary' },
      { status: 500 }
    );
  }
}
