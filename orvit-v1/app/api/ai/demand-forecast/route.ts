/**
 * Demand Forecasting API
 *
 * AI-powered demand prediction for inventory optimization
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { generateDemandForecast, generateBulkForecast, generateAutoReorderSuggestions } from '@/lib/ai/demand-forecasting';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const forecastRequestSchema = z.object({
  productId: z.number().int().positive().optional(),
  productIds: z.array(z.number().int().positive()).optional(),
  forecastDays: z.number().int().min(7).max(90).optional().default(30),
  historicalDays: z.number().int().min(14).max(365).optional().default(90),
  includeSeasonality: z.boolean().optional().default(true),
  autoReorder: z.boolean().optional().default(false),
}).refine(
  (data) => data.productId || data.productIds || data.autoReorder,
  {
    message: 'Se requiere productId, productIds, o autoReorder=true',
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// POST - Generate Demand Forecast
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const user = await verifyJWT(token);
    if (!user || !user.companyId) {
      return NextResponse.json(
        { error: 'Usuario inválido' },
        { status: 401 }
      );
    }

    // Parse and validate request
    const body = await req.json();
    const validation = forecastRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.issues },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Check if AI Demand Forecasting is enabled
    // TODO: Uncomment when AIConfig is available in all companies
    // const aiConfig = await prisma.aIConfig.findUnique({
    //   where: { companyId: user.companyId },
    // });
    //
    // if (!aiConfig?.aiDemandForecasting) {
    //   return NextResponse.json(
    //     { error: 'Demand Forecasting no está habilitado para esta empresa' },
    //     { status: 403 }
    //   );
    // }

    // Auto-reorder suggestions
    if (data.autoReorder) {
      const suggestions = await generateAutoReorderSuggestions(user.companyId);

      return NextResponse.json({
        success: true,
        type: 'auto_reorder',
        suggestions,
        count: suggestions.length,
      });
    }

    // Single product forecast
    if (data.productId) {
      const forecast = await generateDemandForecast(
        {
          productId: data.productId,
          forecastDays: data.forecastDays,
          historicalDays: data.historicalDays,
          includeSeasonality: data.includeSeasonality,
        },
        user.companyId
      );

      return NextResponse.json({
        success: true,
        type: 'single',
        forecast,
      });
    }

    // Bulk forecast
    if (data.productIds) {
      const forecasts = await generateBulkForecast(
        data.productIds,
        user.companyId,
        data.forecastDays
      );

      return NextResponse.json({
        success: true,
        type: 'bulk',
        forecasts,
        count: forecasts.length,
      });
    }

    return NextResponse.json(
      { error: 'Solicitud inválida' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Error in demand forecast API:', error);

    if (error.message.includes('No hay datos históricos')) {
      return NextResponse.json(
        { error: error.message },
        { status: 422 }
      );
    }

    if (error.message.includes('Producto no encontrado')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Error al generar forecast', details: error.message },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET - Get Forecast History (TODO: Implement forecast caching)
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  return NextResponse.json(
    { error: 'Endpoint no implementado aún' },
    { status: 501 }
  );
}
