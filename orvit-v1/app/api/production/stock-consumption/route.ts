import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import {
  calculateMaterialRequirements,
  checkStockAvailability,
  consumeStockForProduction,
  reverseStockConsumption,
  getProductionConsumptionSummary,
} from '@/lib/production/stock-consumption';

/**
 * GET /api/production/stock-consumption
 *
 * Get material requirements or consumption summary for a production order
 *
 * Query params:
 * - productionOrderId: number (required)
 * - action: 'requirements' | 'summary' (default: requirements)
 * - warehouseId: number (optional, for checking availability)
 * - quantity: number (optional, for calculating specific quantity)
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.PARTES.VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);

    const productionOrderId = Number(searchParams.get('productionOrderId'));
    if (!productionOrderId || isNaN(productionOrderId)) {
      return NextResponse.json(
        { error: 'productionOrderId es requerido' },
        { status: 400 }
      );
    }

    const action = searchParams.get('action') || 'requirements';
    const warehouseId = searchParams.get('warehouseId')
      ? Number(searchParams.get('warehouseId'))
      : null;
    const quantity = searchParams.get('quantity')
      ? Number(searchParams.get('quantity'))
      : undefined;

    // Get the production order to get companyId
    const order = await prisma.productionOrder.findUnique({
      where: { id: productionOrderId },
      select: { companyId: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Orden de producción no encontrada' },
        { status: 404 }
      );
    }

    if (action === 'summary') {
      // Return consumption summary
      const summary = await getProductionConsumptionSummary(productionOrderId);
      return NextResponse.json({ summary });
    }

    // Calculate material requirements
    let requirements = await calculateMaterialRequirements(
      productionOrderId,
      quantity
    );

    // Check availability if warehouse specified
    if (warehouseId) {
      requirements = await checkStockAvailability(
        requirements,
        warehouseId,
        order.companyId
      );
    }

    return NextResponse.json({ requirements });
  } catch (error) {
    console.error('Error en GET /api/production/stock-consumption:', error);
    return NextResponse.json(
      { error: 'Error al obtener requerimientos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/production/stock-consumption
 *
 * Consume stock for a daily production report
 *
 * Body:
 * - dailyReportId: number (required)
 * - warehouseId: number (required)
 * - userId: number (required)
 * - allowNegative: boolean (optional, default: false)
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.PARTES.CREATE);
    if (error) return error;

    const body = await request.json();
    const { dailyReportId, warehouseId, userId, allowNegative } = body;

    if (!dailyReportId || !warehouseId || !userId) {
      return NextResponse.json(
        { error: 'dailyReportId, warehouseId y userId son requeridos' },
        { status: 400 }
      );
    }

    const result = await consumeStockForProduction(
      Number(dailyReportId),
      Number(warehouseId),
      Number(userId),
      allowNegative ?? false
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.errors.join(', '), warnings: result.warnings },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      movements: result.movements,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('Error en POST /api/production/stock-consumption:', error);
    return NextResponse.json(
      { error: 'Error al consumir stock' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/production/stock-consumption
 *
 * Reverse stock consumption for a daily production report
 *
 * Body:
 * - dailyReportId: number (required)
 * - userId: number (required)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { dailyReportId, userId } = body;

    if (!dailyReportId || !userId) {
      return NextResponse.json(
        { error: 'dailyReportId y userId son requeridos' },
        { status: 400 }
      );
    }

    const result = await reverseStockConsumption(
      Number(dailyReportId),
      Number(userId)
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error en DELETE /api/production/stock-consumption:', error);
    return NextResponse.json(
      { error: 'Error al revertir consumo' },
      { status: 500 }
    );
  }
}
