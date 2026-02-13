import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getConsolidationSnapshot } from '@/lib/costs/consolidation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/costos/consolidation?month=2026-01
 *
 * Lee el snapshot de consolidación guardado (operación rápida).
 * Patrón SNAPSHOT: GET lee de DB, POST recalcula.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;

    // Obtener mes de query params
    const month = request.nextUrl.searchParams.get('month');
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Parámetro month requerido en formato YYYY-MM' },
        { status: 400 }
      );
    }

    // Leer snapshot
    const snapshot = await getConsolidationSnapshot(companyId, month);

    if (!snapshot.exists) {
      return NextResponse.json({
        success: true,
        month,
        exists: false,
        message: 'No hay consolidación para este mes. Ejecutar recálculo con POST.'
      });
    }

    return NextResponse.json({
      success: true,
      ...snapshot
    });

  } catch (error) {
    console.error('Error obteniendo consolidación:', error);
    return NextResponse.json(
      { error: 'Error al obtener consolidación' },
      { status: 500 }
    );
  }
}
