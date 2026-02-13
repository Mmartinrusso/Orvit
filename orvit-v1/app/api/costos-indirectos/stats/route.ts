import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const month = searchParams.get('month'); // Opcional: mes específico

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const companyIdNum = parseInt(companyId);

    // 1. Estadísticas generales del mes
    let generalStats: any[];
    if (month) {
      generalStats = await prisma.$queryRaw`
        SELECT
          COUNT(DISTINCT ic.id) as total_costos,
          COUNT(DISTINCT icc.id) as total_categorias,
          COALESCE(SUM(ic.amount), 0) as total_general,
          COALESCE(AVG(ic.amount), 0) as promedio_costo,
          COUNT(CASE WHEN ic.status = 'paid' THEN 1 END) as total_pagados,
          COUNT(CASE WHEN ic.status = 'pending' THEN 1 END) as total_pendientes,
          COUNT(CASE WHEN ic.status = 'overdue' THEN 1 END) as total_vencidos
        FROM indirect_costs ic
        LEFT JOIN indirect_cost_categories icc ON ic.category_id = icc.id
        WHERE ic.company_id = ${companyIdNum} AND ic.fecha_imputacion = ${month}
      `;
    } else {
      generalStats = await prisma.$queryRaw`
        SELECT
          COUNT(DISTINCT ic.id) as total_costos,
          COUNT(DISTINCT icc.id) as total_categorias,
          COALESCE(SUM(ic.amount), 0) as total_general,
          COALESCE(AVG(ic.amount), 0) as promedio_costo,
          COUNT(CASE WHEN ic.status = 'paid' THEN 1 END) as total_pagados,
          COUNT(CASE WHEN ic.status = 'pending' THEN 1 END) as total_pendientes,
          COUNT(CASE WHEN ic.status = 'overdue' THEN 1 END) as total_vencidos
        FROM indirect_costs ic
        LEFT JOIN indirect_cost_categories icc ON ic.category_id = icc.id
        WHERE ic.company_id = ${companyIdNum}
      `;
    }

    // 2. Distribución por categoría
    let distribucionCategoria: any[];
    if (month) {
      distribucionCategoria = await prisma.$queryRaw`
        SELECT
          icc.id,
          icc.name,
          icc.type,
          COUNT(ic.id) as costo_count,
          COALESCE(SUM(ic.amount), 0) as total_cost
        FROM indirect_cost_categories icc
        LEFT JOIN indirect_costs ic ON icc.id = ic.category_id
          AND ic.company_id = ${companyIdNum}
          AND ic.fecha_imputacion = ${month}
        WHERE icc.company_id = ${companyIdNum}
        GROUP BY icc.id, icc.name, icc.type
        ORDER BY total_cost DESC
      `;
    } else {
      distribucionCategoria = await prisma.$queryRaw`
        SELECT
          icc.id,
          icc.name,
          icc.type,
          COUNT(ic.id) as costo_count,
          COALESCE(SUM(ic.amount), 0) as total_cost
        FROM indirect_cost_categories icc
        LEFT JOIN indirect_costs ic ON icc.id = ic.category_id AND ic.company_id = ${companyIdNum}
        WHERE icc.company_id = ${companyIdNum}
        GROUP BY icc.id, icc.name, icc.type
        ORDER BY total_cost DESC
      `;
    }

    // 3. Distribución por mes (últimos 6 meses)
    const distribucionMes = await prisma.$queryRaw`
      SELECT
        ic.fecha_imputacion as month,
        COUNT(ic.id) as costo_count,
        COALESCE(SUM(ic.amount), 0) as total_cost
      FROM indirect_costs ic
      WHERE ic.company_id = ${companyIdNum}
      GROUP BY ic.fecha_imputacion
      ORDER BY ic.fecha_imputacion DESC
      LIMIT 6
    `;

    // 4. Costos más altos
    let costosMasAltos: any[];
    if (month) {
      costosMasAltos = await prisma.$queryRaw`
        SELECT
          ic.id,
          ic.name,
          icc.name as category_name,
          ic.amount,
          ic.fecha_imputacion as month,
          ic.status
        FROM indirect_costs ic
        INNER JOIN indirect_cost_categories icc ON ic.category_id = icc.id
        WHERE ic.company_id = ${companyIdNum} AND ic.fecha_imputacion = ${month}
        ORDER BY ic.amount DESC
        LIMIT 5
      `;
    } else {
      costosMasAltos = await prisma.$queryRaw`
        SELECT
          ic.id,
          ic.name,
          icc.name as category_name,
          ic.amount,
          ic.fecha_imputacion as month,
          ic.status
        FROM indirect_costs ic
        INNER JOIN indirect_cost_categories icc ON ic.category_id = icc.id
        WHERE ic.company_id = ${companyIdNum}
        ORDER BY ic.amount DESC
        LIMIT 5
      `;
    }

    // 5. Tendencia de costos (comparación mes anterior vs actual)
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    const previousMonth = new Date(new Date(currentMonth + '-01').getTime() - 24*60*60*1000).toISOString().slice(0, 7);

    const tendencia = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM(CASE WHEN ic.fecha_imputacion = ${currentMonth} THEN ic.amount ELSE 0 END), 0) as mes_actual,
        COALESCE(SUM(CASE WHEN ic.fecha_imputacion = ${previousMonth} THEN ic.amount ELSE 0 END), 0) as mes_anterior
      FROM indirect_costs ic
      WHERE ic.company_id = ${companyIdNum}
    `;

    // Procesar datos
    const stats = generalStats[0] as any;
    const totalGeneral = Number(stats?.total_general || 0);
    const mesActual = Number((tendencia as any[])[0]?.mes_actual || 0);
    const mesAnterior = Number((tendencia as any[])[0]?.mes_anterior || 0);
    const variacion = mesAnterior > 0 ? ((mesActual - mesAnterior) / mesAnterior) * 100 : 0;

    // Calcular porcentajes para categorías
    const distribucionPorCategoria = (distribucionCategoria as any[]).map(cat => ({
      id: cat.id,
      name: cat.name,
      type: cat.type,
      costoCount: Number(cat.costo_count),
      totalCost: Number(cat.total_cost),
      porcentaje: totalGeneral > 0 ? (Number(cat.total_cost) / totalGeneral) * 100 : 0
    }));

    // Calcular porcentajes para meses
    const distribucionPorMes = (distribucionMes as any[]).map(mes => ({
      month: mes.month,
      costoCount: Number(mes.costo_count),
      totalCost: Number(mes.total_cost),
      porcentaje: totalGeneral > 0 ? (Number(mes.total_cost) / totalGeneral) * 100 : 0
    }));

    const result = {
      general: {
        totalCostos: Number(stats?.total_costos || 0),
        totalCategorias: Number(stats?.total_categorias || 0),
        totalGeneral: totalGeneral,
        promedioCosto: Number(stats?.promedio_costo || 0),
        totalPagados: Number(stats?.total_pagados || 0),
        totalPendientes: Number(stats?.total_pendientes || 0),
        totalVencidos: Number(stats?.total_vencidos || 0)
      },
      distribucionPorCategoria,
      distribucionPorMes,
      costosMasAltos: (costosMasAltos as any[]).map(costo => ({
        id: costo.id,
        name: costo.name,
        categoryName: costo.category_name,
        amount: Number(costo.amount),
        month: costo.month,
        status: costo.status
      })),
      tendencias: {
        mesActual,
        mesAnterior,
        variacion: Number(variacion.toFixed(2)),
        tendencia: variacion > 0 ? 'incremento' : variacion < 0 ? 'decremento' : 'estable'
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
