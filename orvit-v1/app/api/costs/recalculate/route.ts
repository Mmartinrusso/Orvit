import { NextRequest, NextResponse } from 'next/server';
import { RecalculateCostsSchema } from '@/lib/validations/costs';
import { recalculateMonthCosts } from '@/lib/costs/calculator';
import { withGuards } from '@/lib/middleware/withGuards';
import { validateRequest } from '@/lib/validations/helpers';
import { invalidateCache } from '@/lib/cache/cache-manager';
import { invalidationPatterns } from '@/lib/cache/cache-keys';

export const dynamic = 'force-dynamic';


// POST /api/costs/recalculate - Recalculate costs for a specific month
export const POST = withGuards(async (request: NextRequest, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const companyId = searchParams.get('companyId');

    if (!month) {
      return NextResponse.json(
        { error: 'Parámetro month requerido (formato: YYYY-MM)' },
        { status: 400 }
      );
    }

    const validation = validateRequest(RecalculateCostsSchema, { month });
    if (!validation.success) return validation.response;

    // Start recalculation process
    const companyFilter = companyId ? parseInt(companyId) : user.companyId;
    console.log(`Starting cost recalculation for month: ${month} (company: ${companyFilter}, user: ${user.userId})`);

    await recalculateMonthCosts(validation.data.month, companyFilter);

    // Invalidar cache de productos y cost-products después de recalcular
    await invalidateCache(invalidationPatterns.costRecalculate(companyFilter));

    console.log(`Cost recalculation completed for month: ${month} (company: ${companyFilter})`);

    return NextResponse.json({
      message: 'Recálculo de costos completado exitosamente',
      month: validation.data.month,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error recalculating costs:', error);
    return NextResponse.json(
      {
        error: 'Error al recalcular costos',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}, { rateLimitOverride: 10 });
