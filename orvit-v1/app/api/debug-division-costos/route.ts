import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';
    const productionMonth = searchParams.get('productionMonth') || '2025-08';

    console.log('🔍 === DEBUG DIVISIÓN DE COSTOS ===');

    // Probar ambas APIs para comparar
    const response3000 = await fetch(`http://localhost:3000/api/calculadora-costos-final?companyId=${companyId}&productionMonth=${productionMonth}&distributionMethod=sales`);
    const data3000 = await response3000.json();

    const response3001 = await fetch(`http://localhost:3001/api/calculadora-precios-simple?companyId=${companyId}&productionMonth=${productionMonth}&distributionMethod=sales`);
    const data3001 = await response3001.json();

    // Buscar el mismo producto en ambas APIs
    const producto3000 = data3000.productPrices?.find((p: any) => p.product_name?.toLowerCase().includes('bloque'));
    const producto3001 = data3001.productPrices?.find((p: any) => p.product_name?.toLowerCase().includes('bloque'));

    const comparacion = {
      puerto_3000: producto3000 ? {
        nombre: producto3000.product_name,
        categoria: producto3000.category_name,
        costos: {
          materiales: Number(producto3000.cost_breakdown.materials).toFixed(2),
          indirectos: Number(producto3000.cost_breakdown.indirect_costs).toFixed(2),
          empleados: Number(producto3000.cost_breakdown.employee_costs).toFixed(2),
          total: Number(producto3000.cost_breakdown.total).toFixed(2)
        },
        distribucion: producto3000.distribution_info || 'No disponible'
      } : 'No encontrado',
      
      puerto_3001: producto3001 ? {
        nombre: producto3001.product_name,
        categoria: producto3001.category_name,
        costos: {
          materiales: Number(producto3001.cost_breakdown.materials).toFixed(2),
          indirectos: Number(producto3001.cost_breakdown.indirect_costs).toFixed(2),
          empleados: Number(producto3001.cost_breakdown.employee_costs).toFixed(2),
          total: Number(producto3001.cost_breakdown.total).toFixed(2)
        },
        distribucion: producto3001.production_info || 'No disponible'
      } : 'No encontrado'
    };

    // Análisis de diferencias
    const diferencias = {
      materiales: producto3000 && producto3001 ? 
        (Number(producto3001.cost_breakdown.materials) - Number(producto3000.cost_breakdown.materials)).toFixed(2) : 'N/A',
      indirectos: producto3000 && producto3001 ? 
        (Number(producto3001.cost_breakdown.indirect_costs) - Number(producto3000.cost_breakdown.indirect_costs)).toFixed(2) : 'N/A',
      empleados: producto3000 && producto3001 ? 
        (Number(producto3001.cost_breakdown.employee_costs) - Number(producto3000.cost_breakdown.employee_costs)).toFixed(2) : 'N/A',
      total: producto3000 && producto3001 ? 
        (Number(producto3001.cost_breakdown.total) - Number(producto3000.cost_breakdown.total)).toFixed(2) : 'N/A'
    };

    // Verificar si los costos indirectos están siendo divididos correctamente
    const diagnostico = {
      problema_detectado: Number(diferencias.indirectos) > 1000 ? 'COSTOS INDIRECTOS MUY ALTOS' : 'OK',
      posible_causa: Number(diferencias.indirectos) > 1000 ? 'No se está dividiendo por cantidad total de categoría' : 'Cálculo correcto',
      solucion_sugerida: Number(diferencias.indirectos) > 1000 ? 'Verificar que se divida: costoTotalCategoria / cantidadTotalCategoria' : 'No requiere acción'
    };

    return NextResponse.json({
      status: 'debug_complete',
      comparacion: comparacion,
      diferencias: diferencias,
      diagnostico: diagnostico,
      raw_data: {
        puerto_3000_summary: {
          total_productos: data3000.productPrices?.length || 0,
          summary: data3000.summary
        },
        puerto_3001_summary: {
          total_productos: data3001.productPrices?.length || 0,
          debug_info: data3001.debug_info
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en debug división costos:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}