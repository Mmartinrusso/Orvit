import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const productionMonth = searchParams.get('productionMonth') || '2025-08';

    if (!companyId) {
        return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    try {
        console.log('🏭 Test Producción Simple - Iniciando para mes:', productionMonth);

        // Datos simulados simples
        const mockProducts = [
            {
                id: 1,
                product_name: 'Producto Test 1',
                sku: 'TEST001',
                category_name: 'Categoría Test',
                quantity_produced: 1000,
                calculated_cost: 150.50,
                cost_breakdown: {
                    materials: 100,
                    indirect_costs: 25.25,
                    employee_costs: 25.25,
                    total: 150.50
                },
                production_info: {
                    source: 'simulated',
                    quantity_produced: 1000,
                    production_month: productionMonth
                }
            },
            {
                id: 2,
                product_name: 'Producto Test 2',
                sku: 'TEST002',
                category_name: 'Categoría Test',
                quantity_produced: 800,
                calculated_cost: 200.75,
                cost_breakdown: {
                    materials: 150,
                    indirect_costs: 25.375,
                    employee_costs: 25.375,
                    total: 200.75
                },
                production_info: {
                    source: 'simulated',
                    quantity_produced: 800,
                    production_month: productionMonth
                }
            }
        ];

        const debug_info = {
            calculation_method: 'production_based_test',
            production_month: productionMonth,
            total_products: mockProducts.length,
            products_with_production: mockProducts.length,
            total_produced_units: mockProducts.reduce((sum, p) => sum + p.quantity_produced, 0),
            note: 'Datos de prueba simulados'
        };

        console.log('✅ Test completado exitosamente');

        return NextResponse.json({
            success: true,
            productPrices: mockProducts,
            debug_info: debug_info
        });

    } catch (error) {
        console.error('❌ Error en test producción:', error);
        return NextResponse.json(
            { error: 'Error in production test', details: error.message },
            { status: 500 }
        );
    }
}