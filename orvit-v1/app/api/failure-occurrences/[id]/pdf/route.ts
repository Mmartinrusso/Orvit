/**
 * API: /api/failure-occurrences/[id]/pdf
 *
 * GET - Generar PDF de informe de falla correctiva
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/failure-occurrences/[id]/pdf
 * Genera PDF de informe de falla
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verificar autenticación
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
    const occurrenceId = parseInt(params.id);

    if (isNaN(occurrenceId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Obtener datos completos de la falla
    const occurrence = await prisma.failureOccurrence.findUnique({
      where: { id: occurrenceId },
      include: {
        machine: {
          select: { id: true, name: true, assetCode: true, position: true }
        },
        component: {
          select: { id: true, name: true }
        },
        subcomponent: {
          select: { id: true, name: true }
        },
        reporter: {
          select: { id: true, name: true, email: true }
        },
        workOrder: {
          include: {
            assignedTo: {
              select: { id: true, name: true }
            },
            closedBy: {
              select: { id: true, name: true }
            },
            qualityAssurance: {
              include: {
                verifiedBy: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        },
        solutionsApplied: {
          include: {
            performedBy: {
              select: { id: true, name: true }
            }
          },
          orderBy: { performedAt: 'desc' }
        },
        downtimeLogs: {
          include: {
            returnedBy: {
              select: { id: true, name: true }
            }
          },
          orderBy: { startedAt: 'desc' }
        }
      }
    });

    if (!occurrence || occurrence.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // 3. Obtener work logs si hay OT
    let workLogs: any[] = [];
    if (occurrence.workOrder) {
      workLogs = await prisma.workLog.findMany({
        where: { workOrderId: occurrence.workOrder.id },
        include: {
          performedBy: {
            select: { id: true, name: true }
          }
        },
        orderBy: { startedAt: 'desc' }
      });
    }

    // 4. Calcular totales
    const totalDowntimeMinutes = occurrence.downtimeLogs.reduce(
      (sum, d) => sum + (d.totalMinutes || 0), 0
    );

    const totalWorkMinutes = workLogs.reduce(
      (sum, w) => sum + (w.actualMinutes || 0), 0
    );

    // 5. Generar datos para PDF
    const pdfData = {
      header: {
        title: `Informe de Falla Correctiva #${occurrence.id}`,
        generatedAt: new Date().toISOString(),
        company: (await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }))?.name
      },
      failure: {
        id: occurrence.id,
        title: occurrence.title,
        description: occurrence.description,
        status: occurrence.status,
        priority: occurrence.priority,
        failureCategory: occurrence.failureCategory,
        reportedAt: occurrence.reportedAt,
        resolvedAt: occurrence.resolvedAt,
        causedDowntime: occurrence.causedDowntime,
        isSafetyRelated: occurrence.isSafetyRelated,
        isIntermittent: occurrence.isIntermittent,
        symptoms: occurrence.symptoms
      },
      location: {
        machine: occurrence.machine,
        component: occurrence.component,
        subcomponent: occurrence.subcomponent
      },
      reporter: occurrence.reporter,
      workOrder: occurrence.workOrder ? {
        id: occurrence.workOrder.id,
        status: occurrence.workOrder.status,
        priority: occurrence.workOrder.priority,
        assignedTo: occurrence.workOrder.assignedTo,
        createdAt: occurrence.workOrder.createdAt,
        closedAt: occurrence.workOrder.closedAt,
        closedBy: occurrence.workOrder.closedBy,
        closingMode: occurrence.workOrder.closingMode,
        diagnosisNotes: occurrence.workOrder.diagnosisNotes,
        workPerformedNotes: occurrence.workOrder.workPerformedNotes,
        resultNotes: occurrence.workOrder.resultNotes
      } : null,
      qualityAssurance: occurrence.workOrder?.qualityAssurance ? {
        isRequired: occurrence.workOrder.qualityAssurance.isRequired,
        status: occurrence.workOrder.qualityAssurance.status,
        requiredReason: occurrence.workOrder.qualityAssurance.requiredReason,
        verifiedBy: occurrence.workOrder.qualityAssurance.verifiedBy,
        verifiedAt: occurrence.workOrder.qualityAssurance.verifiedAt,
        returnToProductionConfirmed: occurrence.workOrder.qualityAssurance.returnToProductionConfirmed
      } : null,
      solutions: occurrence.solutionsApplied.map(s => ({
        id: s.id,
        diagnosis: s.diagnosis,
        solution: s.solution,
        outcome: s.outcome,
        fixType: s.fixType,
        performedBy: s.performedBy,
        performedAt: s.performedAt,
        actualMinutes: s.actualMinutes,
        effectiveness: s.effectiveness,
        notes: s.notes
      })),
      workLogs: workLogs.map(w => ({
        id: w.id,
        activityType: w.activityType,
        description: w.description,
        performedBy: w.performedBy,
        startedAt: w.startedAt,
        endedAt: w.endedAt,
        actualMinutes: w.actualMinutes
      })),
      downtimeLogs: occurrence.downtimeLogs.map(d => ({
        id: d.id,
        category: d.category,
        reason: d.reason,
        startedAt: d.startedAt,
        endedAt: d.endedAt,
        totalMinutes: d.totalMinutes,
        returnedBy: d.returnedBy,
        returnToProductionAt: d.returnToProductionAt
      })),
      totals: {
        totalDowntimeMinutes,
        totalDowntimeFormatted: formatMinutes(totalDowntimeMinutes),
        totalWorkMinutes,
        totalWorkFormatted: formatMinutes(totalWorkMinutes),
        resolutionTimeMinutes: occurrence.resolvedAt
          ? Math.round((new Date(occurrence.resolvedAt).getTime() - new Date(occurrence.reportedAt).getTime()) / 60000)
          : null
      }
    };

    // 6. Retornar datos (el frontend generará el PDF con jsPDF)
    return NextResponse.json({
      success: true,
      data: pdfData
    });

  } catch (error) {
    console.error('❌ Error en GET /api/failure-occurrences/[id]/pdf:', error);
    return NextResponse.json(
      { error: 'Error al generar PDF' },
      { status: 500 }
    );
  }
}

/**
 * Formatea minutos a formato legible
 */
function formatMinutes(minutes: number): string {
  if (!minutes) return '0m';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
