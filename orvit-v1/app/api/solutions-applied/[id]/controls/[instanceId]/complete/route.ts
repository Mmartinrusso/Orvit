/**
 * POST /api/solutions-applied/[id]/controls/[instanceId]/complete
 * Completa un control de seguimiento y desbloquea el siguiente
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
    if (!payload?.companyId || !payload?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const solutionAppliedId = parseInt(params.id);
    const instanceId = parseInt(params.instanceId);
    if (isNaN(solutionAppliedId) || isNaN(instanceId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { outcome, notes, photos, requiresFollowup } = body;

    if (!outcome || !['OK', 'NOK', 'PARCIAL'].includes(outcome)) {
      return NextResponse.json(
        { error: 'outcome requerido: OK | NOK | PARCIAL' },
        { status: 400 }
      );
    }

    // Verify instance belongs to this solution and company
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

    const completedAt = new Date();

    // Update current instance as completed
    const updated = await prisma.solutionControlInstance.update({
      where: { id: instanceId },
      data: {
        status: 'COMPLETED',
        completedAt,
        completedById: payload.id as number,
        outcome,
        notes: notes || null,
        photos: photos || null,
        requiresFollowup: requiresFollowup ?? false,
      },
      include: {
        completedBy: { select: { id: true, name: true } },
      },
    });

    // Unlock the next WAITING control
    const nextControl = await prisma.solutionControlInstance.findFirst({
      where: {
        solutionAppliedId,
        order: instance.order + 1,
        status: 'WAITING',
      },
    });

    let unlockedControl = null;
    if (nextControl) {
      const scheduledAt = new Date(completedAt.getTime() + nextControl.delayMinutes * 60 * 1000);
      unlockedControl = await prisma.solutionControlInstance.update({
        where: { id: nextControl.id },
        data: { scheduledAt, status: 'PENDING' },
      });
    }

    return NextResponse.json({ control: updated, nextControl: unlockedControl });
  } catch (error: any) {
    console.error('[POST /controls/[instanceId]/complete]', error);
    return NextResponse.json({ error: 'Error al completar control' }, { status: 500 });
  }
}
