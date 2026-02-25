/**
 * POST /api/maintenance/preventive/reschedule-overdue
 *
 * Reprograma todas las instancias preventivas vencidas (OVERDUE o PENDING con fecha pasada)
 * al día de hoy, cambiando su estado a PENDING.
 *
 * Body: { companyId: number }
 * Response: { rescheduled: number, message: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Auth
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const payload = await verifyToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    // Company boundary check
    const tokenCompanyId = payload.companyId as number | undefined;
    if (tokenCompanyId && Number(companyId) !== tokenCompanyId) {
      return NextResponse.json({ error: 'No autorizado para esta empresa' }, { status: 403 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Reprogramar instancias OVERDUE o PENDING con fecha pasada, para templates activos de esta empresa
    const result = await prisma.preventiveInstance.updateMany({
      where: {
        status: { in: ['OVERDUE', 'PENDING'] },
        scheduledDate: { lt: today },
        template: {
          companyId: Number(companyId),
          isActive: true,
        },
      },
      data: {
        scheduledDate: today,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      rescheduled: result.count,
      message: result.count === 0
        ? 'No hay instancias vencidas para reprogramar'
        : `${result.count} instancia${result.count !== 1 ? 's' : ''} reprogramada${result.count !== 1 ? 's' : ''} para hoy`,
    });
  } catch (error: any) {
    console.error('Error en reschedule-overdue:', error);
    return NextResponse.json(
      { error: error.message || 'Error al reprogramar instancias' },
      { status: 500 }
    );
  }
}
