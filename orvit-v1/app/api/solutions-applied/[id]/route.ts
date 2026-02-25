/**
 * GET /api/solutions-applied/[id]  — Detalle de una solución
 * PATCH /api/solutions-applied/[id] — Editar campos de una solución
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// GET /api/solutions-applied/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuth();
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const id = parseInt(params.id);
    if (isNaN(id) || id <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const solution = await prisma.solutionApplied.findUnique({
      where: { id },
      include: {
        performedBy: { select: { id: true, name: true } },
        failureOccurrence: {
          select: {
            id: true,
            title: true,
            machineId: true,
            reportedAt: true,
            machine: { select: { id: true, name: true } },
            component: { select: { id: true, name: true } },
            subComponent: { select: { id: true, name: true } },
          }
        },
        workOrder: { select: { id: true, title: true, status: true, completedDate: true } },
      }
    });

    if (!solution) {
      return NextResponse.json({ error: 'Solución no encontrada' }, { status: 404 });
    }

    if (solution.companyId !== (payload.companyId as number)) {
      return NextResponse.json({ error: 'No autorizado para esta solución' }, { status: 403 });
    }

    return NextResponse.json({ success: true, solution });
  } catch (error) {
    console.error('❌ Error en GET /api/solutions-applied/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PATCH /api/solutions-applied/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuth();
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const id = parseInt(params.id);
    if (isNaN(id) || id <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que existe y pertenece a la empresa
    const existing = await prisma.solutionApplied.findUnique({
      where: { id },
      select: { id: true, companyId: true }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Solución no encontrada' }, { status: 404 });
    }

    if (existing.companyId !== companyId) {
      return NextResponse.json({ error: 'No autorizado para esta solución' }, { status: 403 });
    }

    const body = await request.json();

    // Campos editables (solo los que vienen en el body)
    const data: Record<string, any> = {};

    if (body.diagnosis !== undefined) data.diagnosis = body.diagnosis;
    if (body.solution !== undefined) data.solution = body.solution;
    if (body.confirmedCause !== undefined) data.confirmedCause = body.confirmedCause || null;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.outcome !== undefined) data.outcome = body.outcome;
    if (body.effectiveness !== undefined) data.effectiveness = body.effectiveness ? parseInt(body.effectiveness) : null;
    if (body.fixType !== undefined) data.fixType = body.fixType;
    if (body.toolsUsed !== undefined) data.toolsUsed = body.toolsUsed;
    if (body.sparePartsUsed !== undefined) data.sparePartsUsed = body.sparePartsUsed;
    if (body.attachments !== undefined) data.attachments = body.attachments;
    if (body.actualMinutes !== undefined) data.actualMinutes = body.actualMinutes ? parseInt(body.actualMinutes) : null;
    if (body.finalComponentId !== undefined) data.finalComponentId = body.finalComponentId ? parseInt(body.finalComponentId) : null;
    if (body.finalSubcomponentId !== undefined) data.finalSubcomponentId = body.finalSubcomponentId ? parseInt(body.finalSubcomponentId) : null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron campos para actualizar' }, { status: 400 });
    }

    const updated = await prisma.solutionApplied.update({
      where: { id },
      data,
      include: {
        performedBy: { select: { id: true, name: true } },
        failureOccurrence: {
          select: {
            id: true,
            title: true,
            machineId: true,
            machine: { select: { id: true, name: true } },
          }
        },
      }
    });

    console.log(`✅ Solución ${id} actualizada por usuario ${payload.userId}`);

    return NextResponse.json({
      success: true,
      message: 'Solución actualizada correctamente',
      solution: updated
    });

  } catch (error) {
    console.error('❌ Error en PATCH /api/solutions-applied/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
