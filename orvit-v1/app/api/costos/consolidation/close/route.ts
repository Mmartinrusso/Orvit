import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { closePeriod, reopenPeriod } from '@/lib/costs/consolidation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/costos/consolidation/close
 *
 * Cierra un período (evita recálculos accidentales).
 *
 * Body: { month: "2026-01" }
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

    // Verificar permisos
    const userRole = (payload.role as string)?.toUpperCase();
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Solo administradores pueden cerrar períodos' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { month } = body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Parámetro month requerido en formato YYYY-MM' },
        { status: 400 }
      );
    }

    const result = await closePeriod(companyId, month);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Período ${month} cerrado exitosamente`
    });

  } catch (error) {
    console.error('Error cerrando período:', error);
    return NextResponse.json(
      { error: 'Error al cerrar período' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/costos/consolidation/close
 *
 * Reabre un período (permite recálculos).
 *
 * Body: { month: "2026-01" }
 */
export async function DELETE(request: NextRequest) {
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

    // Verificar permisos
    const userRole = (payload.role as string)?.toUpperCase();
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Solo administradores pueden reabrir períodos' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { month } = body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Parámetro month requerido en formato YYYY-MM' },
        { status: 400 }
      );
    }

    const result = await reopenPeriod(companyId, month);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Período ${month} reabierto exitosamente`
    });

  } catch (error) {
    console.error('Error reabriendo período:', error);
    return NextResponse.json(
      { error: 'Error al reabrir período' },
      { status: 500 }
    );
  }
}
