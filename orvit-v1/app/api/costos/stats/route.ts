import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Caché en memoria para stats con límite
const statsCache = new Map<string, { data: any; timestamp: number }>();
const STATS_CACHE_TTL = 60 * 1000; // 60 segundos
const STATS_CACHE_MAX_SIZE = 100; // Máximo 100 entradas

// Función para limpiar cache (LRU-style)
function cleanupStatsCache() {
  const now = Date.now();

  // Primero eliminar entradas expiradas
  for (const [key, value] of statsCache.entries()) {
    if (now - value.timestamp > STATS_CACHE_TTL) {
      statsCache.delete(key);
    }
  }

  // Si aún excede el límite, eliminar las más antiguas
  if (statsCache.size > STATS_CACHE_MAX_SIZE) {
    const entries = Array.from(statsCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, statsCache.size - STATS_CACHE_MAX_SIZE);
    for (const [key] of toRemove) {
      statsCache.delete(key);
    }
  }
}

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

    // ✅ OPTIMIZACIÓN: Verificar caché
    const cacheKey = `costos-stats-${companyId}`;
    const cached = statsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < STATS_CACHE_TTL) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'private, max-age=60',
          'X-Cache': 'HIT'
        }
      });
    }

    const companyIdNum = parseInt(companyId);

    // Log solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Obteniendo estadísticas para companyId:', companyIdNum);
    }

    // ✅ MEGA OPTIMIZACIÓN: Una sola query CTE que obtiene TODAS las estadísticas
    let allStats: any[];
    try {
      // Primero verificar si hay empleados para esta empresa
      const employeeCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM employees WHERE company_id = ${companyIdNum}
      `;
      
      if (!employeeCount || employeeCount.length === 0 || Number(employeeCount[0].count) === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️ No hay empleados para esta empresa, retornando datos vacíos');
        }
        // Retornar estructura vacía pero válida
        const emptyStats = {
          totalGeneral: 0,
          totalEmpleados: 0,
          totalCategorias: 0,
          promedioSalario: 0,
          empleadoMasCostoso: null,
          categoriaMasCostosa: null,
          distribucionPorCategoria: [],
          distribucionPorEmpleado: [],
          tendencias: {
            totalCostosUltimoMes: 0,
            variacionUltimoMes: 0,
            empleadosNuevos: 0
          }
        };
        
        statsCache.set(cacheKey, {
          data: emptyStats,
          timestamp: Date.now()
        });
        
        return NextResponse.json(emptyStats, {
          headers: {
            'Cache-Control': 'private, max-age=60',
            'X-Cache': 'MISS'
          }
        });
      }

      // Simplificar: obtener datos básicos primero sin CTEs complejas
      const employees = await prisma.$queryRaw<any[]>`
        SELECT 
          e.id,
          e.name,
          e.role,
          e.category_id,
          e.created_at,
          COALESCE(latest_salary.gross_salary, e.gross_salary, 0) as gross_salary,
          COALESCE(latest_salary.payroll_taxes, e.payroll_taxes, 0) as payroll_taxes,
          COALESCE(
            latest_salary.gross_salary + COALESCE(latest_salary.payroll_taxes, 0),
            e.gross_salary + COALESCE(e.payroll_taxes, 0),
            0
          ) as total_cost
        FROM employees e
        LEFT JOIN LATERAL (
          SELECT esh.gross_salary, esh.payroll_taxes
          FROM employee_salary_history esh
          WHERE esh.employee_id = e.id
          ORDER BY esh.effective_from DESC NULLS LAST
          LIMIT 1
        ) latest_salary ON true
        WHERE e.company_id = ${companyIdNum} AND e.active = true
      `;

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Empleados obtenidos:', employees?.length || 0);
      }

      // Calcular estadísticas en JavaScript en lugar de SQL complejo
      const totalEmpleados = employees.length;
      const totalGeneral = employees.reduce((sum, emp) => sum + Number(emp.total_cost || 0), 0);
      const promedioSalario = totalEmpleados > 0 ? totalGeneral / totalEmpleados : 0;
      
      // Empleados nuevos (último mes)
      const unMesAtras = new Date();
      unMesAtras.setMonth(unMesAtras.getMonth() - 1);
      const empleadosNuevos = employees.filter(emp => {
        const createdAt = emp.created_at ? new Date(emp.created_at) : null;
        return createdAt && createdAt >= unMesAtras;
      }).length;

      // Agrupar por categoría
      const categoriasMap = new Map();
      employees.forEach(emp => {
        if (!emp.category_id) return;
        const catId = Number(emp.category_id);
        if (!categoriasMap.has(catId)) {
          categoriasMap.set(catId, {
            id: catId,
            empleado_count: 0,
            total_cost: 0
          });
        }
        const cat = categoriasMap.get(catId);
        cat.empleado_count++;
        cat.total_cost += Number(emp.total_cost || 0);
      });

      // Obtener nombres de categorías
      const categoryIds = Array.from(categoriasMap.keys());
      let categoryNames: any[] = [];
      if (categoryIds.length > 0) {
        categoryNames = await prisma.$queryRaw<any[]>`
          SELECT id, name FROM employee_categories 
          WHERE id = ANY(${categoryIds}::int[]) AND company_id = ${companyIdNum} AND is_active = true
        `;
      }

      const categoryNamesMap = new Map(categoryNames.map((c: any) => [Number(c.id), c.name]));

      // Construir distribucionPorCategoria
      const distribucionPorCategoria = Array.from(categoriasMap.values()).map(cat => ({
        id: cat.id,
        name: categoryNamesMap.get(cat.id) || 'Sin nombre',
        totalCost: cat.total_cost,
        empleadoCount: cat.empleado_count,
        porcentaje: totalGeneral > 0 ? (cat.total_cost / totalGeneral) * 100 : 0
      }));

      // Distribución por empleado
      const distribucionPorEmpleado = employees
        .map(emp => ({
          id: String(emp.id || ''),
          name: emp.name || 'Sin nombre',
          role: emp.role || 'Sin rol',
          grossSalary: Number(emp.gross_salary || 0),
          payrollTaxes: Number(emp.payroll_taxes || 0),
          totalCost: Number(emp.total_cost || 0),
          porcentaje: totalGeneral > 0 ? (Number(emp.total_cost || 0) / totalGeneral) * 100 : 0
        }))
        .sort((a, b) => b.totalCost - a.totalCost);

      // Categoría más costosa
      const categoriaMasCostosa = distribucionPorCategoria.length > 0
        ? distribucionPorCategoria.reduce((max, cat) => cat.totalCost > max.totalCost ? cat : max)
        : null;

      // Empleado más costoso
      const empleadoMasCostoso = distribucionPorEmpleado.length > 0
        ? distribucionPorEmpleado[0]
        : null;

      // Construir respuesta
      allStats = [{
        type: 'summary',
        total_empleados: totalEmpleados,
        total_categorias: distribucionPorCategoria.length,
        promedio_salario: promedioSalario,
        total_general: totalGeneral,
        empleados_nuevos: empleadosNuevos,
        distribucion_categoria: distribucionPorCategoria,
        distribucion_empleado: distribucionPorEmpleado,
        categoria_mas_costosa: categoriaMasCostosa,
        empleado_mas_costoso: empleadoMasCostoso
      }];
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Query ejecutada exitosamente, resultados:', allStats?.length || 0);
      }
    } catch (queryError) {
      console.error('❌ Error en la query SQL:', queryError);
      console.error('❌ Error completo:', JSON.stringify(queryError, null, 2));
      throw new Error(`Error en query SQL: ${queryError instanceof Error ? queryError.message : String(queryError)}`);
    }

    // Validar que hay datos
    if (!allStats || allStats.length === 0) {
      console.error('❌ Query no devolvió resultados');
      return NextResponse.json(
        { error: 'No se encontraron datos para esta empresa' },
        { status: 404 }
      );
    }

    const statsData = allStats[0];
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 StatsData procesado:', {
        total_empleados: statsData?.total_empleados,
        total_categorias: statsData?.total_categorias,
        total_general: statsData?.total_general
      });
    }

    // Los datos ya están procesados en JavaScript, solo necesitamos formatearlos
    const stats = {
      totalGeneral: Number(statsData.total_general) || 0,
      totalEmpleados: Number(statsData.total_empleados) || 0,
      totalCategorias: Number(statsData.total_categorias) || 0,
      promedioSalario: Number(statsData.promedio_salario) || 0,
      empleadoMasCostoso: statsData.empleado_mas_costoso ? {
        id: String(statsData.empleado_mas_costoso.id || ''),
        name: statsData.empleado_mas_costoso.name || 'Sin nombre',
        totalCost: Number(statsData.empleado_mas_costoso.totalCost || 0)
      } : null,
      categoriaMasCostosa: statsData.categoria_mas_costosa ? {
        id: Number(statsData.categoria_mas_costosa.id) || 0,
        name: statsData.categoria_mas_costosa.name || 'Sin nombre',
        totalCost: Number(statsData.categoria_mas_costosa.totalCost || 0),
        empleadoCount: Number(statsData.categoria_mas_costosa.empleadoCount || 0)
      } : null,
      distribucionPorCategoria: statsData.distribucion_categoria || [],
      distribucionPorEmpleado: statsData.distribucion_empleado || [],
      tendencias: {
        totalCostosUltimoMes: Number(statsData.total_general) || 0,
        variacionUltimoMes: 0,
        empleadosNuevos: Number(statsData.empleados_nuevos) || 0
      }
    };

    // ✅ OPTIMIZACIÓN: Guardar en caché
    statsCache.set(cacheKey, {
      data: stats,
      timestamp: Date.now()
    });

    // Limpiar caché si excede límite
    if (statsCache.size > STATS_CACHE_MAX_SIZE) {
      cleanupStatsCache();
    }

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'private, max-age=60',
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack available');
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      companyId: request.nextUrl.searchParams.get('companyId')
    });
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido',
        ...(process.env.NODE_ENV === 'development' && {
          stack: error instanceof Error ? error.stack : undefined
        })
      },
      { status: 500 }
    );
  }
}
