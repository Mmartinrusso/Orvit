/**
 * API: /api/maintenance/controls/pending
 *
 * GET - Controles de seguimiento pendientes (para widgets de dashboard)
 *       Filtrable por userId (operador) o sectorId (supervisor)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') ? parseInt(searchParams.get('userId')!) : undefined;
    const sectorId = searchParams.get('sectorId') ? parseInt(searchParams.get('sectorId')!) : undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const where: any = {
      companyId,
      status: { in: ['PENDING', 'NOTIFIED', 'OVERDUE'] },
    };

    // Filter by user (operator view) or sector (supervisor view)
    if (userId) {
      where.solutionApplied = { performedById: userId };
    } else if (sectorId) {
      where.solutionApplied = {
        failureOccurrence: { machine: { sectorId } },
      };
    }

    const [controls, summary] = await Promise.all([
      prisma.solutionControlInstance.findMany({
        where,
        include: {
          solutionApplied: {
            select: {
              id: true,
              diagnosis: true,
              solution: true,
              performedBy: { select: { id: true, name: true } },
              failureOccurrence: {
                select: {
                  id: true,
                  title: true,
                  machine: { select: { id: true, name: true } },
                },
              },
            },
          },
          completedBy: { select: { id: true, name: true } },
        },
        orderBy: [
          { status: 'asc' }, // OVERDUE first
          { scheduledAt: 'asc' },
        ],
        take: limit,
      }),
      // Summary counts
      prisma.solutionControlInstance.groupBy({
        by: ['status'],
        where: {
          companyId,
          ...(userId ? { solutionApplied: { performedById: userId } } : {}),
          ...(sectorId && !userId ? { solutionApplied: { failureOccurrence: { machine: { sectorId } } } } : {}),
        },
        _count: true,
      }),
    ]);

    // Build summary
    const summaryMap: Record<string, number> = {};
    for (const g of summary) {
      summaryMap[g.status] = g._count;
    }

    return NextResponse.json({
      controls: controls.map(c => ({
        id: c.id,
        order: c.order,
        description: c.description,
        delayMinutes: c.delayMinutes,
        scheduledAt: c.scheduledAt,
        status: c.status,
        notifiedAt: c.notifiedAt,
        completedAt: c.completedAt,
        outcome: c.outcome,
        notes: c.notes,
        requiresFollowup: c.requiresFollowup,
        completedBy: c.completedBy,
        solutionApplied: c.solutionApplied ? {
          id: c.solutionApplied.id,
          diagnosis: c.solutionApplied.diagnosis?.substring(0, 100),
          machineName: c.solutionApplied.failureOccurrence?.machine?.name,
          failureTitle: c.solutionApplied.failureOccurrence?.title,
          performedBy: c.solutionApplied.performedBy,
        } : null,
      })),
      summary: {
        total: Object.values(summaryMap).reduce((s, v) => s + v, 0),
        pending: (summaryMap['PENDING'] || 0) + (summaryMap['NOTIFIED'] || 0),
        overdue: summaryMap['OVERDUE'] || 0,
        completed: summaryMap['COMPLETED'] || 0,
      },
    });
  } catch (error: any) {
    console.error('Error en GET /api/maintenance/controls/pending:', error.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
