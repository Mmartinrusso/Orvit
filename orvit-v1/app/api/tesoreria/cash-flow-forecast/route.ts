/**
 * Cash Flow Forecast API
 *
 * GET: Generate AI-powered cash flow forecast
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { generateCashFlowForecast, type ForecastAssumptions, DEFAULT_ASSUMPTIONS } from '@/lib/tesoreria/cash-flow-forecaster';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.POSICION_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    // Validate days parameter
    if (days < 7 || days > 90) {
      return NextResponse.json(
        { error: 'El parámetro days debe estar entre 7 y 90' },
        { status: 400 }
      );
    }

    // Parse optional assumption parameters
    const assumptions: ForecastAssumptions = {
      cobranzaPct: clampNumber(parseFloat(searchParams.get('cobranzaPct') || ''), 0, 100, DEFAULT_ASSUMPTIONS.cobranzaPct),
      diasRetraso: clampNumber(parseInt(searchParams.get('diasRetraso') || ''), 0, 60, DEFAULT_ASSUMPTIONS.diasRetraso),
      margenSeguridad: clampNumber(parseFloat(searchParams.get('margenSeguridad') || ''), 0, 50, DEFAULT_ASSUMPTIONS.margenSeguridad),
    };

    const forecast = await generateCashFlowForecast(user!.companyId, days, assumptions);

    // Add cache headers (5 minute cache)
    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');

    return NextResponse.json(forecast, { headers });
  } catch (err) {
    console.error('Error generating cash flow forecast:', err);
    return NextResponse.json(
      { error: 'Error al generar proyección de flujo de caja' },
      { status: 500 }
    );
  }
}

/** Clamp a numeric value within [min, max], returning defaultVal if NaN */
function clampNumber(value: number, min: number, max: number, defaultVal: number): number {
  if (isNaN(value)) return defaultVal;
  return Math.min(max, Math.max(min, value));
}
