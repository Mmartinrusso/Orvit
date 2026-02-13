// API Routes for FMEA (Failure Mode and Effects Analysis)
// GET /api/fmea - List failure modes
// POST /api/fmea - Create a new failure mode

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET - List failure modes
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || payload.companyId;
    const componentId = searchParams.get('componentId');
    const machineId = searchParams.get('machineId');
    const minRPN = searchParams.get('minRPN');
    const severity = searchParams.get('severity');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      companyId: Number(companyId),
    };

    if (componentId) {
      where.componentId = Number(componentId);
    }

    if (machineId) {
      where.machineId = Number(machineId);
    }

    if (minRPN) {
      where.rpn = { gte: Number(minRPN) };
    }

    if (severity) {
      where.severity = Number(severity);
    }

    const failureModes = await prisma.componentFailureMode.findMany({
      where,
      include: {
        component: {
          select: {
            id: true,
            name: true,
          },
        },
        machine: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { rpn: 'desc' },
        { severity: 'desc' },
      ],
    });

    // Calculate summary statistics
    const summary = {
      total: failureModes.length,
      highRisk: failureModes.filter(fm => fm.rpn >= 200).length,
      mediumRisk: failureModes.filter(fm => fm.rpn >= 100 && fm.rpn < 200).length,
      lowRisk: failureModes.filter(fm => fm.rpn < 100).length,
      avgRPN: failureModes.length > 0
        ? Math.round(failureModes.reduce((sum, fm) => sum + fm.rpn, 0) / failureModes.length)
        : 0,
      maxRPN: failureModes.length > 0
        ? Math.max(...failureModes.map(fm => fm.rpn))
        : 0,
    };

    return NextResponse.json({
      failureModes,
      summary,
    });
  } catch (error) {
    console.error('Error fetching FMEA:', error);
    return NextResponse.json({ error: 'Error al obtener modos de falla' }, { status: 500 });
  }
}

// POST - Create a new failure mode
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const {
      componentId,
      machineId,
      failureMode,
      failureEffect,
      failureCause,
      severity,
      occurrence,
      detectability,
      currentControls,
      recommendedActions,
      companyId,
    } = body;

    if (!failureMode) {
      return NextResponse.json({ error: 'Modo de falla es requerido' }, { status: 400 });
    }

    if (!componentId && !machineId) {
      return NextResponse.json({ error: 'Debe especificar componentId o machineId' }, { status: 400 });
    }

    // Validate severity, occurrence, detectability (1-10)
    const sev = Number(severity) || 5;
    const occ = Number(occurrence) || 5;
    const det = Number(detectability) || 5;

    if (sev < 1 || sev > 10 || occ < 1 || occ > 10 || det < 1 || det > 10) {
      return NextResponse.json({
        error: 'severity, occurrence y detectability deben estar entre 1 y 10'
      }, { status: 400 });
    }

    // Calculate RPN (Risk Priority Number)
    const rpn = sev * occ * det;

    const targetCompanyId = companyId || payload.companyId;

    const failureModeRecord = await prisma.componentFailureMode.create({
      data: {
        componentId: componentId ? Number(componentId) : null,
        machineId: machineId ? Number(machineId) : null,
        failureMode,
        failureEffect,
        failureCause,
        severity: sev,
        occurrence: occ,
        detectability: det,
        rpn,
        currentControls,
        recommendedActions,
        companyId: Number(targetCompanyId),
      },
      include: {
        component: {
          select: { id: true, name: true },
        },
        machine: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(failureModeRecord, { status: 201 });
  } catch (error) {
    console.error('Error creating failure mode:', error);
    return NextResponse.json({ error: 'Error al crear modo de falla' }, { status: 500 });
  }
}
