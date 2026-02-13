// API Routes for Individual FMEA Operations
// GET /api/fmea/[id] - Get failure mode details
// PATCH /api/fmea/[id] - Update a failure mode
// DELETE /api/fmea/[id] - Delete a failure mode

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get failure mode details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const failureMode = await prisma.componentFailureMode.findUnique({
      where: { id: Number(id) },
      include: {
        component: {
          select: {
            id: true,
            name: true,
            machine: {
              select: { id: true, name: true },
            },
          },
        },
        machine: {
          select: { id: true, name: true },
        },
      },
    });

    if (!failureMode) {
      return NextResponse.json({ error: 'Modo de falla no encontrado' }, { status: 404 });
    }

    // Verify company access
    if (failureMode.companyId !== payload.companyId && payload.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    return NextResponse.json(failureMode);
  } catch (error) {
    console.error('Error fetching failure mode:', error);
    return NextResponse.json({ error: 'Error al obtener modo de falla' }, { status: 500 });
  }
}

// PATCH - Update a failure mode
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const existing = await prisma.componentFailureMode.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Modo de falla no encontrado' }, { status: 404 });
    }

    // Verify company access
    if (existing.companyId !== payload.companyId && payload.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    const body = await request.json();
    const {
      failureMode,
      failureEffect,
      failureCause,
      severity,
      occurrence,
      detectability,
      currentControls,
      recommendedActions,
      actionsTaken,
      actionsTakenDate,
      responsibleId,
      status,
    } = body;

    // Calculate new values or use existing
    const sev = severity !== undefined ? Number(severity) : existing.severity;
    const occ = occurrence !== undefined ? Number(occurrence) : existing.occurrence;
    const det = detectability !== undefined ? Number(detectability) : existing.detectability;

    // Validate ranges
    if (sev < 1 || sev > 10 || occ < 1 || occ > 10 || det < 1 || det > 10) {
      return NextResponse.json({
        error: 'severity, occurrence y detectability deben estar entre 1 y 10'
      }, { status: 400 });
    }

    // Recalculate RPN
    const rpn = sev * occ * det;

    const updated = await prisma.componentFailureMode.update({
      where: { id: Number(id) },
      data: {
        ...(failureMode !== undefined && { failureMode }),
        ...(failureEffect !== undefined && { failureEffect }),
        ...(failureCause !== undefined && { failureCause }),
        severity: sev,
        occurrence: occ,
        detectability: det,
        rpn,
        ...(currentControls !== undefined && { currentControls }),
        ...(recommendedActions !== undefined && { recommendedActions }),
        ...(actionsTaken !== undefined && { actionsTaken }),
        ...(actionsTakenDate !== undefined && { actionsTakenDate: actionsTakenDate ? new Date(actionsTakenDate) : null }),
        ...(responsibleId !== undefined && { responsibleId: responsibleId ? Number(responsibleId) : null }),
        ...(status !== undefined && { status }),
      },
      include: {
        component: { select: { id: true, name: true } },
        machine: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating failure mode:', error);
    return NextResponse.json({ error: 'Error al actualizar modo de falla' }, { status: 500 });
  }
}

// DELETE - Delete a failure mode
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const existing = await prisma.componentFailureMode.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Modo de falla no encontrado' }, { status: 404 });
    }

    // Verify company access
    if (existing.companyId !== payload.companyId && payload.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    await prisma.componentFailureMode.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true, message: 'Modo de falla eliminado' });
  } catch (error) {
    console.error('Error deleting failure mode:', error);
    return NextResponse.json({ error: 'Error al eliminar modo de falla' }, { status: 500 });
  }
}
