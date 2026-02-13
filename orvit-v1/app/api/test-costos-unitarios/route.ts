import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';
    const productionMonth = searchParams.get('productionMonth') || '2025-08';

    console.log('🔍 === TEST COSTOS UNITARIOS ===');

    // Probar API del puerto 3001 (calculadora-precios-simple)
    const response = await fetch(`http://localhost:3001/api/calculadora-precios-simple?companyId=${companyId}&productionMonth=${productionMonth}&distributionMethod=sales`);
    const data = await response.json();

    // Buscar productos con costos para analizar
    const productosConCostos = data.productPrices?.filter((p: any) => 
      p.cost_breakdown && 
      (p.cost_breakdown.materials > 0 || p.cost_breakdown.indirect_costs > 0 || p.cost_breakdown.employee_costs > 0)
    ) || [];

    // Analizar los primeros 3 productos
    const analisis = productosConCostos.slice(0, 3).map((producto: any) => ({
      nombre: producto.product_name,
      categoria: producto.category_name,
      costos: {
        materiales: Number(producto.cost_breakdown.materials).toFixed(2),
        indirectos: Number(producto.cost_breakdown.indirect_costs).toFixed(2),
        empleados: Number(producto.cost_breakdown.employee_costs).toFixed(2),
        total: Number(producto.cost_breakdown.total).toFixed(2)
      },
      distribucion: producto.production_info ? {
        cantidad_producida: producto.production_info.planned_production,
        metodo_distribucion: producto.production_info.distribution_method,
        fuente_datos: producto.production_info.source
      } : null
    }));

    // Buscar específicamente un bloque para comparar
    const bloque = productosConCostos.find((p: any) => p.product_name?.toLowerCase().includes('bloque'));
    
    const bloqueAnalisis = bloque ? {
      nombre: bloque.product_name,
      categoria: bloque.category_name,
      costos_detallados: {
        materiales: {
          valor: Number(bloque.cost_breakdown.materials).toFixed(2),
          fuente: bloque.recipe_id ? 'receta' : 'unit_cost'
        },
        indirectos: {
          valor: Number(bloque.cost_breakdown.indirect_costs).toFixed(2),
          distribucion: bloque.production_info?.planned_production || 0
        },
        empleados: {
          valor: Number(bloque.cost_breakdown.employee_costs).toFixed(2),
          distribucion: bloque.production_info?.planned_production || 0
        },
        total: Number(bloque.cost_breakdown.total).toFixed(2)
      },
      info_distribucion: bloque.production_info
    } : 'No se encontró bloque';

    return NextResponse.json({
      status: 'success',
      resumen: {
        total_productos: data.productPrices?.length || 0,
        productos_con_costos: productosConCostos.length,
        productos_sin_costos: (data.productPrices?.length || 0) - productosConCostos.length
      },
      analisis_productos: analisis,
      bloque_detallado: bloqueAnalisis,
      debug_info: data.debug_info
    });

  } catch (error) {
    console.error('❌ Error en test costos unitarios:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}