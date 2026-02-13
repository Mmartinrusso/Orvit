import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Cache en memoria para meses disponibles (TTL: 1 hora)
const monthsCache = new Map<string, { data: string[]; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const cacheKey = `months_${companyId}`;
    const cached = monthsCache.get(cacheKey);

    // Retornar cache si es válido
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
          'X-Cache': 'HIT'
        }
      });
    }

    // Query optimizada: UNION en lugar de 3 queries separadas
    const uniqueMonths = await prisma.$queryRaw<{ fecha_imputacion: string }[]>`
      SELECT DISTINCT fecha_imputacion FROM monthly_sales
      WHERE company_id = ${parseInt(companyId)} AND fecha_imputacion IS NOT NULL
      UNION
      SELECT DISTINCT fecha_imputacion FROM indirect_costs
      WHERE company_id = ${parseInt(companyId)} AND fecha_imputacion IS NOT NULL
      UNION
      SELECT DISTINCT fecha_imputacion FROM monthly_production
      WHERE company_id = ${parseInt(companyId)} AND fecha_imputacion IS NOT NULL
      ORDER BY fecha_imputacion DESC
    `;

    const months = uniqueMonths.map(m => m.fecha_imputacion).filter(Boolean);

    // Guardar en cache
    monthsCache.set(cacheKey, { data: months, timestamp: Date.now() });

    return NextResponse.json(months, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    console.error('Error fetching available months:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available months' },
      { status: 500 }
    );
  }
}

// Función para invalidar cache (llamar cuando se agreguen datos nuevos)
export function invalidateMonthsCache(companyId: string) {
  monthsCache.delete(`months_${companyId}`);
}
