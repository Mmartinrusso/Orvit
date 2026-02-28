/**
 * POST /api/solutions-applied/[id]/controls/[instanceId]/skip
 * Salta un control de seguimiento y desbloquea el siguiente
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; instanceId: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const solutionAppliedId = parseInt(params.id);
    const instanceId = parseInt(params.instanceId);
    if (isNaN(solutionAppliedId) || isNaN(instanceId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const instance = await prisma.solutionControlInstance.findFirst({
      where: {
        id: instanceId,
        solutionAppliedId,
        companyId: payload.companyId as number,
      },
    });
    if (!instance) {
      return NextResponse.json({ error: 'Control no encontrado' }, { status: 404 });
    }
    if (instance.status === 'COMPLETED' || instance.status === 'SKIPPED') {
      return NextResponse.json({ error: 'Control ya procesado' }, { status: 409 });
    }

    const skippedAt = new Date();

    // Mark as skipped
    const updated = await prisma.solutionControlInstance.update({
      where: { id: instanceId },
      data: { status: 'SKIPPED', completedAt: skippedAt },
    });

    // Unlock next control counting from now
    const nextControl = await prisma.solutionControlInstance.findFirst({
      where: {
        solutionAppliedId,
        order: instance.order + 1,
        status: 'WAITING',
      },
    });

    let unlockedControl = null;
    if (nextControl) {
      const scheduledAt = new Date(skippedAt.getTime() + nextControl.delayMinutes * 60 * 1000);
      unlockedControl = await prisma.solutionControlInstance.update({
        where: { id: nextControl.id },
        data: { scheduledAt, status: 'PENDING' },
      });
    }

    return NextResponse.json({ control: updated, nextControl: unlockedControl });
  } catch (error: any) {
    console.error('[POST /controls/[instanceId]/skip]', error);
    return NextResponse.json({ error: 'Error al saltar control' }, { status: 500 });
  }
}
