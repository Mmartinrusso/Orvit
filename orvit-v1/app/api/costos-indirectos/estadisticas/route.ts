import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

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

    // Usar SQL directo para obtener estadísticas básicas
    const estadisticas = await prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT icb.id) as total_costos_base,
        COUNT(DISTINCT icc.id) as total_categorias,
        COUNT(icmr.id) as total_registros,
        COALESCE(SUM(icmr.amount), 0) as total_general,
        COALESCE(AVG(icmr.amount), 0) as promedio_costo
      FROM indirect_cost_base icb
      LEFT JOIN indirect_cost_categories icc ON icb.category_id = icc.id
      LEFT JOIN indirect_cost_monthly_records icmr ON icb.id = icmr.cost_base_id
      WHERE icb.company_id = ${parseInt(companyId)}
    `;

    const statsData = estadisticas[0] as any;

    // Obtener distribución por categorías usando SQL directo
    const distribucionCategoria = await prisma.$queryRaw`
      SELECT 
        icc.id,
        icc.name,
        icc.type,
        COUNT(DISTINCT icb.id) as total_costos,
        COUNT(icmr.id) as total_registros,
        COALESCE(SUM(icmr.amount), 0) as total_amount
      FROM indirect_cost_categories icc
      LEFT JOIN indirect_cost_base icb ON icc.id = icb.category_id AND icb.company_id = ${parseInt(companyId)}
      LEFT JOIN indirect_cost_monthly_records icmr ON icb.id = icmr.cost_base_id
      WHERE icc.company_id = ${parseInt(companyId)}
      GROUP BY icc.id, icc.name, icc.type
      ORDER BY total_amount DESC
    `;

    // Obtener costos más activos usando SQL directo
    const costosMasActivos = await prisma.$queryRaw`
      SELECT 
        icb.id,
        icb.name,
        icb.description,
        icc.name as category_name,
        COUNT(icmr.id) as total_registros,
        COALESCE(SUM(icmr.amount), 0) as total_amount,
        COALESCE(AVG(icmr.amount), 0) as promedio_mensual
      FROM indirect_cost_base icb
      LEFT JOIN indirect_cost_categories icc ON icb.category_id = icc.id
      LEFT JOIN indirect_cost_monthly_records icmr ON icb.id = icmr.cost_base_id
      WHERE icb.company_id = ${parseInt(companyId)}
      GROUP BY icb.id, icb.name, icb.description, icc.name
      HAVING COUNT(icmr.id) > 0
      ORDER BY total_registros DESC, total_amount DESC
      LIMIT 10
    `;

    // Obtener tendencia mensual usando SQL directo
    const tendenciaMensual = await prisma.$queryRaw`
      SELECT 
        icmr.fecha_imputacion as month,
        COUNT(icmr.id) as total_registros,
        COALESCE(SUM(icmr.amount), 0) as total_amount,
        COUNT(DISTINCT icmr.cost_base_id) as costos_activos
      FROM indirect_cost_monthly_records icmr
      INNER JOIN indirect_cost_base icb ON icmr.cost_base_id = icb.id
      WHERE icb.company_id = ${parseInt(companyId)}
      GROUP BY icmr.fecha_imputacion
      ORDER BY icmr.fecha_imputacion DESC
      LIMIT 6
    `;

    // Procesar datos para el frontend
    const totalGeneral = Number(statsData.total_general);
    
    const distribucionPorCategoria = (distribucionCategoria as any[]).map(cat => ({
      id: cat.id,
      name: cat.name,
      type: cat.type,
      totalCostos: Number(cat.total_costos),
      totalRegistros: Number(cat.total_registros),
      totalAmount: Number(cat.total_amount),
      porcentaje: totalGeneral > 0 ? Number(((Number(cat.total_amount) / totalGeneral) * 100).toFixed(2)) : 0
    }));

    const costosMasActivosProcesados = (costosMasActivos as any[]).map(costo => ({
      id: costo.id,
      name: costo.name,
      description: costo.description,
      categoryName: costo.category_name,
      totalRegistros: Number(costo.total_registros),
      totalAmount: Number(costo.total_amount),
      promedioMensual: Number(costo.promedio_mensual)
    }));

    const tendenciaMensualProcesada = (tendenciaMensual as any[]).map(mes => ({
      month: mes.month,
      totalRegistros: Number(mes.total_registros),
      totalAmount: Number(mes.total_amount),
      costosActivos: Number(mes.costos_activos)
    }));

    // Calcular tendencia
    let tendencia = 'estable';
    let variacion = 0;

    if (tendenciaMensualProcesada.length >= 2) {
      const mesActual = tendenciaMensualProcesada[0];
      const mesAnterior = tendenciaMensualProcesada[1];

      if (mesAnterior && mesAnterior.totalAmount > 0) {
        variacion = ((mesActual.totalAmount - mesAnterior.totalAmount) / mesAnterior.totalAmount) * 100;

        if (variacion > 5) {
          tendencia = 'incremento';
        } else if (variacion < -5) {
          tendencia = 'decremento';
        }
      }
    }

    const result = {
      general: {
        totalCostosBase: Number(statsData.total_costos_base),
        totalRegistrosMensuales: Number(statsData.total_registros),
        totalGeneral: totalGeneral,
        promedioPorRegistro: Number(statsData.promedio_costo),
        totalCategorias: Number(statsData.total_categorias)
      },
      distribucionPorCategoria,
      costosMasActivos: costosMasActivosProcesados,
      tendenciaMensual: tendenciaMensualProcesada,
      tendencias: {
        tendencia,
        variacion: Number(variacion.toFixed(2))
      }
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}