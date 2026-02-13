import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7); // YYYY-MM
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    // Calcular fechas del mes
    const startDate = new Date(`${month}-01`);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    
    // Asegurar que las fechas sean válidas
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid month format' }, { status: 400 });
    }

    // ✅ OPTIMIZADO: Ejecutar queries en paralelo
    const [salesData, allProductsInfo] = await Promise.all([
      // Obtener ventas del mes
      prisma.monthly_sales.findMany({
        where: {
          company_id: parseInt(companyId),
          fecha_imputacion: month
        }
      }),
      // Obtener todos los productos de la empresa con costo unitario
      prisma.$queryRaw`
        SELECT id, name, description, unit_cost
        FROM products
        WHERE company_id = ${parseInt(companyId)} AND is_active = true
      ` as Promise<{ id: number; name: string; description: string | null; unit_cost: number | null }[]>
    ]);

    // Obtener información de productos
    const productIdsString = Array.from(new Set(salesData.map(s => s.product_id)));
    const productIds = productIdsString.map(id => parseInt(id)).filter(id => !isNaN(id));

    // Filtrar solo los productos que tienen ventas
    const productsInfo = allProductsInfo.filter(p => productIds.includes(p.id));

    // Crear map usando string como key (porque product_id en sales es string)
    const productInfoMap = new Map(productsInfo.map(p => [p.id.toString(), p]));

    // Agrupar por producto
    const productStats: { [key: string]: any } = {};
    
    salesData.forEach(sale => {
      const productId = sale.product_id;
      const productName = sale.product_name;
      const productInfo = productInfoMap.get(productId);
      
      if (!productStats[productId]) {
        productStats[productId] = {
          id: productId,
          name: productName,
          description: productInfo?.description || null,
          unitCost: Number(productInfo?.unit_cost) || 0,
          totalQuantity: 0,
          totalRevenue: 0,
          totalCost: 0,
          salesCount: 0,
          unitPrice: 0
        };
      }
      
      const quantity = Number(sale.quantity_sold);
      productStats[productId].totalQuantity += quantity;
      productStats[productId].totalRevenue += Number(sale.total_revenue);
      productStats[productId].totalCost += quantity * productStats[productId].unitCost;
      productStats[productId].salesCount += 1;
      productStats[productId].unitPrice = Number(sale.unit_price);
    });

    // Convertir a array y calcular métricas reales
    const products = Object.values(productStats).map((product: any) => {
      const profit = product.totalRevenue - product.totalCost;
      const marginPct = product.totalRevenue > 0 ? (profit / product.totalRevenue) * 100 : 0;

      return {
        ...product,
        // Alias para compatibilidad con el dashboard
        product_name: product.name,
        quantity_sold: product.totalQuantity,
        total_revenue: product.totalRevenue,
        quantity: product.totalQuantity,
        revenue: product.totalRevenue,
        cost: product.totalCost,
        price: product.unitPrice,
        profit: profit / Math.max(product.totalQuantity, 1), // Ganancia por unidad
        margin: profit,
        marginPct
      };
    });

    // Ordenar por diferentes criterios
    const topByQuantity = [...products]
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, limit);
    
    const topByRevenue = [...products]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
    
    const topByMargin = [...products]
      .sort((a, b) => (b.margin || 0) - (a.margin || 0))
      .slice(0, limit);

    return NextResponse.json({
      topByQuantity,
      topByRevenue,
      topByMargin,
      topSold: topByRevenue,
      topProduced: topByQuantity,
      period: new Date(`${month}-01`).toLocaleDateString('es-AR', { 
        year: 'numeric', 
        month: 'long' 
      })
    });

  } catch (error) {
    console.error('Error fetching top products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top products' },
      { status: 500 }
    );
  }
}