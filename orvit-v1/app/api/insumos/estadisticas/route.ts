import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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

    // ✅ OPTIMIZADO: Ejecutar todas las queries en paralelo
    const [generalStats, precioPromedio, distribucionProveedor, distribucionUnidad, ultimosPrecios] = await Promise.all([
      // Estadísticas generales
      prisma.$queryRaw`
        SELECT 
          COUNT(DISTINCT s.id) as "totalInsumos",
          COUNT(DISTINCT CASE WHEN s.is_active = true THEN s.id END) as "insumosActivos",
          COUNT(DISTINCT CASE WHEN s.is_active = false THEN s.id END) as "insumosInactivos",
          COUNT(DISTINCT sup.id) as "totalProveedores",
          COUNT(DISTINCT smp.id) as "totalPreciosRegistrados"
        FROM supplies s
        LEFT JOIN suppliers sup ON s.supplier_id = sup.id
        LEFT JOIN supply_monthly_prices smp ON s.id = smp.supply_id
        WHERE s.company_id = ${parseInt(companyId)}
      `,
      // Precio promedio por insumo
      prisma.$queryRaw`
        SELECT COALESCE(AVG(latest_prices.price_per_unit), 0) as "precioPromedio"
        FROM (
          SELECT DISTINCT ON (supply_id) supply_id, price_per_unit
          FROM supply_monthly_prices WHERE company_id = ${parseInt(companyId)}
          ORDER BY supply_id, month_year DESC
        ) latest_prices
      `,
      // Distribución por proveedor
      prisma.$queryRaw`
        SELECT COALESCE(sup.name, 'Sin proveedor') as "proveedor", COUNT(s.id) as "cantidadInsumos"
        FROM supplies s LEFT JOIN suppliers sup ON s.supplier_id = sup.id
        WHERE s.company_id = ${parseInt(companyId)}
        GROUP BY sup.name ORDER BY COUNT(s.id) DESC
      `,
      // Distribución por unidad de medida
      prisma.$queryRaw`
        SELECT unit_measure as "unidad", COUNT(id) as "cantidadInsumos"
        FROM supplies WHERE company_id = ${parseInt(companyId)}
        GROUP BY unit_measure ORDER BY COUNT(id) DESC
      `,
      // Últimos precios registrados
      prisma.$queryRaw`
        SELECT s.name as "insumo", s.unit_measure as "unidad", smp.price_per_unit as "precio",
               smp.month_year as "mes", COALESCE(sup.name, 'Sin proveedor') as "proveedor"
        FROM supply_monthly_prices smp
        INNER JOIN supplies s ON smp.supply_id = s.id
        LEFT JOIN suppliers sup ON s.supplier_id = sup.id
        WHERE smp.company_id = ${parseInt(companyId)}
        ORDER BY smp.month_year DESC, s.name LIMIT 10
      `
    ]);

    const stats = {
      general: (generalStats as any[])[0],
      precioPromedio: (precioPromedio as any[])[0]?.precioPromedio || 0,
      distribucionProveedor,
      distribucionUnidad,
      ultimosPrecios
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
