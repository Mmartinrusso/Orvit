/**
 * GET /api/solutions-applied/[id]/controls
 * Devuelve todos los controles de seguimiento de una solución aplicada
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const solutionAppliedId = parseInt(params.id);
    if (isNaN(solutionAppliedId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verify solution belongs to company
    const solution = await prisma.solutionApplied.findFirst({
      where: { id: solutionAppliedId, companyId: payload.companyId as number },
      select: { id: true },
    });
    if (!solution) {
      return NextResponse.json({ error: 'Solución no encontrada' }, { status: 404 });
    }

    const controls = await prisma.solutionControlInstance.findMany({
      where: { solutionAppliedId },
      orderBy: { order: 'asc' },
      include: {
        completedBy: { select: { id: true, name: true } },
      },
    });

    const total = controls.length;
    const completed = controls.filter(c => c.status === 'COMPLETED').length;
    const pending = controls.filter(c => c.status === 'PENDING' || c.status === 'NOTIFIED').length;
    const overdue = controls.filter(c => c.status === 'OVERDUE').length;

    return NextResponse.json({
      controls,
      summary: { total, completed, pending, overdue },
    });
  } catch (error: any) {
    console.error('[GET /solutions-applied/[id]/controls]', error);
    return NextResponse.json({ error: 'Error al obtener controles' }, { status: 500 });
  }
}
