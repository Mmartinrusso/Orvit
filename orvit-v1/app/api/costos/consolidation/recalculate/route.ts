import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { recalculateConsolidation } from '@/lib/costs/consolidation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/costos/consolidation/recalculate
 *
 * Recalcula y guarda el snapshot de consolidación (operación pesada).
 *
 * Body:
 * {
 *   month: "2026-01",
 *   force?: boolean  // Para recalcular períodos cerrados
 * }
 */
export async function POST(request: NextRequest) {
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
    const userId = payload.userId as number;

    // Verificar permisos (solo admin puede recalcular)
    const userRole = (payload.role as string)?.toUpperCase();
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Solo administradores pueden recalcular la consolidación' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { month, force = false } = body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Parámetro month requerido en formato YYYY-MM' },
        { status: 400 }
      );
    }

    // Recalcular consolidación
    const result = await recalculateConsolidation(companyId, month, userId, force);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Consolidación recalculada exitosamente',
      ...result.snapshot
    });

  } catch (error) {
    console.error('Error recalculando consolidación:', error);
    return NextResponse.json(
      { error: 'Error al recalcular consolidación' },
      { status: 500 }
    );
  }
}
