import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '3';
    const productionMonth = searchParams.get('productionMonth') || '2025-08';

    console.log('🔍 === TEST SISTEMA COMPLETO ===');
    console.log('CompanyId:', companyId);
    console.log('Mes:', productionMonth);

    // Probar API del puerto 3000 (calculadora-costos-final)
    const response3000 = await fetch(`http://localhost:3000/api/calculadora-costos-final?companyId=${companyId}&productionMonth=${productionMonth}&distributionMethod=sales`);
    const data3000 = await response3000.json();

    // Probar API del puerto 3001 (calculadora-precios-simple)
    const response3001 = await fetch(`http://localhost:3001/api/calculadora-precios-simple?companyId=${companyId}&productionMonth=${productionMonth}&distributionMethod=sales`);
    const data3001 = await response3001.json();

    // Comparar resultados
    const comparison = {
      puerto_3000: {
        total_productos: data3000.productPrices?.length || 0,
        ejemplo_producto: data3000.productPrices?.[0] ? {
          nombre: data3000.productPrices[0].product_name,
          materiales: data3000.productPrices[0].cost_breakdown?.materials || 0,
          indirectos: data3000.productPrices[0].cost_breakdown?.indirect_costs || 0,
          empleados: data3000.productPrices[0].cost_breakdown?.employee_costs || 0,
          total: data3000.productPrices[0].cost_breakdown?.total || 0
        } : null
      },
      puerto_3001: {
        total_productos: data3001.productPrices?.length || 0,
        ejemplo_producto: data3001.productPrices?.[0] ? {
          nombre: data3001.productPrices[0].product_name,
          materiales: data3001.productPrices[0].cost_breakdown?.materials || 0,
          indirectos: data3001.productPrices[0].cost_breakdown?.indirect_costs || 0,
          empleados: data3001.productPrices[0].cost_breakdown?.employee_costs || 0,
          total: data3001.productPrices[0].cost_breakdown?.total || 0
        } : null
      }
    };

    // Buscar un producto específico para comparar
    const bloque3000 = data3000.productPrices?.find((p: any) => p.product_name?.includes('Bloque'));
    const bloque3001 = data3001.productPrices?.find((p: any) => p.product_name?.includes('Bloque'));

    const bloqueComparison = {
      puerto_3000: bloque3000 ? {
        nombre: bloque3000.product_name,
        materiales: bloque3000.cost_breakdown?.materials || 0,
        indirectos: bloque3000.cost_breakdown?.indirect_costs || 0,
        empleados: bloque3000.cost_breakdown?.employee_costs || 0,
        total: bloque3000.cost_breakdown?.total || 0
      } : 'No encontrado',
      puerto_3001: bloque3001 ? {
        nombre: bloque3001.product_name,
        materiales: bloque3001.cost_breakdown?.materials || 0,
        indirectos: bloque3001.cost_breakdown?.indirect_costs || 0,
        empleados: bloque3001.cost_breakdown?.employee_costs || 0,
        total: bloque3001.cost_breakdown?.total || 0
      } : 'No encontrado'
    };

    return NextResponse.json({
      status: 'success',
      comparison: comparison,
      bloque_comparison: bloqueComparison,
      raw_data: {
        puerto_3000: data3000,
        puerto_3001: data3001
      }
    });

  } catch (error) {
    console.error('❌ Error en test sistema completo:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}