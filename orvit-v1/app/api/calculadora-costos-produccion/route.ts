import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.DASHBOARD_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const companyId = String(user!.companyId);
    const productionMonth = searchParams.get('productionMonth') || '2025-08';

    try {
        console.log('🏭 Calculadora por Producción - Iniciando cálculo para mes:', productionMonth);
        console.log('🏢 Company ID:', companyId);

        // 1. Obtener productos básicos
        const products = await prisma.product.findMany({
            where: {
                companyId: parseInt(companyId)
            },
            include: {
                category: true
            }
        });

        console.log('📦 Productos encontrados:', products.length);

        // 2. Simular datos de producción basados en el sistema existente
        // (Hasta que se resuelvan los problemas de conexión con monthly_production)
        const productPrices = products.map((product: any) => {
            // Generar producción simulada pero consistente
            const seed = product.id * 17;
            const baseProduction = 100 + (seed % 500);
            
            // Costos simulados
            const materialsCost = 50 + (seed % 100);
            const indirectCost = 15 + (seed % 30);
            const employeeCost = 10 + (seed % 20);
            const totalCost = materialsCost + indirectCost + employeeCost;

            return {
                id: product.id,
                product_name: product.name,
                product_description: product.description,
                sku: product.sku,
                current_price: parseFloat(product.current_price || 0),
                current_cost: parseFloat(product.current_cost || 0),
                stock_quantity: parseInt(product.stock_quantity || 0),
                category_name: product.category?.name || 'Sin categoría',
                category_id: product.category?.id || null,
                recipe_id: null,
                recipe_name: null,
                output_quantity: 1,
                output_unit_label: null,
                intermediate_quantity: 1,
                intermediate_unit_label: null,
                base_type: null,
                calculated_cost: totalCost,
                calculated_price: totalCost * 1.3,
                units_per_item: 1,
                cost_breakdown: {
                    materials: materialsCost,
                    indirect_costs: indirectCost,
                    employee_costs: employeeCost,
                    total: totalCost
                },
                recipe_details: [],
                production_info: {
                    source: 'simulated_consistent',
                    quantity_produced: baseProduction,
                    production_month: productionMonth,
                    production_date: `${productionMonth}-01`,
                    distributed_indirect_costs: indirectCost * baseProduction,
                    distributed_employee_costs: employeeCost * baseProduction,
                    has_production_data: true,
                    note: 'Datos simulados - conectar con monthly_production cuando esté disponible'
                }
            };
        });

        // 3. Estadísticas
        const totalProducedUnits = productPrices.reduce((sum, p) => sum + p.production_info.quantity_produced, 0);
        const productsWithProduction = productPrices.filter(p => p.production_info.quantity_produced > 0).length;

        const debug_info = {
            calculation_method: 'production_based_simulated',
            production_month: productionMonth,
            total_products: products.length,
            products_with_production: productsWithProduction,
            total_produced_units: totalProducedUnits,
            total_indirect_costs: productPrices.reduce((sum, p) => sum + p.cost_breakdown.indirect_costs, 0),
            total_employee_costs: productPrices.reduce((sum, p) => sum + p.cost_breakdown.employee_costs, 0),
            products_with_recipes: 0, // No hay relación directa con Recipe en el modelo Product
            distribution_method: 'simulated_proportional',
            note: 'Usando datos simulados consistentes - listo para conectar con datos reales'
        };

        console.log('✅ Cálculo por producción completado (simulado)');
        console.log('📊 Debug info:', debug_info);

        return NextResponse.json({
            success: true,
            productPrices: productPrices,
            debug_info: debug_info
        });

    } catch (error) {
        console.error('❌ Error en calculadora por producción:', error);
        return NextResponse.json(
            { error: 'Error calculating production costs', details: error instanceof Error ? error.message : 'Error desconocido' },
            { status: 500 }
        );
    }
}