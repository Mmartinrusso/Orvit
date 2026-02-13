/**
 * API: /api/failure-occurrences/[id]/recurrence
 *
 * GET - Obtener historial de reincidencia para una falla
 *       Busca fallas anteriores en la misma máquina/componente
 *       que puedan indicar un problema recurrente
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/failure-occurrences/[id]/recurrence
 * Historial de reincidencia
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

    // 2. Obtener la falla actual
    const currentOccurrence = await prisma.failureOccurrence.findFirst({
      where: {
        id: occurrenceId,
        companyId,
      },
      select: {
        id: true,
        machineId: true,
        subcomponentId: true,
        title: true,
        reportedAt: true,
        failureCategory: true,
        symptoms: true,
      },
    });

    if (!currentOccurrence) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // 3. Obtener configuración de ventana de reincidencia
    let recurrenceWindowDays = 30; // Default 30 días
    try {
      const settings = await prisma.correctiveSettings.findUnique({
        where: { companyId },
      });
      if (settings?.recurrenceWindowDays) {
        recurrenceWindowDays = settings.recurrenceWindowDays;
      }
    } catch (e) {
      // Settings no existe, usar default
    }

    const windowDate = new Date();
    windowDate.setDate(windowDate.getDate() - recurrenceWindowDays);

    // 4. Buscar fallas anteriores en la misma máquina
    const previousOccurrences = await prisma.failureOccurrence.findMany({
      where: {
        companyId,
        machineId: currentOccurrence.machineId,
        id: { not: occurrenceId }, // Excluir la actual
        reportedAt: { lt: currentOccurrence.reportedAt },
        isLinkedDuplicate: false,
        // Opcionalmente filtrar por subcomponente si existe
        ...(currentOccurrence.subcomponentId
          ? { subcomponentId: currentOccurrence.subcomponentId }
          : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        failureCategory: true,
        reportedAt: true,
        resolvedAt: true,
        symptoms: true,
        machine: {
          select: { id: true, name: true },
        },
        reporter: {
          select: { id: true, name: true },
        },
        solutionsApplied: {
          select: {
            id: true,
            diagnosis: true,
            solution: true,
            outcome: true,
            effectiveness: true,
            performedAt: true,
            performedBy: {
              select: { id: true, name: true },
            },
          },
          orderBy: { performedAt: 'desc' },
          take: 1, // Solo la última solución
        },
      },
      orderBy: { reportedAt: 'desc' },
      take: 10, // Máximo 10 anteriores
    });

    // 5. Calcular estadísticas de reincidencia
    const recentOccurrences = previousOccurrences.filter(
      (o) => new Date(o.reportedAt) >= windowDate
    );

    const isRecurrent = recentOccurrences.length >= 2; // 2+ en ventana = recurrente
    const recurrenceCount = recentOccurrences.length;

    // 6. Calcular tiempo promedio entre fallas
    let avgDaysBetweenFailures: number | null = null;
    if (previousOccurrences.length > 0) {
      const allDates = [
        currentOccurrence.reportedAt,
        ...previousOccurrences.map((o) => o.reportedAt),
      ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      if (allDates.length >= 2) {
        let totalDays = 0;
        for (let i = 0; i < allDates.length - 1; i++) {
          const daysDiff = Math.floor(
            (new Date(allDates[i]).getTime() - new Date(allDates[i + 1]).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          totalDays += daysDiff;
        }
        avgDaysBetweenFailures = Math.round(totalDays / (allDates.length - 1));
      }
    }

    // 7. Obtener soluciones efectivas (effectiveness >= 4)
    const effectiveSolutions = previousOccurrences
      .flatMap((o) => o.solutionsApplied)
      .filter((s) => s.effectiveness && s.effectiveness >= 4)
      .slice(0, 3);

    return NextResponse.json({
      currentOccurrence: {
        id: currentOccurrence.id,
        machineId: currentOccurrence.machineId,
        subcomponentId: currentOccurrence.subcomponentId,
      },
      recurrence: {
        isRecurrent,
        recurrenceCount,
        windowDays: recurrenceWindowDays,
        avgDaysBetweenFailures,
      },
      previousOccurrences: previousOccurrences.map((o) => ({
        id: o.id,
        title: o.title,
        status: o.status,
        priority: o.priority,
        failureCategory: o.failureCategory,
        reportedAt: o.reportedAt,
        resolvedAt: o.resolvedAt,
        machine: o.machine,
        reporter: o.reporter,
        lastSolution: o.solutionsApplied[0] || null,
        daysAgo: Math.floor(
          (Date.now() - new Date(o.reportedAt).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      effectiveSolutions,
    });
  } catch (error: any) {
    console.error('❌ Error en GET /api/failure-occurrences/[id]/recurrence:', error);
    return NextResponse.json(
      { error: 'Error al obtener reincidencia', detail: error.message },
      { status: 500 }
    );
  }
}
