import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

    console.log(`🔍 Sales Analysis - Company: ${companyId}, Month: ${month}`);

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    // Obtener datos de ventas del mes
    const salesData = await prisma.monthly_sales.findMany({
      where: {
        company_id: parseInt(companyId),
        OR: [
          {
            month_year: {
              gte: new Date(`${month}-01`),
              lte: new Date(new Date(`${month}-01`).getFullYear(), new Date(`${month}-01`).getMonth() + 1, 0)
            }
          },
          {
            fecha_imputacion: month
          }
        ]
      }
    });

    console.log(`💰 Sales data found: ${salesData.length} records`);

    // Calcular métricas de ventas
    const totalRevenue = salesData.reduce((sum, sale) => sum + Number(sale.total_revenue), 0);
    const totalUnits = salesData.reduce((sum, sale) => sum + Number(sale.quantity_sold), 0);

    // Agrupar por producto y calcular top productos
    const productStats: { [key: string]: { name: string; units: number; revenue: number } } = {};
    
    salesData.forEach(sale => {
      const productName = sale.product_name;
      if (!productStats[productName]) {
        productStats[productName] = {
          name: productName,
          units: 0,
          revenue: 0
        };
      }
      productStats[productName].units += Number(sale.quantity_sold);
      productStats[productName].revenue += Number(sale.total_revenue);
    });

    const topProducts = Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return NextResponse.json({
      totalRevenue,
      totalUnits,
      topProducts
    });

  } catch (error) {
    console.error('Error fetching sales analysis:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales analysis' },
      { status: 500 }
    );
  }
}
